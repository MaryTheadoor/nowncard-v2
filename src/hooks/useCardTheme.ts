import { useMemo } from 'react';
import { isLightBg } from '@/lib/utils';
import type { Card } from '@/types';

interface CardThemeParams {
  card: Partial<Card>;
  forceDark?: boolean;
  forceLight?: boolean;
}

interface CardThemeResult {
  isDark: boolean;
  accent: string;
  primaryTextColor: string;
  textColorStyle: Record<string, string> | undefined;
  profileSizePx: number;
  profileShapeClass: string;
  profileFontSize: number;
  isHeaderBg: boolean;
  bgOpacity: number;
  bgSizeStyle: string;
  tc: {
    faceBg: string;
    faceShadow: string | undefined;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    linkText: string;
    linkHover: string;
    divider: string;
    overlayBg: string;
    socialBorder: string;
    socialText: string;
    socialHoverBg: string;
    socialHoverText: string;
    qrSub: string;
    profileFallbackBg: string;
    profileFallbackText: string;
  };
}

export function useCardTheme({ card, forceDark, forceLight }: CardThemeParams): CardThemeResult {
  return useMemo(() => {
    const hasCustomBg = !!card.cardBgColor;
    const isDark = forceLight ? false : forceDark ? true
      : hasCustomBg ? !isLightBg(card.cardBgColor!)
      : card.cardTheme === 'dark';

    const accent = card.accentColor || '#f5b940';
    const customBg = card.cardBgColor || undefined;
    const primaryTextColor = card.textColor || (isDark ? '#f4f1ec' : '#1a1612');
    const textColorStyle = card.textColor ? { color: card.textColor } : undefined;
    const bgOpacity = card.bgOpacity ?? 0.6;
    const bgSizeStyle = card.bgZoom ? `${card.bgZoom}% auto` : (card.bgSize || 'cover');

    const profileSizePx = card.profileSize === 'small' ? 56 : card.profileSize === 'large' ? 88 : 72;
    const profileShapeClass = card.profileShape === 'rounded' ? 'rounded-2xl' : card.profileShape === 'square' ? 'rounded-none' : 'rounded-full';
    const profileFontSize = card.profileSize === 'small' ? 18 : card.profileSize === 'large' ? 26 : 22;
    const isHeaderBg = card.bgDisplayMode === 'header';

    const tc = {
      faceBg: customBg || (isDark ? '#12121a' : '#f4f1ec'),
      faceShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 60px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.4)' : undefined,
      textPrimary: isDark ? 'text-[#f4f1ec]' : 'text-[#1a1612]',
      textSecondary: isDark ? 'text-[#9a9186]' : 'text-[#6b6256]',
      textMuted: isDark ? 'text-[#a89f93]' : 'text-[#5f564c]',
      linkText: isDark ? 'text-[#c9c3ba]' : 'text-[#4a4238]',
      linkHover: isDark ? 'hover:text-[#f4f1ec]' : 'hover:text-[#2a2520]',
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(42,37,32,0.12)',
      overlayBg: isDark ? '#12121a' : '#f4f1ec',
      socialBorder: isDark ? 'border-white/10' : 'border-[rgba(42,37,32,0.12)]',
      socialText: isDark ? 'text-[#9a9186]' : 'text-[#5a5046]',
      socialHoverBg: isDark ? 'hover:bg-white/5' : 'hover:bg-[rgba(42,37,32,0.06)]',
      socialHoverText: isDark ? 'hover:text-[#e8e4de]' : 'hover:text-[#2a2520]',
      qrSub: isDark ? 'text-[#9a9186]' : 'text-[#5f564c]',
      profileFallbackBg: isDark ? 'bg-gradient-to-br from-[#2a2a3a] to-[#1a1a2e]' : 'bg-gradient-to-br from-[#d4cfc8] to-[#e8e4de]',
      profileFallbackText: isDark ? 'text-[#c9c3ba]' : 'text-[#6b6256]',
    };

    return {
      isDark, accent, primaryTextColor, textColorStyle,
      profileSizePx, profileShapeClass, profileFontSize,
      isHeaderBg, bgOpacity, bgSizeStyle, tc,
    };
  }, [card, forceDark, forceLight]);
}
