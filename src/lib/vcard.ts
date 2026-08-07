import type { Card } from '@/types';
import { fullName } from './utils';

function escVCard(val: string): string {
  return val.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

export function generateVCard(card: Card | Partial<Card>, cardPageUrl?: string): string {
  const parts: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const name = [];
  if (card.lastName) name.push(escVCard(card.lastName)); else name.push('');
  if (card.firstName) name.push(escVCard(card.firstName)); else name.push('');
  if (card.middleName) name.push(escVCard(card.middleName)); else name.push('');
  if (card.prefix) name.push(escVCard(card.prefix)); else name.push('');
  if (card.suffix) name.push(escVCard(card.suffix)); else name.push('');
  parts.push(`N:${name.join(';')}`);

  const fn = [];
  if (card.prefix) fn.push(escVCard(card.prefix));
  if (card.firstName) fn.push(escVCard(card.firstName));
  if (card.middleName) fn.push(escVCard(card.middleName));
  if (card.lastName) fn.push(escVCard(card.lastName));
  if (card.suffix) fn.push(escVCard(card.suffix));
  parts.push(`FN:${fn.join(' ')}`);

  if (card.nickname) parts.push(`NICKNAME:${escVCard(card.nickname)}`);
  if (card.jobTitle) parts.push(`TITLE:${escVCard(card.jobTitle)}`);
  if (card.company) parts.push(`ORG:${escVCard(card.company)}${card.department ? `;${escVCard(card.department)}` : ''}`);
  if (card.bio) parts.push(`NOTE:${escVCard(card.bio).replace(/\n/g, '\\n')}`);

  if (card.phones?.length) {
    card.phones.forEach((p) => {
      parts.push(`TEL;TYPE=${(p.type || 'CELL').toUpperCase()}:${p.number}`);
    });
  } else if (card.phone) {
    parts.push(`TEL;TYPE=CELL:${card.phone}`);
  }

  if (card.emails?.length) {
    card.emails.forEach((e) => {
      parts.push(`EMAIL;TYPE=${(e.type || 'WORK').toUpperCase()}:${e.address}`);
    });
  } else if (card.email) {
    parts.push(`EMAIL;TYPE=WORK:${card.email}`);
  }

  if (card.websites?.length) {
    card.websites.forEach((w) => {
      if (!w.url) return;
      const url = w.url.startsWith('http') ? w.url : `https://${w.url}`;
      parts.push(`URL:${url}`);
    });
  } else if (card.website) {
    const url = card.website.startsWith('http') ? card.website : `https://${card.website}`;
    parts.push(`URL:${url}`);
  }

  if (card.addresses?.length) {
    card.addresses.forEach((a) => {
      parts.push(`ADR;TYPE=${(a.type || 'WORK').toUpperCase()}:;;${escVCard(a.street || '')};${escVCard(a.city || '')};${escVCard(a.state || '')};${escVCard(a.zip || '')};${escVCard(a.country || '')}`);
    });
  }

  if (card.birthday) parts.push(`BDAY:${card.birthday}`);
  if (card.profileImage) parts.push(`PHOTO;VALUE=URI:${card.profileImage}`);

  if (Array.isArray(card.socialLinks)) {
    card.socialLinks.forEach((s) => {
      if (s.url) parts.push(`X-SOCIALPROFILE;TYPE=${s.platform.toUpperCase()}:${s.url}`);
    });
  }

  if (cardPageUrl) {
    parts.push(`URL:${cardPageUrl}`);
  }

  parts.push('END:VCARD');
  return parts.join('\r\n');
}

export function downloadVCard(card: Card | Partial<Card>, filename?: string, cardPageUrl?: string) {
  const vcard = generateVCard(card, cardPageUrl);
  const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${card.slug || 'contact'}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// "Save to Contacts" — minimize taps between button press and the contact
// landing in the phone's address book.
//
// Android (Chromium browsers): fire an android.intent.action.INSERT intent so
//   the native contact editor opens pre-filled — the user only taps "Save".
// iOS: open the vCard in a new tab — Safari presents its native contact sheet
//   (or downloads the .vcf, still fewer steps than an explicit file import).
// Everything else: download the .vcf (previous behavior).
// ---------------------------------------------------------------------------
function vcardFilename(card: Card | Partial<Card>): string {
  return `${card.slug || 'contact'}.vcf`;
}

export function saveToContacts(card: Card | Partial<Card>, cardPageUrl?: string): void {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iP(hone|od|ad)/i.test(ua);

  if (isAndroid && !/Firefox/i.test(ua)) {
    openAndroidContactEditor(card, cardPageUrl);
    return;
  }

  if (isIOS) {
    const vcard = generateVCard(card, cardPageUrl);
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) downloadVCard(card, vcardFilename(card), cardPageUrl);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  downloadVCard(card, vcardFilename(card), cardPageUrl);
}

function openAndroidContactEditor(card: Card | Partial<Card>, cardPageUrl?: string): void {
  const name = fullName(card) || 'Contact';
  const phone = card.phones?.[0]?.number || card.phone || '';
  const email = card.emails?.[0]?.address || card.email || '';
  const company = card.company || '';
  const jobTitle = card.jobTitle || '';
  const notes = [card.bio, cardPageUrl ? `Shared via NownCard: ${cardPageUrl}` : ''].filter(Boolean).join('\n');

  const extras = [
    `S.name=${encodeURIComponent(name)}`,
    phone ? `S.phone=${encodeURIComponent(phone)}` : '',
    email ? `S.email=${encodeURIComponent(email)}` : '',
    company ? `S.company=${encodeURIComponent(company)}` : '',
    jobTitle ? `S.job_title=${encodeURIComponent(jobTitle)}` : '',
    notes ? `S.notes=${encodeURIComponent(notes)}` : '',
    cardPageUrl ? `S.browser_fallback_url=${encodeURIComponent(cardPageUrl)}` : '',
  ].filter(Boolean).join(';');

  const intentUrl = `intent://contact#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/contact;${extras};end`;
  const a = document.createElement('a');
  a.href = intentUrl;
  a.click();
}
