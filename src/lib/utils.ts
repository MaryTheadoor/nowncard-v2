import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Card } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function initials(first?: string, last?: string): string {
  const f = (first || '').trim().charAt(0).toUpperCase();
  const l = (last || '').trim().charAt(0).toUpperCase();
  return f + l || '?';
}

export function fullName(card: Partial<Card>): string {
  const parts: string[] = [];
  if (card.prefix) parts.push(card.prefix);
  if (card.firstName) parts.push(card.firstName);
  if (card.middleName) parts.push(card.middleName);
  if (card.lastName) parts.push(card.lastName);
  if (card.suffix) parts.push(card.suffix);
  return parts.join(' ');
}

export function orgLine(card: Partial<Card>): string {
  const parts: string[] = [];
  if (card.jobTitle) parts.push(card.jobTitle);
  if (card.company) parts.push(card.company);
  return parts.join(' · ');
}

export function formatAddress(a: { street?: string; city?: string; state?: string; zip?: string; country?: string }): string {
  const parts: string[] = [];
  if (a.street) parts.push(a.street);
  if (a.city) parts.push(a.city);
  if (a.state) parts.push(a.state);
  if (a.zip) parts.push(a.zip);
  if (a.country) parts.push(a.country);
  return parts.join(', ');
}

export function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function shareNative(data: { title?: string; url: string }): Promise<void> | null {
  if (!navigator.share) return null;
  return navigator.share({ title: data.title || 'My NownCard', url: data.url });
}

export function getCardLimit(plan?: string): number {
  if (plan === 'business') return Infinity;
  if (plan === 'pro') return 5;
  return 1;
}

export function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const rgb = parseInt(clean, 16);
  if (isNaN(rgb)) return 1;
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function isLightBg(hex: string): boolean {
  return getLuminance(hex) > 0.5;
}

export const GOOGLE_FONTS = [
  { name: 'Manrope', value: 'Manrope' },
  { name: 'Inter', value: 'Inter' },
  { name: 'Playfair Display', value: 'Playfair Display' },
  { name: 'Oswald', value: 'Oswald' },
  { name: 'Roboto Mono', value: 'Roboto Mono' },
  { name: 'Lora', value: 'Lora' },
  { name: 'Bebas Neue', value: 'Bebas Neue' },
  { name: 'Poppins', value: 'Poppins' },
  { name: 'Space Grotesk', value: 'Space Grotesk' },
  { name: 'DM Sans', value: 'DM Sans' },
];

export function detectDevice(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|Android/i.test(ua)) return 'mobile';
  return 'desktop';
}
