import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { downloadVCard, generateVCard } from '@/lib/vcard';
import { shareNative, initials, fullName, orgLine, formatAddress, PLAT, PAYMENT_PLAT } from '@/lib/utils';
import type { Card } from '@/types';
import { IconPhone, IconMail, IconGlobe, IconPin } from '@/components/CardIcons';
import { useCardTheme } from '@/hooks/useCardTheme';

interface LiveCardPreviewProps {
  card: Partial<Card>;
  className?: string;
}

export default function LiveCardPreview({ card, className = '' }: LiveCardPreviewProps) {
  const [flipped, setFlipped] = useState(false);

  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const cardUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://nowncard.com'}/card/${card.slug || 'preview'}`;

  const phones = (card.phones || []).filter((p) => p.number?.trim());
  const emails = (card.emails || []).filter((e) => e.address?.trim());
  const websites = (card.websites || []).filter((w) => w.url?.trim());
  const addrs = (card.addresses || []).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());
  const socials = (Array.isArray(card.socialLinks) ? card.socialLinks : []).filter((s) => s?.url);
  const paymentLinks = (Array.isArray(card.paymentLinks) ? card.paymentLinks : []).filter((s) => s?.url);

  const fontFamily = card.customFontUrl ? "'EditorCustomFont', sans-serif" : (card.fontFamily || 'Manrope');
  const fontScale = card.fontSizeScale || 1;
  const sfs = (px: number) => `${Math.round(px * fontScale)}px`;

  const { isDark, accent, primaryTextColor, textColorStyle, profileSizePx, profileShapeClass, profileFontSize, isHeaderBg, bgOpacity, bgSizeStyle, tc } = useCardTheme({ card });

  const handleFlip = () => setFlipped((f) => !f);

  return (
    <div className={`w-full max-w-[380px] mx-auto ${className}`}>
      <div className="w-full aspect-[2/3.5] perspective-1200 relative cursor-pointer" onClick={handleFlip} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFlip(); } }} role="button" aria-label="Flip card preview" tabIndex={0}>
        <div className={`w-full h-full preserve-3d transition-transform duration-[800ms] ${flipped ? 'rotate-y-180' : ''}`} style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          {/* Front */}
          <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg }}>
            {card.backgroundImage && (
              <>
                <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
                <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundColor: isDark ? '#12121a' : '#f4f1ec', opacity: bgOpacity }} />
              </>
            )}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pb-5 text-center overflow-y-auto" style={{ fontFamily }}>
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

              <div className="mb-4">
                {card.nameLayout === 'business' && card.company ? (
                  <>
                    <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{card.company}</div>
                    {name && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>{name}{card.jobTitle ? ` · ${card.jobTitle}` : ''}</div>}
                  </>
                ) : (
                  <>
                    <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{name || 'Your Name'}</div>
                    {org && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>{org}</div>}
                  </>
                )}
              </div>

              {card.bio && (
                <>
                  <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />
                  <div className={`w-full max-w-[260px] mx-auto rounded-xl px-4 py-3 mb-2 ${isDark ? 'bg-white/[0.04] border border-white/[0.06]' : 'bg-black/[0.03] border border-black/[0.06]'}`}>
                    <div className={`leading-relaxed ${tc.textMuted}`} style={{ ...textColorStyle, fontSize: sfs(12) }}>{card.bio}</div>
                  </div>
                </>
              )}

              <div className="h-px w-full my-2" style={{ background: `linear-gradient(to right, transparent, ${tc.divider}, transparent)` }} />

              <div className="flex flex-col gap-2 items-center w-full">
                {phones.map((p, i) => (
                  <span key={`p-${i}`} className={`flex items-center gap-2.5 rounded-md px-1.5 py-0.5 ${tc.linkText}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>
                    <IconPhone /> {p.number}
                  </span>
                ))}
                {emails.map((e, i) => (
                  <span key={`e-${i}`} className={`flex items-center gap-2.5 rounded-md px-1.5 py-0.5 ${tc.linkText}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>
                    <IconMail /> {e.address}
                  </span>
                ))}
                {websites.map((w, i) => (
                  <span key={`w-${i}`} className={`flex items-center gap-2.5 rounded-md px-1.5 py-0.5 ${tc.linkText}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>
                    <IconGlobe /> {w.url}
                  </span>
                ))}
                {addrs.map((a, i) => {
                  const line = formatAddress(a);
                  return line ? (
                    <span key={`a-${i}`} className={`flex items-center gap-2.5 rounded-md px-1.5 py-0.5 ${tc.linkText}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>
                      <IconPin /> {line}
                    </span>
                  ) : null;
                })}
              </div>

              {socials.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center pt-5">
                  {socials.map((s, i) => (
                    <span
                      key={`s-${i}`}
                      className={`px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`}
                      style={{ ...textColorStyle, fontSize: sfs(11) }}
                    >
                      {PLAT[s.platform.toLowerCase()] || s.platform}
                    </span>
                  ))}
                </div>
              )}
              {paymentLinks.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center pt-3">
                  {paymentLinks.map((s, i) => (
                    <span
                      key={`pay-${i}`}
                      className={`px-3 py-1.5 rounded-full font-bold lowercase tracking-wide border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors`}
                      style={{ ...textColorStyle, fontSize: sfs(11) }}
                    >
                      {PAYMENT_PLAT[s.platform.toLowerCase()] || s.platform}
                    </span>
                  ))}
                </div>
              )}
              </div>
            </div>

          {/* Back */}
          <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ transform: 'rotateY(180deg) translateZ(3px)', backgroundColor: tc.faceBg }}>
            {(card.backBackgroundImage || card.backgroundImage) && (
              <>
                <div className="absolute inset-0" style={{ backgroundImage: `url('${card.backBackgroundImage || card.backgroundImage}')`, backgroundPosition: card.backBgPosition || card.bgPosition || 'center', backgroundSize: card.backBgZoom ? `${card.backBgZoom}% auto` : bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.backBgRotation ?? card.bgRotation ?? 0}deg)` }} />
                <div className="absolute inset-0" style={{ backgroundColor: isDark ? '#12121a' : '#f4f1ec', opacity: bgOpacity }} />
              </>
            )}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-7 text-center" style={{ fontFamily }}>
              <div className={`font-extrabold mb-1 ${tc.textPrimary}`} style={{ color: primaryTextColor, fontFamily, fontSize: sfs(18) }}>{name || 'Contact'}</div>
              <div className={`mb-5 ${tc.qrSub}`} style={{ ...textColorStyle, fontFamily, fontSize: sfs(12) }}>{card.qrMode === 'vcard' ? 'Scan to add contact' : 'Scan to save'}</div>
              <div className="bg-white rounded-xl p-3 shadow-sm mb-5">
                <QRCodeSVG value={card.qrMode === 'vcard' ? generateVCard(card, cardUrl) : cardUrl} size={150} level="M" includeMargin={false} />
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={(e) => { e.stopPropagation(); downloadVCard(card, undefined, cardUrl); }} className="btn btn-primary btn-md">
                  Save Contact
                </button>
                <button onClick={(e) => { e.stopPropagation(); const promise = shareNative({ title: name, url: cardUrl }); if (promise) promise.catch(() => {}); }} className="btn btn-secondary btn-md">
                  Share
                </button>
              </div>
              {!card.hideLogo && <img src="/nowncard-logo.png" alt="" className="h-8 w-auto object-contain mt-4 opacity-70" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
