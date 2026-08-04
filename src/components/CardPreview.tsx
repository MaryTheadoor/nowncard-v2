import { initials, fullName, orgLine, formatAddress, PLAT } from '@/lib/utils';
import type { Card } from '@/types';
import { useCardTheme } from '@/hooks/useCardTheme';
import { IconPhone, IconMail, IconGlobe, IconPin } from '@/components/CardIcons';

interface CardPreviewProps {
  card: Partial<Card>;
  className?: string;
}

export default function CardPreview({ card, className = '' }: CardPreviewProps) {
  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);

  const phones = (card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : [])).filter((p) => p.number?.trim());
  const emails = (card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : [])).filter((e) => e.address?.trim());
  const websites = (card.websites?.length ? card.websites : (card.website ? [{ type: 'Work', url: card.website }] : [])).filter((w) => w.url?.trim());
  const addrs = (card.addresses?.length ? card.addresses : (card.address ? [{ type: 'work', street: card.address }] : [])).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());

  let socials: { platform: string; url: string }[] = [];
  if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
  else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
    socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));

  const fontFamily = card.customFontUrl ? "'EditorCustomFont', sans-serif" : (card.fontFamily || 'Manrope');
  const fontScale = card.fontSizeScale || 1;
  const sfs = (px: number) => `${Math.round(px * fontScale)}px`;

  const { isDark, accent, primaryTextColor, textColorStyle, profileSizePx, profileShapeClass, profileFontSize, isHeaderBg, bgOpacity, bgSizeStyle, tc } = useCardTheme({ card });

  return (
    <div className={`w-full max-w-[380px] mx-auto aspect-[2/3.5] perspective-1200 relative ${className}`}>
      <div className="w-full h-full preserve-3d" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        {/* Front */}
        <div className={`card-face flex flex-col ${!card.cardBgColor && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg }}>
          {card.backgroundImage && (
            <>
              <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: bgSizeStyle, backgroundRepeat: 'no-repeat', transform: `rotate(${card.bgRotation || 0}deg)` }} />
              <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[40%]' : 'absolute inset-0'} style={{ backgroundColor: isDark ? '#12121a' : '#f4f1ec', opacity: bgOpacity }} />
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

            {/* Name / org / bio */}
            <div className="mb-4">
              {card.nameLayout === 'business' && card.company ? (
                <>
                  <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{card.company}</div>
                  {name && <div className={`font-semibold mt-1 ${tc.textSecondary}`} style={{ ...textColorStyle, fontSize: sfs(13) }}>{name}{card.jobTitle ? ` · ${card.jobTitle}` : ''}</div>}
                </>
              ) : (
                <>
                  <div className={`font-extrabold leading-tight tracking-tight ${tc.textPrimary}`} style={{ color: primaryTextColor, fontSize: sfs(22) }}>{name || 'Anonymous'}</div>
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

            {/* Contact links */}
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

            {/* Social wordmark buttons */}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center pt-5">
                {socials.map((s, i) => (
                  <span
                    key={`s-${i}`}
                    className={`px-3 py-1.5 rounded-md font-bold uppercase tracking-wide border ${tc.socialBorder} ${tc.socialText} ${tc.socialHoverBg} ${tc.socialHoverText}`}
                    style={{ ...textColorStyle, fontSize: sfs(11) }}
                  >
                    {PLAT[s.platform.toLowerCase()] || s.platform}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
