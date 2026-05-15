import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';
import { useCardTheme } from '@/hooks/useCardTheme';
import { initials, fullName, orgLine, PLAT } from '@/lib/utils';
import { captureElementAsPNG } from '@/lib/image-export';
import { IconPhone, IconMail, IconGlobe } from '@/components/CardIcons';
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
  const init = card ? initials(card.firstName, card.lastName) : '';
  const org = card ? orgLine(card) : '';

  const phones = card ? (card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : [])).filter((p) => p.number?.trim()) : [];
  const emails = card ? (card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : [])).filter((e) => e.address?.trim()) : [];
  const websites = card ? (card.websites?.length ? card.websites : (card.website ? [{ type: 'Work', url: card.website }] : [])).filter((w) => w.url?.trim()) : [];

  let socials: { platform: string; url: string }[] = [];
  if (card) {
    if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
    else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
      socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));
  }

  const { accent, primaryTextColor, textColorStyle, profileSizePx, profileShapeClass, profileFontSize, isHeaderBg, bgOpacity, bgSizeStyle, tc } = useCardTheme({ card: card || {} });

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
        <Navbar onAuthClick={() => {}} onSignOut={() => { logOut(); }} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} />
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
      {/* On-screen preview */}
      <div className="print:hidden">
        <Navbar onAuthClick={() => {}} onSignOut={() => { logOut(); }} userEmail={user?.email} isAdmin={userData?.isAdmin} defaultCardSlug={userData?.defaultCardSlug} />
        <main className="max-w-2xl mx-auto px-6 py-10 text-center">
          <h1 className="text-2xl font-extrabold mb-2">Printable Poster — {name || slug}</h1>
          <p className="text-ink-muted text-sm mb-8">
            Print this poster and display your QR code. Anyone who scans it opens your digital business card instantly. The card is shown at 2× size.
          </p>

          {/* Poster preview */}
          <div ref={posterRef} className="inline-block bg-space p-6 rounded-2xl border border-line">
            {/* Card at 2x scale */}
            <div className="w-[760px] h-[1330px] mx-auto relative perspective-1200" style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '760px', height: '1330px', marginBottom: '-665px' }}>
              {/* Front face */}
              <div className="absolute inset-0 backface-hidden" style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow, WebkitTransform: 'translateZ(3px)', transform: 'translateZ(3px)' }}>
                {card.backgroundImage && (
                  <>
                    <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
                    <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundColor: tc.overlayBg, opacity: bgOpacity }} />
                  </>
                )}
                <div className="relative z-10 flex flex-col items-center justify-center h-full p-12 pb-10 text-center overflow-y-auto" style={{ fontFamily: card.fontFamily || 'Manrope' }}>
                  <div className="mb-8">
                    {card.profileImage ? (
                      <div className={`overflow-hidden border-[6px] shadow-lg mx-auto ${profileShapeClass}`} style={{ width: profileSizePx * 2, height: profileSizePx * 2, borderColor: accent }}>
                        <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className={`flex items-center justify-center mx-auto ${profileShapeClass} ${tc.profileFallbackBg}`} style={{ width: profileSizePx * 2, height: profileSizePx * 2 }}>
                        <span className={`font-extrabold ${tc.profileFallbackText}`} style={{ fontSize: profileFontSize * 2 }}>{init}</span>
                      </div>
                    )}
                  </div>

                  <h2 className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: '36px' }}>{name || 'Contact'}</h2>
                  {org && <p className={`${tc.textSecondary} mb-3`} style={{ ...textColorStyle, fontSize: '24px' }}>{org}</p>}
                  {card.bio && <p className={`${tc.textMuted} mb-6 max-w-[600px] leading-relaxed`} style={{ ...textColorStyle, fontSize: '20px' }}>{card.bio}</p>}

                  {(phones.length > 0 || emails.length > 0 || websites.length > 0) && (
                    <div className="w-full max-w-[500px] mb-6">
                      <div className="w-full h-px mb-4" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />
                      <div className="space-y-3">
                        {phones.slice(0, 2).map((p, i) => (
                          <div key={`ph-${i}`} className={`flex items-center gap-3 px-5 py-2.5 rounded-lg ${tc.linkText} transition-colors`} style={{ ...textColorStyle, fontSize: '20px' }}>
                            <IconPhone /> <span>{p.number}</span>
                          </div>
                        ))}
                        {emails.slice(0, 2).map((e, i) => (
                          <div key={`em-${i}`} className={`flex items-center gap-3 px-5 py-2.5 rounded-lg ${tc.linkText} transition-colors`} style={{ ...textColorStyle, fontSize: '20px' }}>
                            <IconMail /> <span>{e.address}</span>
                          </div>
                        ))}
                        {websites.slice(0, 2).map((w, i) => (
                          <div key={`ws-${i}`} className={`flex items-center gap-3 px-5 py-2.5 rounded-lg ${tc.linkText} transition-colors`} style={{ ...textColorStyle, fontSize: '20px' }}>
                            <IconGlobe /> <span>{w.url}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {socials.length > 0 && (
                    <div className="flex flex-wrap gap-3 justify-center mb-6">
                      {socials.map((s) => (
                        <span key={s.platform} className={`px-5 py-2 border rounded-full text-sm font-semibold ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`} style={{ fontSize: '20px' }}>
                          {PLAT[s.platform] || s.platform}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* QR code on poster */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <QRCodeSVG value={card.qrMode === 'vcard' ? `https://nowncard.com/card/${slug}` : cardUrl} size={200} level="M" />
                  </div>
                  <p className={`mt-3 ${tc.qrSub}`} style={{ ...textColorStyle, fontSize: '18px' }}>Scan QR to open card</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-ink-faint mt-4">Card shown at 2× size on the poster</p>

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

      {/* Print-only layout — full-size card poster */}
      <div className="hidden print:flex print:flex-col print:items-center print:justify-center print:min-h-[11in] print:w-[8.5in] print:p-[0.5in] print:text-center print:mx-auto print:bg-white print:text-black">
        <p className="text-base mb-4 print:text-gray-600">Scan with your phone camera</p>

        {/* Card at 2x — fits within printed page */}
        <div className="relative" style={{ width: '760px', height: '1330px', transform: 'scale(0.7)', transformOrigin: 'top center', marginBottom: '-400px' }}>
          <div className="absolute inset-0" style={{ borderRadius: 20, overflow: 'hidden', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow, WebkitTransform: 'translateZ(3px)', transform: 'translateZ(3px)' }}>
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-12 pb-10 text-center">
              {card.profileImage ? (
                <div className={`overflow-hidden border-[6px] mx-auto mb-8 ${profileShapeClass}`} style={{ width: profileSizePx * 2, height: profileSizePx * 2, borderColor: accent }}>
                  <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`flex items-center justify-center mx-auto mb-8 ${profileShapeClass} bg-gradient-to-br from-gray-200 to-gray-300`} style={{ width: profileSizePx * 2, height: profileSizePx * 2 }}>
                  <span className="font-extrabold text-gray-500" style={{ fontSize: profileFontSize * 2 }}>{init}</span>
                </div>
              )}

              <h2 className="font-extrabold mb-1" style={{ color: primaryTextColor, fontSize: '36px' }}>{name || 'Contact'}</h2>
              {org && <p className="text-gray-500 mb-3" style={{ fontSize: '24px' }}>{org}</p>}

              <div className="bg-white rounded-xl p-4 shadow-sm mt-6">
                <QRCodeSVG value={cardUrl} size={200} level="M" />
              </div>
              <p className="text-gray-400 mt-3" style={{ fontSize: '18px' }}>Scan QR to open card</p>
            </div>
          </div>
        </div>

        <p className="text-lg font-bold mt-6">{name}</p>
        <p className="text-sm text-gray-500 mb-2">{cardUrl}</p>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">Powered by NownCard — nowncard.com</p>
        </div>
      </div>
    </div>
  );
}
