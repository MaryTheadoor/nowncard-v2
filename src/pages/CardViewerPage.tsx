import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, limit, getDocs, doc, updateDoc, increment, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadVCard, generateVCard, saveToContacts } from '@/lib/vcard';
import { getMenuIcon } from '@/lib/menuIcons';
import { escHtml, initials, fullName, orgLine, formatAddress, shareNative, detectDevice, PLAT, PAYMENT_PLAT } from '@/lib/utils';
import { useAuth } from '@/hooks/auth-context';
import { useCardTheme } from '@/hooks/useCardTheme';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import ShareModal from '@/components/ShareModal';
import AppointmentModal from '@/components/AppointmentModal';
import ImportVCardModal from '@/components/ImportVCardModal';
import SaveImageModal from '@/components/SaveImageModal';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import type { Card } from '@/types';

import { Calendar, ExternalLink, Pencil, ChevronDown } from 'lucide-react';
import { IconPhone, IconMail, IconGlobe, IconPin } from '@/components/CardIcons';
const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[18px] h-[18px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10 12 15 17 10"/><path d="M12 15V3"/></svg>;
const IconSend = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-10z"/></svg>;
const IconCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>;

const isIOSUA = typeof navigator !== 'undefined' && /iP(hone|od|ad)/i.test(navigator.userAgent);
const isAndroidUA = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

export default function CardViewerPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, signInEmail, signUpEmail, signInGoogle, linkGoogle, error: authError } = useAuth();
  const [card, setCard] = useState<Card | null>(null);
  const [cardsDocId, setCardsDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadSending, setLeadSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [appointmentOpen, setAppointmentOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [saveImageOpen, setSaveImageOpen] = useState(false);
  const [vcfHelpOpen, setVcfHelpOpen] = useState(false);
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
    const safeUrl = card.customFontUrl.replace(/'/g, '');
    const style = document.createElement('style');
    style.textContent = `@font-face { font-family: 'CustomFont'; src: url('${safeUrl}'); font-weight: 400 800; font-display: swap; }`;
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
        if (cancelled) return;
        if (!data) { setError(`The card "${escHtml(slug)}" does not exist or is not public.`); }
        else {
          setCard(data);
          setCardsDocId(cardsDocId);
          const cardTitle = `${fullName(data) || 'Contact'} — NownCard`;
          const cardDesc = data.bio || `Digital business card for ${fullName(data) || 'Contact'}`;
          const cardImage = `${window.location.origin}/og-images/${encodeURIComponent(slug)}.png`;
          document.title = cardTitle;
          const setMeta = (selector: string, content: string) => {
            const el = document.querySelector(selector) as HTMLMetaElement | null;
            if (el) el.content = content;
          };
          setMeta('meta[name="description"]', cardDesc);
          setMeta('meta[property="og:title"]', cardTitle);
          setMeta('meta[property="og:description"]', cardDesc);
          setMeta('meta[property="og:image"]', cardImage);
          setMeta('meta[name="twitter:title"]', cardTitle);
          setMeta('meta[name="twitter:description"]', cardDesc);
          setMeta('meta[name="twitter:image"]', cardImage);
          if (cardsDocId) {
            try { await updateDoc(doc(db, 'cards', cardsDocId), { viewCount: increment(1) }); } catch (err) { console.error('[CardViewer] viewCount update failed:', err); }
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load card. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      document.title = 'NownCard — Digital Business Cards';
      const resetMeta = (selector: string, content: string) => {
        const el = document.querySelector(selector) as HTMLMetaElement | null;
        if (el) el.content = content;
      };
      resetMeta('meta[property="og:title"]', 'NownCard — Digital Business Cards');
      resetMeta('meta[property="og:description"]', 'Create beautiful digital business cards. Share via NFC, QR code, link, or vCard. No app required for recipients.');
      resetMeta('meta[property="og:image"]', 'https://nowncard.com/nowncard-logo.png');
      resetMeta('meta[name="twitter:title"]', 'NownCard — Digital Business Cards');
      resetMeta('meta[name="twitter:description"]', 'Create beautiful digital business cards. Share via NFC, QR code, link, or vCard. No app required for recipients.');
      resetMeta('meta[name="twitter:image"]', 'https://nowncard.com/nowncard-logo.png');
    };
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
      } catch (err) { console.error('[CardViewer] timeOnPage analytics failed:', err); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [card, cardsDocId]);

  const track = async (type: string) => {
    if (!card) return;
    const analyticsId = cardsDocId || card.id;
    const safeType = type.replace(/[^a-z0-9_:.-]/gi, '_').slice(0, 40);
    const payload: Record<string, unknown> = { [`taps.${safeType}`]: increment(1), updatedAt: serverTimestamp() };

    if (!trackedMeta.current) {
      trackedMeta.current = true;
      payload.device = detectDevice();
      const ref = document.referrer;
      if (ref && !ref.includes(window.location.host)) payload.referrer = ref;
    }

    try { await setDoc(doc(db, 'analytics', analyticsId), payload, { merge: true }); } catch (err) { console.error('[CardViewer] tap analytics failed:', err); }
  };

  const handleFlip = () => {
    setFlipped((f) => !f);
    track('flip');
  };

  const handleSaveContact = () => {
    if (!card) return;
    const action = saveToContacts(card, cardUrl);
    if (action === 'download-import') setVcfHelpOpen(true);
    track('save');
    if (cardsDocId) { try { updateDoc(doc(db, 'cards', cardsDocId), { saveCount: increment(1) }); } catch (err) { console.error('[CardViewer] saveCount update failed:', err); } }
  };

  const handleSendMessage = async () => {
    if (!card || !messageText.trim()) return;
    if (!user) { setAuthOpen(true); return; }
    setSendingMessage(true);
    try {
      const owner = card.ownerUid || card.ownerId;
      if (!owner) { toast.error('Card owner not found'); setSendingMessage(false); return; }
      await addDoc(collection(db, 'messages'), {
        senderUid: user.uid,
        senderName: user.displayName || user.email || 'Anonymous',
        senderEmail: user.email || '',
        recipientUid: owner as string,
        cardId: cardsDocId || card.id,
        cardSlug: card.slug,
        content: messageText.trim(),
        createdAt: serverTimestamp(),
        read: false,
      });
      setMessageText('');
      setMessageSent(true);
      toast.success('Message sent');
      track('message');
    } catch (err) {
      console.error('[CardViewer] Send message error:', err);
      toast.error('Failed to send message');
    }
    setSendingMessage(false);
  };

  const handleSubmitLead = async () => {
    if (!card) return;
    if (!leadName.trim() || !leadEmail.trim() || !messageText.trim()) {
      toast.error('Please fill in your name, email, and a message.');
      return;
    }
    setLeadSending(true);
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fn = httpsCallable(getFunctions(), 'submitLead');
      await fn({
        cardId: card.id,
        cardSlug: card.slug,
        name: leadName.trim(),
        email: leadEmail.trim(),
        phone: leadPhone.trim() || undefined,
        company: leadCompany.trim() || undefined,
        message: messageText.trim(),
      });
      setLeadSent(true);
      toast.success('Message sent');
      track('lead');
    } catch (err) {
      console.error('[CardViewer] Lead submit error:', err);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLeadSending(false);
    }
  };

  // Called before early returns to satisfy React hooks ordering
  const cardTheme = useCardTheme({ card: card || {} });

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
        <Link to="/" className="btn btn-primary btn-md no-underline inline-block mt-6">Create your own →</Link>
      </div>
    );
  }

  const { isDark, accent, primaryTextColor, textColorStyle, profileSizePx, profileShapeClass, profileFontSize, isHeaderBg, bgOpacity, bgSizeStyle, tc } = cardTheme;

  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const cardUrl = `${window.location.origin}/card/${card.slug}`;
  const isOwner = !!user && [card.ownerUid, card.ownerId, card.teamOwnerUid, card.teamOwnerId].filter(Boolean).includes(user.uid);

  const phones = (card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : [])).filter((p) => p.number?.trim());
  const emails = (card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : [])).filter((e) => e.address?.trim());
  const websites = (card.websites?.length ? card.websites : (card.website ? [{ type: 'Work', url: card.website }] : [])).filter((w) => w.url?.trim());
  const addrs = (card.addresses?.length ? card.addresses : (card.address ? [{ type: 'work', street: card.address }] : [])).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());

  let socials: { platform: string; url: string }[] = [];
  if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
  else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
    socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));

  const paymentLinks = Array.isArray(card.paymentLinks) ? card.paymentLinks.filter((s) => s?.url) : [];
  const featuredLinks = card.featuredLinksEnabled && Array.isArray(card.featuredLinks)
    ? card.featuredLinks.filter((l) => l?.url?.trim() && l?.label?.trim())
    : [];

  // Menu (food trucks / venues) — compact preview with a "view full menu" toggle.
  const menu = Array.isArray(card.menu)
    ? card.menu.filter((c) => c?.name?.trim() && Array.isArray(c.items) && c.items.some((it) => it?.name?.trim()))
    : [];
  const menuItemCount = menu.reduce((n, c) => n + c.items.filter((it) => it?.name?.trim()).length, 0);
  const MENU_PREVIEW_ITEMS = 6;
  const visibleMenu = (() => {
    if (menuExpanded) return menu;
    const out: typeof menu = [];
    let count = 0;
    for (const cat of menu) {
      if (count >= MENU_PREVIEW_ITEMS) break;
      const items = cat.items.filter((it) => it?.name?.trim()).slice(0, MENU_PREVIEW_ITEMS - count);
      if (items.length) { out.push({ ...cat, items }); count += items.length; }
    }
    return out;
  })();

  const fontFamily = card.customFontUrl ? "'CustomFont', sans-serif" : (card.fontFamily || 'Manrope');
  const fontScale = card.fontSizeScale || 1;
  const sfs = (px: number) => `${Math.round(px * fontScale)}px`;

  const pageBg = card.pageBgColor || undefined;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: pageBg }}>
      {!card.hideNavbar && (
        <Navbar onAuthClick={() => setAuthOpen(true)} />
      )}

      {/* Card stage — stacked on mobile, side-by-side on desktop */}
      <div className={`flex-1 flex flex-col lg:flex-row lg:justify-center lg:gap-12 items-center px-5 pb-8 ${card.hideNavbar ? 'pt-8' : 'pt-2'}`}>
        <div className="w-full max-w-[380px] aspect-[2/3.5] perspective-1200 relative">
          <div className={`w-full h-full preserve-3d transition-transform duration-[800ms] ${flipped ? 'rotate-y-180' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }} onClick={handleFlip} onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); } }} role="button" aria-label="Flip card" tabIndex={0}>
            {/* Front */}
            <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
              {card.backgroundImage && (
                <>
                  <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
                  <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundColor: tc.overlayBg, opacity: bgOpacity }} />
                </>
              )}
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-5 text-center overflow-y-auto" style={{ fontFamily }}>
                {/* Profile */}
                <div className="mb-4">
                  {card.profileImage ? (
                    <div className={`overflow-hidden border-[3px] shadow-lg mx-auto ${profileShapeClass}`} style={{ width: profileSizePx, height: profileSizePx, borderColor: accent }}>
                      <img src={card.profileImage} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`flex items-center justify-center font-extrabold border-[3px] shadow-lg mx-auto ${profileShapeClass} ${tc.profileFallbackBg} ${tc.profileFallbackText}`} style={{ width: profileSizePx, height: profileSizePx, ...textColorStyle, borderColor: accent, fontSize: sfs(profileFontSize) }}>
                      {init}
                    </div>
                  )}
                </div>

                {/* Name / org */}
                <div className="mb-4">
                  {card.nameLayout === 'business' && card.company ? (
                    <>
                      <h1 className={`font-extrabold leading-tight tracking-tight m-0 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{card.company}</h1>
                      {name && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>{name}{card.jobTitle ? ` · ${card.jobTitle}` : ''}</div>}
                    </>
                  ) : (
                    <>
                      <h1 className={`font-extrabold leading-tight tracking-tight m-0 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{name || 'Anonymous'}</h1>
                      {org && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>{org}</div>}
                    </>
                  )}
                </div>

                {/* Bio — separate section below header break */}
                {card.bio && (
                  <>
                    <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />
                    <div className={`w-full max-w-[260px] mx-auto rounded-xl px-4 py-3 mb-2 ${isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-black/[0.03] border border-black/[0.06]'}`}>
                      <div className={`leading-relaxed ${tc.textMuted}`} style={{ ...textColorStyle, fontSize: sfs(12) }}>{card.bio}</div>
                    </div>
                  </>
                )}

                <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />

                {/* Contact links */}
                <div className="flex flex-col gap-2 items-center w-full">
                  {phones.map((p, i) => (
                    <a key={`p-${i}`} href={`tel:${p.number}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('call'); }}>
                      <IconPhone /> {p.number}
                    </a>
                  ))}
                  {emails.map((e, i) => (
                    <a key={`e-${i}`} href={`mailto:${e.address}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('email'); }}>
                      <IconMail /> {e.address}
                    </a>
                  ))}
                  {websites.map((w, i) => (
                    <a key={`w-${i}`} href={w.url?.startsWith('http') ? w.url : `https://${w.url}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('website'); }}>
                      <IconGlobe /> {w.url}
                    </a>
                  ))}
                  {addrs.map((a, i) => {
                    const line = formatAddress(a);
                    return line ? (
                      <a key={`a-${i}`} href={`https://maps.google.com/?q=${encodeURIComponent(line)}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: sfs(13) }} onClick={(e) => { e.stopPropagation(); track('map'); }}>
                        <IconPin /> {line}
                      </a>
                    ) : null;
                  })}
                </div>

                {/* Social wordmark buttons */}
                {socials.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center pt-5">
                    {socials.map((s, i) => (
                      <a
                        key={`s-${i}`}
                        href={s.url?.startsWith('http') ? s.url : `https://${s.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border no-underline transition-colors ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`}
                        style={{ ...textColorStyle, fontSize: sfs(11) }}
                        onClick={(e) => { e.stopPropagation(); track(`social:${s.platform}`); }}
                      >
                        {PLAT[s.platform.toLowerCase()] || s.platform}
                      </a>
                    ))}
                  </div>
                )}
                {paymentLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center pt-3">
                    {paymentLinks.map((s, i) => (
                      <a
                        key={`pay-${i}`}
                        href={s.url?.startsWith('http') ? s.url : `https://${s.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors no-underline"
                        style={{ ...textColorStyle, fontSize: sfs(11) }}
                        onClick={(e) => { e.stopPropagation(); track(`payment:${s.platform}`); }}
                      >
                        {PAYMENT_PLAT[s.platform.toLowerCase()] || s.platform}
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <p className={`mt-3 text-[11px] w-full text-center ${tc.textMuted}`} style={{ ...textColorStyle, fontFamily }}>Tap to flip · QR on back</p>
            </div>

            {/* Back */}
            <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ transform: 'rotateY(180deg) translateZ(3px)', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
              {(card.backBackgroundImage || card.backgroundImage) && (
                <>
                  <div className="absolute inset-0" style={{ backgroundImage: `url('${card.backBackgroundImage || card.backgroundImage}')`, backgroundPosition: card.backBgPosition || card.bgPosition || 'center', backgroundSize: card.backBgZoom ? `${card.backBgZoom}% auto` : bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.backBgRotation ?? card.bgRotation ?? 0}deg)` }} />
                  <div className="absolute inset-0" style={{ backgroundColor: tc.overlayBg, opacity: bgOpacity }} />
                </>
              )}
              <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-7 text-center" style={{ fontFamily }}>
                <div className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontFamily, fontSize: sfs(18) }}>{name || 'Contact'}</div>
                <div className={`mb-5 ${tc.qrSub}`} style={{ ...textColorStyle, fontFamily, fontSize: sfs(12) }}>{card.qrMode === 'vcard' ? 'Scan to add contact' : 'Scan to save'}</div>
                <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                  <QRCodeSVG value={card.qrMode === 'vcard' ? generateVCard(card, cardUrl) : cardUrl} size={150} level="M" includeMargin={false} />
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  <button onClick={(e) => { e.stopPropagation(); handleSaveContact(); }} className="btn btn-primary btn-md">
                    Save Contact
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); const promise = shareNative({ title: name, url: cardUrl }); if (!promise) { setShareOpen(true); } else { promise.then(() => track('share')).catch(() => setShareOpen(true)); } }} className="btn btn-secondary btn-md">
                    Share
                  </button>
                </div>
                {!card.hideLogo && <img src="/nowncard-logo.png" alt="" className="h-8 w-auto object-contain mt-4 opacity-70" />}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — actions + messaging; below card on mobile, right column on desktop */}
        <div className="w-full max-w-[380px] flex flex-col gap-6 mt-6 lg:mt-0">
        {/* Action bar — pinned below card */}
        <div className="flex flex-wrap gap-2.5 justify-center w-full">
          {isOwner && (
            <Link to={`/editor/${card.id}`} className="btn btn-secondary btn-lg no-underline">
              <Pencil className="w-4 h-4" /> Edit Card
            </Link>
          )}
          <button onClick={handleSaveContact} className="btn btn-primary btn-lg">
            <IconDownload /> Save to Contacts
          </button>
          {isIOSUA && (
            <button onClick={() => { downloadVCard(card, undefined, cardUrl); setVcfHelpOpen(true); }} className="btn btn-secondary btn-lg" title="Download the .vcf contact file to import manually">
              <IconDownload /> Download .vcf
            </button>
          )}
          {card.appointmentsEnabled && (
            <button onClick={() => setAppointmentOpen(true)} className="btn btn-secondary btn-lg">
              <Calendar className="w-4 h-4" /> Book
            </button>
          )}
          <button onClick={handleFlip} className="btn btn-secondary btn-lg">
            {flipped ? 'Show Card' : 'Show QR'}
          </button>
          <button onClick={() => { const promise = shareNative({ title: name, url: cardUrl }); if (!promise) { setShareOpen(true); return; } promise.then(() => track('share')).catch(() => setShareOpen(true)); }} className="btn btn-secondary btn-lg">
            Share
          </button>
          <button onClick={() => setSaveImageOpen(true)} className="btn btn-secondary btn-lg">
            <IconCamera /> Save Image
          </button>
        </div>

        {/* Messaging / Lead capture */}
        <div className="w-full">
          {card.leadFormEnabled ? (
            leadSent ? (
              <div className="bg-tile border border-emerald-500/30 rounded-2xl p-5 text-center">
                <p className="text-sm font-semibold text-emerald-400 mb-1">Thanks — message sent!</p>
                <p className="text-xs text-ink-muted">The card owner will get back to you.</p>
              </div>
            ) : (
              <div className="bg-tile border border-line rounded-2xl p-4">
                <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-3">Contact {name || 'us'}</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Your name" aria-label="Your name" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                  <input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="Email" aria-label="Email" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Phone (optional)" aria-label="Phone" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                  <input value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} placeholder="Company (optional)" aria-label="Company" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent" />
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="How can we help?"
                  aria-label="Message"
                  rows={3}
                  maxLength={2000}
                  className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent resize-none mb-3"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-ink-faint">{messageText.length}/2000</span>
                  <button
                    onClick={handleSubmitLead}
                    disabled={leadSending || !leadName.trim() || !leadEmail.trim() || !messageText.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    <IconSend />
                    {leadSending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            )
          ) : messageSent ? (
            <div className="bg-tile border border-emerald-500/30 rounded-2xl p-5 text-center">
              <p className="text-sm font-semibold text-emerald-400 mb-1">Message sent</p>
              <p className="text-xs text-ink-muted">The card owner will see your inquiry and reply directly.</p>
            </div>
          ) : (
            <div className="bg-tile border border-line rounded-2xl p-4">
              <div className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">Send an Inquiry</div>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Hi! I'd love to connect…"
                rows={3}
                maxLength={500}
                className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent resize-none mb-3"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-faint">{messageText.length}/500</span>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sendingMessage}
                  className="btn btn-primary btn-sm"
                >
                  <IconSend />
                  {sendingMessage ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Featured links (link tree) */}
        {featuredLinks.length > 0 && (
          <div className="w-full flex flex-col gap-2.5">
            <div className="text-xs font-bold text-ink-muted uppercase tracking-wider text-center">Links</div>
            {featuredLinks.map((l, i) => (
              <a
                key={`fl-${i}`}
                href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-lg w-full no-underline"
                onClick={() => track('link')}
              >
                {l.label}
                <ExternalLink className="w-3.5 h-3.5 text-ink-faint" />
              </a>
            ))}
          </div>
        )}

        {/* Menu (food trucks / venues) */}
        {menu.length > 0 && (() => {
          const MenuIcon = getMenuIcon(card.menuIcon);
          return (
          <div className="w-full flex flex-col gap-2.5">
            <div className="text-xs font-bold text-ink-muted uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
              {MenuIcon && <MenuIcon className="w-3.5 h-3.5" />} {card.menuTitle?.trim() || 'Menu'}
            </div>
            <div className="bg-tile border border-line rounded-2xl p-5">
              {visibleMenu.map((cat, ci) => (
                <div key={`mc-${ci}`} className={ci > 0 ? 'mt-4 pt-4 border-t border-line' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    {cat.image ? <img src={cat.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-line flex-shrink-0" /> : null}
                    <h2 className="text-sm font-bold text-ink">{cat.name}</h2>
                  </div>
                  <div className="flex flex-col">
                    {cat.items.map((item, ii) => (
                      <div key={`mi-${ci}-${ii}`} className="flex items-baseline justify-between gap-3 py-1.5">
                        <div className="min-w-0">
                          <div className="text-sm text-ink font-medium">{item.name}</div>
                          {item.description ? <div className="text-xs text-ink-muted">{item.description}</div> : null}
                        </div>
                        {item.price ? <div className="text-sm font-bold text-accent whitespace-nowrap">{item.price}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {menuItemCount > MENU_PREVIEW_ITEMS && (
                <button
                  onClick={() => { setMenuExpanded((s) => !s); track('menu'); }}
                  className="mt-3 w-full text-sm font-semibold text-accent hover:underline cursor-pointer flex items-center justify-center gap-1"
                >
                  {menuExpanded ? 'Show less' : `View full menu (${menuItemCount} items)`}
                  <ChevronDown className={`w-4 h-4 transition-transform ${menuExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          </div>
          );
        })()}
        </div>
      </div>

      <Footer compact />

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
        error={authError}
        isAuthenticated={!!user}
      />

      {card && (
        <AppointmentModal
          key={String(appointmentOpen)}
          open={appointmentOpen}
          onClose={() => setAppointmentOpen(false)}
          card={card}
        />
      )}

      <ImportVCardModal
        open={vcfHelpOpen}
        onClose={() => setVcfHelpOpen(false)}
        platform={isAndroidUA ? 'android' : 'ios'}
      />

      <SaveImageModal
        open={saveImageOpen}
        onClose={() => setSaveImageOpen(false)}
        card={card}
        name={name}
        onTrack={track}
      />
    </div>
  );
}
