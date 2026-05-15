import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { fullName } from '@/lib/utils';
import type { Card } from '@/types';

export default function QrPosterPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, userData, logOut } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!slug) {
    return <div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-500">No card specified.</p></div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar
          onAuthClick={() => {}}
          onSignOut={() => { logOut(); }}
          userEmail={user?.email}
          isAdmin={userData?.isAdmin}
          defaultCardSlug={userData?.defaultCardSlug}
        />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <h1 className="text-xl font-bold mb-2">Card Not Found</h1>
            <p className="text-gray-500 text-sm">{error}</p>
            <Link to="/" className="mt-4 inline-block px-5 py-2 bg-black text-white font-bold rounded-full text-sm">Home</Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* On-screen preview */}
      <div className="print:hidden">
        <Navbar
          onAuthClick={() => {}}
          onSignOut={() => { logOut(); }}
          userEmail={user?.email}
          isAdmin={userData?.isAdmin}
          defaultCardSlug={userData?.defaultCardSlug}
        />
        <main className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-extrabold mb-2">QR Poster for {name || slug}</h1>
          <p className="text-gray-500 text-sm mb-8">
            Print this page and display the QR code at your storefront, event booth, or office. Anyone who scans it opens your digital business card instantly.
          </p>
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm inline-block p-8 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-none">
              <QRCodeSVG value={cardUrl} size={280} level="M" />
            </div>
            <p className="text-lg font-bold mt-4">{name}</p>
            <p className="text-sm text-gray-500">Scan for my business card</p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.print()}
              className="px-6 py-2.5 bg-black text-white font-bold rounded-full text-sm hover:opacity-80 transition"
            >
              Print This Page
            </button>
            <a
              href={`/card/${slug}`}
              className="px-6 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-full text-sm hover:bg-gray-50 transition"
            >
              View Card
            </a>
          </div>
        </main>
        <Footer />
      </div>

      {/* Print-only layout — 8.5"×11" */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-[11in] print:w-[8.5in] print:p-[0.75in] print:text-center print:mx-auto">
        <div className="mb-6">
          <QRCodeSVG value={cardUrl} size={320} level="M" />
        </div>
        <h1 className="text-3xl font-extrabold mb-1">{name}</h1>
        <p className="text-lg text-gray-500 mb-3">Scan for my business card</p>
        <p className="text-sm text-gray-400">{cardUrl}</p>
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">Powered by NownCard — Create yours at nowncard.com</p>
        </div>
      </div>
    </div>
  );
}
