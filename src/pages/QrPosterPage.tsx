import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { fullName, orgLine } from '@/lib/utils';
import { captureElementAsPNG } from '@/lib/image-export';
import type { Card } from '@/types';

const IconCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>;

export default function QrPosterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, userData, logOut } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'cards'),
          where('slug', '==', slug),
          where('isPublic', '==', true),
          limit(1),
        ));
        if (snap.empty) {
          setError(`Card "${slug}" not found.`);
        } else {
          setCard({ id: snap.docs[0].id, ...snap.docs[0].data() } as Card);
        }
      } catch {
        setError('Failed to load card.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const cardUrl = `https://nowncard.com/card/${slug}`;
  const name = card ? fullName(card) : '';
  const org = card ? orgLine(card) : '';

  const handleSaveImage = async () => {
    if (!posterRef.current) return;
    const safe = (name || slug || 'poster').replace(/[^a-z0-9_-]/gi, '_');
    await captureElementAsPNG(posterRef.current, `${safe}-poster.png`);
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
        <Navbar onAuthClick={() => {}} onSignOut={() => { logOut(); }} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} secondaryCardSlug={userData?.secondaryCardSlug} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold text-ink mb-2">Card Not Found</h1>
            <p className="text-ink-muted text-sm">{error}</p>
            <Link to="/" className="mt-4 inline-block px-5 py-2 bg-accent text-space font-bold rounded-full text-sm">Home</Link>
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
        <Navbar onAuthClick={() => {}} onSignOut={() => { logOut(); }} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} secondaryCardSlug={userData?.secondaryCardSlug} />
        <main className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-extrabold mb-2">Printable Poster — {name || slug}</h1>
          <p className="text-ink-muted text-sm mb-8">
            Display this QR code at your storefront, event booth, or office. Standard 8.5"×11" letter size — just print and post.
          </p>

          {/* Poster preview */}
          <div ref={posterRef} className="inline-block bg-white rounded-2xl border border-line shadow-surface overflow-hidden">
            <div className="flex flex-col items-center justify-center p-10 text-gray-900" style={{ width: '400px', minHeight: '517px' }}>
              {/* Logo */}
              <img src="/nowncard-logo.png" alt="" className="h-7 w-auto object-contain mb-4 opacity-70" />

              {/* QR Code */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-5">
                <QRCodeSVG value={cardUrl} size={200} level="M" />
              </div>

              {/* Name */}
              <h2 className="text-xl font-extrabold mb-1">{name || slug}</h2>
              {org && <p className="text-sm text-gray-500 mb-3">{org}</p>}

              {/* Scan prompt */}
              <p className="text-sm text-gray-400 mb-1">Point your phone camera here</p>
              <p className="text-xs text-gray-400">{cardUrl}</p>

              <div className="mt-6 pt-5 border-t border-gray-100 w-full text-center">
                <p className="text-[10px] text-gray-400">Powered by NownCard — nowncard.com</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 justify-center mt-6">
            <button onClick={() => window.print()} className="px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition">
              Print Poster
            </button>
            <button onClick={handleSaveImage} className="flex items-center gap-2 px-6 py-2.5 border border-line text-ink font-bold rounded-full text-sm hover:bg-tile-soft transition">
              <IconCamera /> Save as Image
            </button>
            <Link to={`/card/${slug}`} className="px-6 py-2.5 border border-line text-ink font-bold rounded-full text-sm hover:bg-tile-soft transition">
              View Card
            </Link>
          </div>
        </main>
        <Footer />
      </div>

      {/* Print-only: standard 8.5"×11" letter */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-[11in] print:w-[8.5in] print:mx-auto print:bg-white print:text-gray-900 print:px-[1in] print:py-[0.75in]">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold mb-2">{name || slug}</h1>
          {org && <p className="text-lg text-gray-500 mb-1">{org}</p>}
          <p className="text-base text-gray-400">Scan the QR code below to open my digital business card</p>
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 mb-8">
          <QRCodeSVG value={cardUrl} size={280} level="M" />
        </div>

        {/* URL */}
        <p className="text-sm text-gray-400 mb-8">{cardUrl}</p>

        {/* Footer */}
        <div className="mt-auto pt-6 border-t border-gray-200 w-full text-center">
          <p className="text-xs text-gray-400">Powered by NownCard — nowncard.com</p>
        </div>
      </div>
    </div>
  );
}
