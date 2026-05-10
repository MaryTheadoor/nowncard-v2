import { initials, fullName, orgLine, formatAddress, isLightBg } from '@/lib/utils';
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

interface CardPreviewProps {
  card: Partial<Card>;
  className?: string;
}

export default function CardPreview({ card, className = '' }: CardPreviewProps) {
  const name = fullName(card);
  const init = initials(card.firstName, card.lastName);
  const org = orgLine(card);
  const accent = card.accentColor || '#c9a278';

  const phones = (card.phones?.length ? card.phones : (card.phone ? [{ type: 'cell', number: card.phone }] : [])).filter((p) => p.number?.trim());
  const emails = (card.emails?.length ? card.emails : (card.email ? [{ type: 'work', address: card.email }] : [])).filter((e) => e.address?.trim());
  const websites = (card.websites?.length ? card.websites : (card.website ? [{ type: 'Work', url: card.website }] : [])).filter((w) => w.url?.trim());
  const addrs = (card.addresses?.length ? card.addresses : (card.address ? [{ type: 'work', street: card.address }] : [])).filter((a) => a.street?.trim() || a.city?.trim() || a.state?.trim() || a.zip?.trim() || a.country?.trim());

  let socials: { platform: string; url: string }[] = [];
  if (Array.isArray(card.socialLinks)) socials = card.socialLinks.filter((s) => s?.url);
  else if (typeof card.socialLinks === 'object' && card.socialLinks !== null)
    socials = Object.entries(card.socialLinks).filter(([, v]) => v).map(([k, v]) => ({ platform: k, url: v as string }));

  const hasCustomBg = !!card.cardBgColor;
  const isDark = hasCustomBg ? !isLightBg(card.cardBgColor!) : card.cardTheme === 'dark';
  const customBg = card.cardBgColor || undefined;
  const bgOpacity = card.bgOpacity ?? 0.6;

  const fontFamily = card.customFontUrl ? "'EditorCustomFont', sans-serif" : (card.fontFamily || 'Manrope');
  const fontScale = card.fontSizeScale || 1;
  const sfs = (px: number) => `${Math.round(px * fontScale)}px`;

  const primaryTextColor = card.textColor || (isDark ? '#f4f1ec' : '#1a1612');
  const textColorStyle = card.textColor ? { color: card.textColor } : undefined;
  const tc = {
    faceBg: customBg || (isDark ? '#12121a' : undefined),
    textPrimary: isDark ? 'text-[#f4f1ec]' : 'text-[#1a1612]',
    textSecondary: isDark ? 'text-[#9a9186]' : 'text-[#6b6256]',
    textMuted: isDark ? 'text-[#7a7166]' : 'text-[#7a7166]',
    linkText: isDark ? 'text-[#c9c3ba]' : 'text-[#4a4238]',
    linkHover: isDark ? 'hover:text-[#f4f1ec]' : 'hover:text-[#2a2520]',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(42,37,32,0.12)',
    socialBorder: isDark ? 'border-white/10' : 'border-[rgba(42,37,32,0.12)]',
    socialText: isDark ? 'text-[#9a9186]' : 'text-[#5a5046]',
    socialHoverBg: isDark ? 'hover:bg-white/5' : 'hover:bg-[rgba(42,37,32,0.06)]',
    socialHoverText: isDark ? 'hover:text-[#e8e4de]' : 'hover:text-[#2a2520]',
    profileFallbackBg: isDark ? 'bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e]' : 'bg-gradient-to-br from-[#d4cfc8] to-[#e8e4de]',
    profileFallbackText: isDark ? 'text-[#c9c3ba]' : 'text-[#6b6256]',
  };

  const profileSizePx = card.profileSize === 'small' ? 56 : card.profileSize === 'large' ? 88 : 72;
  const profileShapeClass = card.profileShape === 'rounded' ? 'rounded-2xl' : card.profileShape === 'square' ? 'rounded-none' : 'rounded-full';
  const profileFontSize = card.profileSize === 'small' ? 18 : card.profileSize === 'large' ? 26 : 22;
  const isHeaderBg = card.bgDisplayMode === 'header';

  return (
    <div className={`w-full max-w-[380px] mx-auto aspect-[2/3.5] perspective-1200 relative ${className}`}>
      <div className="w-full h-full preserve-3d" style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
        {/* Front */}
        <div className={`card-face flex flex-col ${!customBg && !isDark ? 'bg-card-bg' : ''}`} style={{ backgroundColor: tc.faceBg }}>
          {card.backgroundImage && (
            <>
              <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[45%]' : 'absolute inset-0'} style={{ backgroundImage: `url('${card.backgroundImage}')`, backgroundPosition: card.bgPosition || 'center', backgroundSize: card.bgSize || 'cover', backgroundRepeat: 'no-repeat' }} />
              <div className={isHeaderBg ? 'absolute top-0 left-0 right-0 h-[45%]' : 'absolute inset-0'} style={{ backgroundColor: isDark ? '#12121a' : '#f4f1ec', opacity: bgOpacity }} />
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
              {card.bio && <div className={`leading-relaxed mt-2 max-w-[260px] mx-auto ${tc.textMuted}`} style={{ ...textColorStyle, fontSize: sfs(12) }}>{card.bio}</div>}
            </div>

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
