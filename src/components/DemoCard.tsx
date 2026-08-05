import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { downloadVCard } from '@/lib/vcard';
import { shareNative, initials, fullName, orgLine, formatAddress, PLAT } from '@/lib/utils';
import type { Card } from '@/types';
import { IconPhone, IconMail, IconGlobe, IconPin } from '@/components/CardIcons';
import { useCardTheme } from '@/hooks/useCardTheme';

const DEMO_CARD: Partial<Card> = {
  id: 'demo',
  slug: 'jane-doe',
  prefix: '',
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
  accentColor: '#d4a34a',
  isPublic: true,
  socialLinks: [
    { platform: 'linkedin', url: 'https://linkedin.com/in/janedoe' },
    { platform: 'twitter', url: 'https://twitter.com/janedoe' },
    { platform: 'github', url: 'https://github.com/janedoe' },
  ],
};

const IconDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-[18px] h-[18px]"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10 12 15 17 10"/><path d="M12 15V3"/></svg>;

interface DemoCardProps {
  forceLight?: boolean;
}

export default function DemoCard({ forceLight }: DemoCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const card = forceLight ? { ...DEMO_CARD, cardTheme: 'light' as const, accentColor: '#d4a34a' } : DEMO_CARD;
  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://nowncard.com'}/card/${card.slug}`;

  const phones = (card.phones || []).filter((p) => p.number?.trim());
  const emails = (card.emails || []).filter((e) => e.address?.trim());
  const websites = (card.websites || []).filter((w) => w.url?.trim());
  const addrs = (card.addresses || []).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());
  const socials = (Array.isArray(card.socialLinks) ? card.socialLinks : []).filter((s) => s?.url);

  const { isDark, accent, primaryTextColor, textColorStyle, profileSizePx, profileShapeClass, profileFontSize, isHeaderBg, bgOpacity, bgSizeStyle, tc } = useCardTheme({ card, forceLight });

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
          <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
            {card.backgroundImage && (
              <>
                <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
                <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundColor: tc.overlayBg, opacity: bgOpacity }} />
              </>
            )}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-5 text-center overflow-y-auto" style={{ fontFamily: 'Manrope' }}>
              {/* Profile */}
              <div className="mb-4">
                <div className={`flex items-center justify-center font-extrabold border-[3px] shadow-lg mx-auto ${profileShapeClass} ${tc.profileFallbackBg} ${tc.profileFallbackText}`} style={{ width: profileSizePx, height: profileSizePx, ...textColorStyle, borderColor: accent, fontSize: profileFontSize }}>
                  {init}
                </div>
              </div>

              {/* Name / org */}
              <div className="mb-4">
                <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: 22 }}>{name}</div>
                {org && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: 13 }}>{org}</div>}
              </div>

              {/* Bio — separate section */}
              {card.bio && (
                <>
                  <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />
                  <div className={`w-full max-w-[260px] mx-auto rounded-xl px-4 py-3 mb-2 ${isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-black/[0.03] border border-black/[0.06]'}`}>
                    <div className={`leading-relaxed ${tc.textMuted}`} style={{ ...textColorStyle, fontSize: 12 }}>{card.bio}</div>
                  </div>
                </>
              )}

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
            </div>

          {/* Back */}
          <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ transform: 'rotateY(180deg) translateZ(3px)', backgroundColor: tc.faceBg, boxShadow: tc.faceShadow }}>
            {(card.backBackgroundImage || card.backgroundImage) && (
              <>
                <div className="absolute inset-0" style={{ backgroundImage: `url('${card.backBackgroundImage || card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
                <div className="absolute inset-0" style={{ backgroundColor: tc.overlayBg, opacity: bgOpacity }} />
              </>
            )}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-7 text-center" style={{ fontFamily: 'Manrope' }}>
              <div className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontFamily: 'Manrope', fontSize: 18 }}>{name}</div>
              <div className={`mb-5 ${tc.qrSub}`} style={{ ...textColorStyle, fontFamily: 'Manrope', fontSize: 12 }}>Scan to save</div>
              <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                <QRCodeSVG value={cardUrl} size={150} level="M" includeMargin={false} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={(e) => { e.stopPropagation(); handleSave(); }} className="px-4 py-2 rounded-full text-sm font-bold bg-accent text-space border-none hover:brightness-110 transition cursor-pointer">
                  Save Contact
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleShare(); }} className={`px-4 py-2 rounded-full text-sm font-bold bg-transparent border border-line hover:bg-tile-soft transition ${tc.textPrimary}`} style={{ color: primaryTextColor }}>
                  Share
                </button>
              </div>
              <img src="/nowncard-logo.png" alt="" className="h-8 w-auto object-contain mt-4 opacity-70" />
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
