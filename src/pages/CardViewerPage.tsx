import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, limit, getDocs, doc, updateDoc, increment, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadVCard } from '@/lib/vcard';
import { escHtml, initials, fullName, orgLine, formatAddress, shareNative, isLightBg, detectDevice } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import ShareModal from '@/components/ShareModal';
import { QRCodeSVG } from 'qrcode.react';
import type { Card } from '@/types';

const PLAT: Record<string, string> = {
  linkedin: 'LinkedIn', twitter: 'X/Twitter', x: 'X/Twitter',
  github: 'GitHub', instagram: 'Instagram', youtube: 'YouTube',
  facebook: 'Facebook', tiktok: 'TikTok', website: 'Website',
};

const IconPhone = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
const IconMail = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
const IconGlobe = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconPin = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[18px] h-[18px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10 12 15 17 10"/><path d="M12 15V3"/></svg>;

export default function CardViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, signInEmail, signUpEmail, signInGoogle, linkGoogle, signInAnon, error: authError } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [cardsDocId, setCardsDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const trackedMeta = useRef(false);
  const startTime = useRef(0);
  useEffect(() => { startTime.current = Date.now(); }, []);

  // Load Google Font dynamically
  useEffect(() => {
    if (!card?.fontFamily || card.fontFamily === 'Manrope') return;
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(card.fontFamily)}:wght@400;500;600;700;800&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [card?.fontFamily]);

  // Load custom font dynamically
  useEffect(() => {
    if (!card?.customFontUrl) return;
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: 'CustomFont'; src: url('${card.customFontUrl}'); font-weight: 400 800; font-display: swap; }`;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, [card?.customFontUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) { if (!cancelled) { setError('No card slug provided'); setLoading(false); } return; }
      try {
        let data: Card | null = null;
        let cardsDocId: string | null = null;

        const c = await getDocs(query(collection(db, 'cards'), where('slug', '==', slug), where('isPublic', '==', true), limit(1)));
        if (!c.empty) {
          const d = c.docs[0];
          data = { id: d.id, ...d.data() } as Card;
          cardsDocId = d.id;
        }
        if (!data) {
          const p = await getDocs(query(collection(db, 'publicCards'), where('slug', '==', slug), limit(1)));
          if (!p.empty) {
            const d = p.docs[0];
            data = { id: d.id, ...d.data() } as Card;
          }
        }
        if (cancelled) return;
        if (!data) { setError(`The card "${escHtml(slug)}" does not exist or is not public.`); }
        else {
          setCard(data);
          setCardsDocId(cardsDocId);
          document.title = `${fullName(data) || 'Contact'} — NownCard`;
          if (cardsDocId) {
            try { await updateDoc(doc(db, 'cards', cardsDocId), { viewCount: increment(1) }); } catch { /* no-op */ }
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load card. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; document.title = 'NownCard — Digital Business Cards'; };
  }, [slug]);

  // Time-on-page tracking
  useEffect(() => {
    const handler = () => {
      if (!card) return;
      const seconds = Math.round((Date.now() - startTime.current) / 1000);
      if (seconds < 2) return;
      const analyticsId = cardsDocId || card.id;
      try {
        setDoc(doc(db, 'analytics', analyticsId), { timeOnPage: increment(seconds), updatedAt: serverTimestamp() }, { merge: true });
      } catch { /* no-op */ }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [card, cardsDocId]);

  const track = async (type: string) => {
    if (!card) return;
    const analyticsId = cardsDocId || card.id;
    const payload: Record<string, unknown> = { [`taps.${type}`]: increment(1), updatedAt: serverTimestamp() };

    if (!trackedMeta.current) {
      trackedMeta.current = true;
      payload.device = detectDevice();
      const ref = document.referrer;
      if (ref && !ref.includes(window.location.host)) payload.referrer = ref;
    }

    try { await setDoc(doc(db, 'analytics', analyticsId), payload, { merge: true }); } catch { /* no-op */ }
  };

  const handleFlip = () => {
    setFlipped((f) => !f);
    track('flip');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center text-ink-muted">
        <div className="w-6 h-6 border-2 border-line border-t-accent rounded-full animate-spin mb-4" />
        <p>Loading card…</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-space flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-xl font-bold text-ink mb-2">Card Not Found</h1>
        <p className="text-ink-muted text-sm max-w-xs text-center">{error}</p>
        <Link to="/" className="mt-6 px-5 py-2.5 bg-accent text-space font-bold rounded-xl text-sm hover:brightness-110 transition inline-block no-underline">Create your own →</Link>
      </div>
    );
  }

  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const cardUrl = `${window.location.origin}/card/${card.slug}`;
  const bgStyle = card.backgroundImage ? { backgroundImage: `url('${card.backgroundImage}')` } : undefined;
  const accent = card.accentColor || '#c9a278';

  const phones = (card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : [])).filter((p) => p.number?.trim());
  const emails = (card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : [])).filter((e) => e.address?.trim());
  const websites = (card.websites?.length ? card.websites : (card.website ? [{ type: 'Work', url: card.website }] : [])).filter((w) => w.url?.trim());
  const addrs = (card.addresses?.length ? card.addresses : (card.address ? [{ type: 'work', street: card.address }] : [])).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());

  let socials: { platform: string; url: string }[] = [];
  if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
  else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
    socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));

  // Determine theme: custom bg color takes priority, else cardTheme preset
  const hasCustomBg = !!card.cardBgColor;
  const isDark = hasCustomBg ? !isLightBg(card.cardBgColor!) : card.cardTheme === 'dark';
  const customBg = card.cardBgColor || undefined;

  const fontFamily = card.customFontUrl ? "'CustomFont', sans-serif" : (card.fontFamily || 'Manrope');
  const fontScale = card.fontSizeScale || 1;
  const sfs = (px: number) => `${Math.round(px * fontScale)}px`;

  const tc = {
    faceBg: customBg || (isDark ? '#12121a' : undefined),
    faceShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)' : undefined,
    textPrimary: isDark ? 'text-[#f4f1ec]' : 'text-[#1a1612]',
    textSecondary: isDark ? 'text-[#9a9186]' : 'text-[#6b6256]',
    textMuted: isDark ? 'text-[#7a7166]' : 'text-[#7a7166]',
    linkText: isDark ? 'text-[#c9c3ba]' : 'text-[#4a4238]',
    linkHover: isDark ? 'hover:text-[#f4f1ec]' : 'hover:text-[#2a2520]',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(42,37,32,0.12)',
    overlayGradient: isDark
      ? 'linear-gradient(to bottom right, rgba(18,18,26,0.55), rgba(18,18,26,0.4), rgba(18,18,26,0.6))'
      : 'linear-gradient(to bottom right, rgba(244,241,236,0.35), rgba(244,241,236,0.25), rgba(244,241,236,0.4))',
    socialBorder: isDark ? 'border-white/10' : 'border-[rgba(42,37,32,0.12)]',
    socialText: isDark ? 'text-[#9a9186]' : 'text-[#5a5046]',
    socialHoverBg: isDark ? 'hover:bg-white/5' : 'hover:bg-[rgba(42,37,32,0.06)]',
    socialHoverText: isDark ? 'hover:text-[#e8e4de]' : 'hover:text-[#2a2520]',
    qrSub: isDark ? 'text-[#9a9186]' : 'text-[#7a7166]',
    profileFallbackBg: isDark ? 'bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e]' : 'bg-gradient-to-br from-[#d4cfc8] to-[#e8e4de]',
    profileFallbackText: isDark ? 'text-[#c9c3ba]' : 'text-[#6b6256]',
  };

  return (
    <div className="min-h-screen bg-space flex flex-col">
      <Navbar onAuthClick={() => setAuthOpen(true)} onSignOut={() => {}} userEmail={user?.email} />

      {/* Card stage */}
      <div className="flex-1 flex flex-col items-center px-5 pt-2 pb-24">
        <div className="w-full max-w-[380px] aspect-[2/3.5] perspective-1200 relative">
          <div className={`w-full h-full preserve-3d transition-transform duration-[800ms] ${flipped ? 'rotate-y-180' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} onClick={handleFlip} role="button" aria-label="Flip card">
            {/* Front */}
            <div className={`card-face flex flex-col ${!customBg && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
              {card.backgroundImage && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={bgStyle} />
                  <div className="absolute inset-0" style={{ background: tc.overlayGradient }} />
                </>
              )}
              <div className="relative z-10 flex-1 flex flex-col items-center p-6 pb-5 text-center" style={{ fontFamily }}>
                {/* Profile */}
                <div className="mb-4">
                  {card.profileImage ? (
                    <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-[3px] shadow-lg mx-auto" style={{ borderColor: accent }}>
                      <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center font-extrabold border-[3px] shadow-lg mx-auto ${tc.profileFallbackBg} ${tc.profileFallbackText}`} style={{ borderColor: accent, fontSize: sfs(22) }}>
                      {init}
                    </div>
                  )}
                </div>

                {/* Name / org / bio */}
                <div className="mb-4">
                  {card.nameLayout === 'business' && card.company ? (
                    <>
                      <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ fontSize: sfs(22) }}>{card.company}</div>
                      {name && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ fontSize: sfs(13) }}>{name}{card.jobTitle ? ` · ${card.jobTitle}` : ''}</div>}
                    </>
                  ) : (
                    <>
                      <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ fontSize: sfs(22) }}>{name || 'Anonymous'}</div>
                      {org && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ fontSize: sfs(13) }}>{org}</div>}
                    </>
                  )}
                  {card.bio && <div className={`leading-relaxed mt-2 max-w-[260px] mx-auto ${tc.textMuted}`} style={{ fontSize: sfs(12) }}>{card.bio}</div>}
                </div>

                <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />

                {/* Contact links */}
                <div className="flex flex-col gap-2 items-center w-full">
                  {phones.map((p, i) => (
                    <a key={`p-${i}`} href={`tel:${p.number}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('call'); }}>
                      <IconPhone /> {p.number}
                    </a>
                  ))}
                  {emails.map((e, i) => (
                    <a key={`e-${i}`} href={`mailto:${e.address}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('email'); }}>
                      <IconMail /> {e.address}
                    </a>
                  ))}
                  {websites.map((w, i) => (
                    <a key={`w-${i}`} href={w.url?.startsWith('http') ? w.url : `https://${w.url}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('website'); }}>
                      <IconGlobe /> {w.url}
                    </a>
                  ))}
                  {addrs.map((a, i) => {
                    const line = formatAddress(a);
                    return line ? (
                      <a key={`a-${i}`} href={`https://maps.google.com/?q=${encodeURIComponent(line)}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('map'); }}>
                        <IconPin /> {line}
                      </a>
                    ) : null;
                  })}
                </div>

                {/* Social wordmark buttons */}
                {socials.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mt-auto pt-5">
                    {socials.map((s, i) => (
                      <a
                        key={`s-${i}`}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border no-underline transition-colors ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`}
                        style={{ fontSize: sfs(11) }}
                        onClick={(e) => { e.stopPropagation(); track(`social:${s.platform}`); }}
                      >
                        {PLAT[s.platform.toLowerCase()] || s.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-ink-faint" style={{ fontFamily }}>Tap to flip · QR on back</p>
            </div>

            {/* Back */}
            <div className={`card-face flex flex-col items-center justify-center p-7 text-center ${!customBg && !isDark ? 'bg-card-bg' : ''}`} style={{ transform: 'rotateY(180deg) translateZ(3px)', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
              <img src="/nowncard-logo.png" alt="" className="h-10 w-auto object-contain mb-3" />
              <div className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ fontFamily, fontSize: sfs(18) }}>{name || 'Contact'}</div>
              <div className={`mb-5 ${tc.qrSub}`} style={{ fontFamily, fontSize: sfs(12) }}>Scan to save</div>
              <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                <QRCodeSVG value={cardUrl} size={150} level="M" includeMargin={false} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={(e) => { e.stopPropagation(); downloadVCard(card); track('save'); if (cardsDocId) { try { updateDoc(doc(db, 'cards', cardsDocId), { saveCount: increment(1) }); } catch { /* no-op */ } } }} className="px-4 py-2 rounded-full text-sm font-bold bg-card-bg text-space hover:brightness-105 transition">
                  Save Contact
                </button>
                <button onClick={(e) => { e.stopPropagation(); const promise = shareNative({ title: name, url: cardUrl }); if (!promise) { setShareOpen(true); } else { promise.then(() => track('share')).catch(() => setShareOpen(true)); } }} className="px-4 py-2 rounded-full text-sm font-bold bg-transparent text-ink border border-line hover:bg-tile-soft transition">
                  Share
                </button>
              </div>
              <p className="mt-4 text-[11px] text-ink-faint" style={{ fontFamily }}>Tap to flip back</p>
            </div>
          </div>
        </div>

        {/* Desktop action bar */}
        <div className="hidden md:flex flex-wrap gap-2.5 justify-center mt-6 max-w-[380px] w-full">
          <button onClick={async () => { downloadVCard(card); track('save'); if (cardsDocId) { try { await updateDoc(doc(db, 'cards', cardsDocId), { saveCount: increment(1) }); } catch { /* no-op */ } } }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-card-bg text-space border-none cursor-pointer hover:brightness-105 transition">
            <IconDownload /> Save
          </button>
          <button onClick={handleFlip} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-transparent text-ink border border-line cursor-pointer hover:bg-tile-soft transition">
            {flipped ? 'Show Card' : 'Show QR'}
          </button>
          <button onClick={() => { const promise = shareNative({ title: name, url: cardUrl }); if (!promise) { setShareOpen(true); return; } promise.then(() => track('share')).catch(() => setShareOpen(true)); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-transparent text-ink border border-line cursor-pointer hover:bg-tile-soft transition">
            Share
          </button>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(42,37,32,0.12)] bg-[#f4f1ec] px-4 py-3 flex gap-2.5">
        <button onClick={async () => { downloadVCard(card); track('save'); if (cardsDocId) { try { await updateDoc(doc(db, 'cards', cardsDocId), { saveCount: increment(1) }); } catch { /* no-op */ } } }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold bg-[#1a1612] text-[#f4f1ec] border-none cursor-pointer hover:brightness-110 transition">
          <IconDownload /> Save to Contacts
        </button>
        <button onClick={handleFlip} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold bg-transparent text-[#1a1612] border border-[rgba(42,37,32,0.2)] cursor-pointer hover:bg-[rgba(42,37,32,0.06)] transition">
          {flipped ? 'Card' : 'QR'}
        </button>
        <button onClick={() => { const promise = shareNative({ title: name, url: cardUrl }); if (!promise) { setShareOpen(true); return; } promise.then(() => track('share')).catch(() => setShareOpen(true)); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[15px] font-bold bg-transparent text-[#1a1612] border border-[rgba(42,37,32,0.2)] cursor-pointer hover:bg-[rgba(42,37,32,0.06)] transition">
          Share
        </button>
      </div>

      {/* Footer */}
      <div className="text-center py-6 pb-24 md:pb-6">
        <Link to="/" className="text-xs font-semibold text-ink-faint hover:text-ink no-underline">Built with NownCard</Link>
        <p className="text-[10px] text-ink-faint mt-1">
          © 2026 NownCard — A product of{' '}
          <a href="https://www.nowndigital.com" target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-ink underline underline-offset-2">NOWN Digital</a>
        </p>
      </div>

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={cardUrl}
        title={name || 'My NownCard'}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSignInEmail={signInEmail}
        onSignUpEmail={signUpEmail}
        onSignInGoogle={signInGoogle}
        onLinkGoogle={linkGoogle}
        onSignInAnon={signInAnon}
        error={authError}
        isAuthenticated={!!user}
      />
    </div>
  );
}
