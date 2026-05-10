import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { downloadVCard } from '@/lib/vcard';
import { shareNative, initials, fullName, orgLine, formatAddress } from '@/lib/utils';
import type { Card } from '@/types';

const DEMO_CARD: Partial<Card> = {
  id: 'demo',
  slug: 'jane-doe',
  prefix: 'Dr.',
  firstName: 'Jane',
  lastName: 'Doe',
  jobTitle: 'Product Designer',
  company: 'NownCard',
  phones: [{ type: 'cell', number: '+1 555 123 4567' }],
  emails: [{ type: 'work', address: 'jane@example.com' }],
  websites: [{ type: 'Portfolio', url: 'https://jane.design' }],
  addresses: [{ type: 'work', street: '123 Design Ave', city: 'San Francisco', state: 'CA', zip: '94102', country: 'USA' }],
  bio: 'Building beautiful digital experiences. Always happy to connect.',
  cardTheme: 'dark',
  accentColor: '#c9a278',
  isPublic: true,
  socialLinks: [
    { platform: 'linkedin', url: 'https://linkedin.com/in/janedoe' },
    { platform: 'twitter', url: 'https://twitter.com/janedoe' },
    { platform: 'github', url: 'https://github.com/janedoe' },
  ],
};

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

export default function DemoCard() {
  const [flipped, setFlipped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const card = DEMO_CARD;
  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://nowncard.com'}/card/${card.slug}`;
  const accent = card.accentColor || '#c9a278';

  const phones = (card.phones || []).filter((p) => p.number?.trim());
  const emails = (card.emails || []).filter((e) => e.address?.trim());
  const websites = (card.websites || []).filter((w) => w.url?.trim());
  const addrs = (card.addresses || []).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());
  const socials = (Array.isArray(card.socialLinks) ? card.socialLinks : []).filter((s) => s?.url);

  const isDark = card.cardTheme === 'dark';
  const customBg = card.cardBgColor || undefined;

  const primaryTextColor = card.textColor || (isDark ? '#f4f1ec' : '#1a1612');
  const textColorStyle = card.textColor ? { color: card.textColor } : undefined;
  const tc = {
    faceBg: customBg || (isDark ? '#12121a' : '#f4f1ec'),
    faceShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)' : undefined,
    textPrimary: isDark ? 'text-[#f4f1ec]' : 'text-[#1a1612]',
    textSecondary: isDark ? 'text-[#9a9186]' : 'text-[#6b6256]',
    textMuted: isDark ? 'text-[#7a7166]' : 'text-[#7a7166]',
    linkText: isDark ? 'text-[#c9c3ba]' : 'text-[#4a4238]',
    linkHover: isDark ? 'hover:text-[#f4f1ec]' : 'hover:text-[#2a2520]',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(42,37,32,0.12)',
    overlayBg: isDark ? '#12121a' : '#f4f1ec',
    socialBorder: isDark ? 'border-white/10' : 'border-[rgba(42,37,32,0.12)]',
    socialText: isDark ? 'text-[#9a9186]' : 'text-[#5a5046]',
    socialHoverBg: isDark ? 'hover:bg-white/5' : 'hover:bg-[rgba(42,37,32,0.06)]',
    socialHoverText: isDark ? 'hover:text-[#e8e4de]' : 'hover:text-[#2a2520]',
    qrSub: isDark ? 'text-[#9a9186]' : 'text-[#7a7166]',
    profileFallbackBg: isDark ? 'bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e]' : 'bg-gradient-to-br from-[#d4cfc8] to-[#e8e4de]',
    profileFallbackText: isDark ? 'text-[#c9c3ba]' : 'text-[#6b6256]',
  };

  const handleFlip = () => setFlipped((f) => !f);

  const handleSave = () => {
    downloadVCard(card, undefined, cardUrl);
  };

  const handleShare = () => {
    const promise = shareNative({ title: name, url: cardUrl });
    if (!promise) {
      navigator.clipboard.writeText(cardUrl).catch(() => {});
      setShareOpen(true);
      setTimeout(() => setShareOpen(false), 2000);
    } else {
      promise.catch(() => {
        navigator.clipboard.writeText(cardUrl).catch(() => {});
        setShareOpen(true);
        setTimeout(() => setShareOpen(false), 2000);
      });
    }
  };

  return (
    <div className="w-full max-w-[380px] mx-auto">
      {/* Card stage */}
      <div className="w-full aspect-[2/3.5] perspective-1200 relative cursor-pointer" onClick={handleFlip} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); } }} role="button" aria-label="Flip demo card" tabIndex={0}>
        <div className={`w-full h-full preserve-3d transition-transform duration-[800ms] ${flipped ? 'rotate-y-180' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {/* Front */}
          <div className={`card-face flex flex-col ${!customBg && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-5 text-center overflow-y-auto" style={{ fontFamily: 'Manrope' }}>
              {/* Profile */}
              <div className="mb-4">
                <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center font-extrabold border-[3px] shadow-lg mx-auto ${tc.profileFallbackBg} ${tc.profileFallbackText}`} style={{ ...textColorStyle, borderColor: accent, fontSize: 22 }}>
                  {init}
                </div>
              </div>

              {/* Name / org / bio */}
              <div className="mb-4">
                <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: 22 }}>{name}</div>
                {org && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: 13 }}>{org}</div>}
                {card.bio && <div className={`leading-relaxed mt-2 max-w-[260px] mx-auto ${tc.textMuted}`} style={{ ...textColorStyle, fontSize: 12 }}>{card.bio}</div>}
              </div>

              <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />

              {/* Contact links */}
              <div className="flex flex-col gap-2 items-center w-full">
                {phones.map((p, i) => (
                  <a key={`p-${i}`} href={`tel:${p.number}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                    <IconPhone /> {p.number}
                  </a>
                ))}
                {emails.map((e, i) => (
                  <a key={`e-${i}`} href={`mailto:${e.address}`} className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                    <IconMail /> {e.address}
                  </a>
                ))}
                {websites.map((w, i) => (
                  <a key={`w-${i}`} href={w.url?.startsWith('http') ? w.url : `https://${w.url}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                    <IconGlobe /> {w.url}
                  </a>
                ))}
                {addrs.map((a, i) => {
                  const line = formatAddress(a);
                  return line ? (
                    <a key={`a-${i}`} href={`https://maps.google.com/?q=${encodeURIComponent(line)}`} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2.5 no-underline rounded-md px-1.5 py-0.5 transition-colors ${tc.linkText} ${tc.linkHover}`} style={{ ...textColorStyle, fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                      <IconPin /> {line}
                    </a>
                  ) : null;
                })}
              </div>

              {/* Social wordmark buttons */}
              {socials.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center pt-5">
                  {socials.map((s, i) => (
                    <span
                      key={`s-${i}`}
                      className={`px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border no-underline transition-colors ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`}
                      style={{ ...textColorStyle, fontSize: 11 }}
                    >
                      {PLAT[s.platform.toLowerCase()] || s.platform}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className={`mt-3 text-[11px] w-full text-center ${tc.textMuted}`} style={{ ...textColorStyle, fontFamily: 'Manrope' }}>Tap to flip · QR on back</p>
          </div>

          {/* Back */}
          <div className={`card-face flex flex-col ${!customBg && !isDark ? 'bg-card-bg' : ''}`} style={{ transform: 'rotateY(180deg) translateZ(3px)', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-7 text-center" style={{ fontFamily: 'Manrope' }}>
              <img src="/nowncard-logo.png" alt="" className="h-10 w-auto object-contain mb-3" />
              <div className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontFamily: 'Manrope', fontSize: 18 }}>{name}</div>
              <div className={`mb-5 ${tc.qrSub}`} style={{ ...textColorStyle, fontFamily: 'Manrope', fontSize: 12 }}>Scan to save</div>
              <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                <QRCodeSVG value={cardUrl} size={150} level="M" includeMargin={false} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="px-4 py-2 rounded-full text-sm font-bold bg-card-bg hover:brightness-105 transition" style={textColorStyle}>
                  Save Contact
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className={`px-4 py-2 rounded-full text-sm font-bold bg-transparent border border-line hover:bg-tile-soft transition ${tc.textPrimary}`} style={{ color: primaryTextColor }}>
                  Share
                </button>
              </div>
              <p className={`mt-4 text-[11px] w-full text-center ${tc.textMuted}`} style={{ ...textColorStyle, fontFamily: 'Manrope' }}>Tap to flip back</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2.5 justify-center mt-5 max-w-[380px] w-full mx-auto">
        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-accent text-space border-none cursor-pointer hover:brightness-110 transition">
          <IconDownload /> Save to Contacts
        </button>
        <button onClick={handleFlip} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-tile text-ink border border-line cursor-pointer hover:bg-tile-soft transition">
          {flipped ? 'Show Card' : 'Show QR'}
        </button>
        <button onClick={handleShare} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-tile text-ink border border-line cursor-pointer hover:bg-tile-soft transition">
          Share
        </button>
      </div>

      {/* Copied toast */}
      {shareOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-tile border border-line text-ink text-sm font-semibold px-4 py-2 rounded-full shadow-lg z-50">
          Link copied to clipboard
        </div>
      )}
    </div>
  );
}
