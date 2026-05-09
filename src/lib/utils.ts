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
  if (card.department) parts.push(card.department);
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

export function timeAgo(date: Date | number | { toMillis?: () => number } | unknown): string {
  let ts: number;
  if (date instanceof Date) ts = date.getTime();
  else if (typeof date === 'number') ts = date;
  else if (date && typeof date === 'object' && 'toMillis' in date && typeof (date as { toMillis: () => number }).toMillis === 'function') ts = (date as { toMillis: () => number }).toMillis();
  else return '';
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function compressImage(file: File, maxWidth = 800, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Compression failed'));
      }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}
