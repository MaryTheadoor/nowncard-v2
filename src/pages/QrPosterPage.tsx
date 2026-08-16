import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { fullName, orgLine, initials } from '@/lib/utils';
import { captureElementAsPNG } from '@/lib/image-export';
import { useAuth } from '@/hooks/auth-context';
import { toast } from 'sonner';
import type { Card } from '@/types';

const IconCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>;

/**
 * Profile photo (or accent-colored initials fallback) shown above the poster name.
 * All colors here are explicit sRGB hex — never Tailwind v4 oklch palette tokens,
 * which Chrome's print pipeline renders with shifted saturation.
 */
function PosterAvatar({ card, size }: { card: Card; size: number }) {
  const frame = 'rounded-full overflow-hidden border-[3px] border-[#e5e7eb] shadow-sm mb-4 mx-auto';
  const style = { width: size, height: size };
  if (card.profileImage) {
    return (
      <div className={frame} style={style}>
        <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  const accent = card.accentColor || '#e8a628';
  return (
    <div
      className={`${frame} flex items-center justify-center font-extrabold text-[#1a1408]`}
      style={{ ...style, background: accent, fontSize: Math.round(size * 0.36), printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
    >
      {initials(card.firstName, card.lastName) || '?'}
    </div>
  );
}

export default function QrPosterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        let found: Card | null = null;
        const publicSnap = await getDocs(query(
          collection(db, 'cards'),
          where('slug', '==', slug),
          where('isPublic', '==', true),
          limit(1),
        ));
        if (!publicSnap.empty) {
          found = { id: publicSnap.docs[0].id, ...publicSnap.docs[0].data() } as Card;
        } else if (user) {
          // Owners can print posters for their own private cards too.
          const ownerSnap = await getDocs(query(
            collection(db, 'cards'),
            where('slug', '==', slug),
            where('ownerUid', '==', user.uid),
            limit(1),
          ));
          if (!ownerSnap.empty) {
            found = { id: ownerSnap.docs[0].id, ...ownerSnap.docs[0].data() } as Card;
          } else {
            // Legacy cards may only carry ownerId. The (slug, ownerId) index may be
            // missing, so treat this as best-effort.
            try {
              const legacySnap = await getDocs(query(
                collection(db, 'cards'),
                where('slug', '==', slug),
                where('ownerId', '==', user.uid),
                limit(1),
              ));
              if (!legacySnap.empty) found = { id: legacySnap.docs[0].id, ...legacySnap.docs[0].data() } as Card;
            } catch { /* missing composite index — fall through to not-found */ }
          }
        }
        if (!cancelled) {
          if (found) setCard(found);
          else setError(`Card "${slug}" not found.`);
        }
      } catch {
        if (!cancelled) setError('Failed to load card.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, user]);

  const cardUrl = `${window.location.origin}/card/${slug}`;
  const name = card ? fullName(card) : '';
  const org = card ? orgLine(card) : '';

  const handleSaveImage = async () => {
    if (!posterRef.current || saving) return;
    setSaving(true);
    try {
      const safe = (name || slug || 'poster').replace(/[^a-z0-9_-]/gi, '_');
      await captureElementAsPNG(posterRef.current, `${safe}-poster.png`);
      toast.success('Poster image saved');
    } catch (err) {
      console.error('Failed to save poster image:', err);
      toast.error('Failed to save poster image');
    } finally {
      setSaving(false);
    }
  };

  if (!slug) {
    return <div className="min-h-screen bg-space flex items-center justify-center"><p className="text-ink-muted">No card specified.</p></div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-space flex flex-col">
        <Navbar onAuthClick={() => {}} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-ink mb-2">Card Not Found</h1>
            <p className="text-ink-muted text-sm">{error}</p>
            <Link to="/" className="btn btn-primary btn-md no-underline inline-block mt-4">Home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space text-ink">
      {/* Screen preview */}
      <div className="print:hidden">
        <Navbar onAuthClick={() => {}} />
        <main className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-extrabold mb-2">Printable Poster — {name || slug}</h1>
          <p className="text-ink-muted text-sm mb-8">
            Display this QR code at your storefront, event booth, or office. Standard 8.5"×11" letter size — just print and post.
          </p>

          {/* Poster preview */}
          <div ref={posterRef} className="inline-block bg-white rounded-2xl border border-line shadow-surface overflow-hidden w-full max-w-[400px]">
            <div className="flex flex-col items-center justify-center p-8 sm:p-10 text-[#111827]" style={{ width: '100%', minHeight: '517px' }}>
              {/* Logo */}
              <img src="/nowncard-logo.png" alt="" className="h-7 w-auto object-contain mb-5 opacity-70" />

              {/* Profile + name */}
              <PosterAvatar card={card} size={64} />
              <h2 className="text-xl font-extrabold mb-1">{name || slug}</h2>
              {org && <p className="text-sm text-[#6b7280] mb-5">{org}</p>}

              {/* QR Code */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-[#e5e7eb] mb-5 w-full max-w-[220px]">
                <QRCodeSVG value={cardUrl} size={200} level="M" className="w-full h-auto" />
              </div>

              {/* Scan prompt */}
              <p className="text-sm text-[#9ca3af] mb-1">Point your phone camera here</p>
              <p className="text-xs text-[#9ca3af]">{cardUrl}</p>

              <div className="mt-6 pt-5 border-t border-[#e5e7eb] w-full text-center">
                <p className="text-[10px] text-[#9ca3af]">Powered by NownCard — nowncard.com</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <button onClick={() => window.print()} className="btn btn-primary btn-lg">
              Print Poster
            </button>
            <button onClick={handleSaveImage} disabled={saving} className="btn btn-secondary btn-lg">
              <IconCamera /> {saving ? 'Saving…' : 'Save as Image'}
            </button>
            <Link to={`/card/${slug}`} className="btn btn-secondary btn-lg no-underline">
              View Card
            </Link>
          </div>
        </main>
        <Footer />
      </div>

      {/* Print-only: standard 8.5"×11" letter. Colors are explicit sRGB hex — the
          Tailwind v4 gray palette (oklch) renders with wrong saturation in print. */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-[11in] print:w-[8.5in] print:mx-auto print:bg-white print:text-[#111827] print:px-[1in] print:py-[0.75in]">
        {/* Header */}
        <div className="text-center mb-8">
          <PosterAvatar card={card} size={80} />
          <h1 className="text-3xl font-extrabold mb-2">{name || slug}</h1>
          {org && <p className="text-lg text-[#6b7280] mb-1">{org}</p>}
          <p className="text-base text-[#9ca3af]">Scan the QR code below to open my digital business card</p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-[#e5e7eb] mb-8">
          <QRCodeSVG value={cardUrl} size={280} level="M" />
        </div>

        {/* URL */}
        <p className="text-sm text-[#9ca3af] mb-8">{cardUrl}</p>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-[#e5e7eb] w-full text-center">
          <p className="text-xs text-[#9ca3af]">Powered by NownCard — nowncard.com</p>
        </div>
      </div>
    </div>
  );
}
