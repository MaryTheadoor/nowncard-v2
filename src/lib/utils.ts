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
  return parts.join(', ');
}

export function slugify(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function shareCard(title?: string) {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: title || 'My NownCard', url });
  } else {
    navigator.clipboard.writeText(url);
  }
}
