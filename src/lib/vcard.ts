import type { Card } from '@/types';

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
