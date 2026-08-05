import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/auth-context';
import { generateVCard } from '@/lib/vcard';
import type { Card } from '@/types';
import { toast } from 'sonner';
import { Nfc, ArrowLeft, Globe, Contact } from 'lucide-react';

interface NDEFWriteOptions {
  records: NDEFRecordInit[];
}

interface NDEFRecordInit {
  recordType: string;
  mediaType?: string;
  data?: string | BufferSource | unknown;
}

interface NDEFReader {
  write: (options: NDEFWriteOptions) => Promise<void>;
}

declare global {
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
}

export default function NfcPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState(false);
  const [mode, setMode] = useState<'url' | 'vcard'>('url');
  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in window;

  const cardUrl = typeof window !== 'undefined' ? `${window.location.origin}/card/${slug}` : '';

  useEffect(() => {
    (async () => {
      if (!slug) { setLoading(false); return; }
      try {
        const cardsSnap = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('isPublic', '==', true), limit(1)));
        if (!cardsSnap.empty) {
          setCard({ id: cardsSnap.docs[0].id, ...cardsSnap.docs[0].data() } as Card);
        } else {
          toast.error('Card not found');
        }
      } catch {
        toast.error('Failed to load card');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const [showPreview, setShowPreview] = useState(false);

  const handleWrite = async () => {
    if (!window.NDEFReader) { toast.error('NFC not supported on this device'); return; }
    if (!card) { toast.error('Card data not loaded'); return; }
    setWriting(true);
    try {
      const ndef = new window.NDEFReader();
      const records: NDEFRecordInit[] = [];

      if (mode === 'url') {
        records.push({ recordType: 'url', data: cardUrl });
      } else {
        const vcard = generateVCard(card, cardUrl);
        records.push({
          recordType: 'mime',
          mediaType: 'text/vcard',
          data: new TextEncoder().encode(vcard),
        });
      }

      await ndef.write({ records });
      toast.success('NFC tag written successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Write failed';
      console.error('[NFC] Write error:', err);
      if (msg.includes('Abort') || msg.includes('cancel')) {
        toast.error('Write cancelled. Hold the tag steady against the back of your phone.');
      } else if (msg.includes('not allowed') || msg.includes('permission')) {
        toast.error('NFC permission denied. Check browser settings.');
      } else if (msg.includes('format') || msg.includes('NDEF')) {
        toast.error('This tag is not NDEF-formatted or is locked. Try a different tag.');
      } else if (msg.includes('IO')) {
        toast.error('Tag communication failed. Remove and re-hold the tag.');
      } else {
        toast.error(`Write failed: ${msg}`);
      }
    } finally {
      setWriting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate('/');
  }, [user, authLoading, navigate]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading…</p>
      </div>
    );
  }

  if (nfcSupported === false) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center px-5 text-center">
        <Nfc className="w-12 h-12 text-ink-faint mb-4" />
        <h1 className="text-xl font-bold text-ink mb-2">NFC Not Supported</h1>
        <p className="text-ink-muted max-w-sm mb-6">
          Web NFC is only available on Android devices with Chrome 89+.
          iOS does not support writing NFC tags from the browser.
        </p>
        <Link to={`/card/${slug}`} className="btn btn-primary btn-lg no-underline">
          <ArrowLeft className="w-4 h-4" /> Back to Card
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space">
      <header className="sticky top-0 z-40 bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-2xl mx-auto px-5 flex items-center justify-between h-14">
          <Link to={`/card/${slug}`} className="flex items-center gap-2 text-ink font-bold text-[15px]">
            <ArrowLeft className="w-4 h-4" />
            <span>Write NFC Tag</span>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8">
        <div className="bg-tile border border-line rounded-2xl p-6 mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-tile-soft border border-line flex items-center justify-center mx-auto mb-4">
            <Nfc className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-xl font-bold text-ink mb-1">Program NFC Tag</h1>
          <p className="text-sm text-ink-muted mb-6">
            Hold an NFC tag against your device and tap Write to program it.
          </p>

          {card && (
            <div className="bg-space border border-line rounded-xl p-4 mb-6 text-left">
              <h3 className="font-bold text-sm mb-1">{card.firstName} {card.lastName}</h3>
              <p className="text-xs text-ink-muted mb-2">{card.jobTitle}{card.company ? ` · ${card.company}` : ''}</p>
              <p className="text-xs text-accent font-mono break-all">{cardUrl}</p>
            </div>
          )}

          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setMode('url')}
              className={`btn btn-sm ${mode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Globe className="w-3.5 h-3.5" /> Card URL
            </button>
            <button
              onClick={() => setMode('vcard')}
              className={`btn btn-sm ${mode === 'vcard' ? 'btn-primary' : 'btn-secondary'}`}
            >
              <Contact className="w-3.5 h-3.5" /> vCard
            </button>
          </div>

          <button
            onClick={handleWrite}
            disabled={writing}
            className="btn btn-primary btn-lg w-full sm:w-auto mx-auto"
          >
            {writing ? (
              <>
                <div className="w-4 h-4 border-2 border-space/30 border-t-space rounded-full animate-spin" />
                Hold tag to device…
              </>
            ) : (
              <>
                <Nfc className="w-4 h-4" /> Write to Tag
              </>
            )}
          </button>

          <p className="text-xs text-ink-faint mt-4">
            {mode === 'url'
              ? 'Anyone tapping this tag will open your card page.'
              : 'Anyone tapping this tag will receive your contact as a vCard.'}
          </p>

          <button
            onClick={() => setShowPreview((s) => !s)}
            className="mt-4 text-xs text-accent font-semibold hover:underline cursor-pointer"
          >
            {showPreview ? 'Hide preview' : 'Preview what will be written'}
          </button>

          {showPreview && (
            <div className="mt-3 bg-space border border-line rounded-xl p-3 text-left">
              <div className="text-[11px] text-ink-faint uppercase font-bold tracking-wider mb-1">{mode === 'url' ? 'URL' : 'vCard Data'}</div>
              <pre className="text-[11px] text-ink-muted font-mono whitespace-pre-wrap break-all">{mode === 'url' ? cardUrl : generateVCard(card || {}, cardUrl)}</pre>
            </div>
          )}
        </div>

        <div className="bg-tile border border-line rounded-2xl p-6">
          <h2 className="text-sm font-bold mb-3">Troubleshooting</h2>
          <ul className="text-xs text-ink-muted space-y-2 list-disc list-inside">
            <li>Use Android Chrome 89 or later.</li>
            <li>Enable NFC in your phone settings.</li>
            <li>Hold the tag against the back of your phone (usually near the camera).</li>
            <li>Keep the tag steady until you see the confirmation.</li>
            <li>Some tags may be read-only or locked.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
