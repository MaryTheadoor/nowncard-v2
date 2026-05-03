import type { Card } from '@/types';

export function generateVCard(card: Card | Partial<Card>): string {
  const parts: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const name = [];
  if (card.lastName) name.push(card.lastName); else name.push('');
  if (card.firstName) name.push(card.firstName); else name.push('');
  if (card.middleName) name.push(card.middleName); else name.push('');
  if (card.prefix) name.push(card.prefix); else name.push('');
  if (card.suffix) name.push(card.suffix); else name.push('');
  parts.push(`N:${name.join(';')}`);

  const fn = [];
  if (card.prefix) fn.push(card.prefix);
  if (card.firstName) fn.push(card.firstName);
  if (card.middleName) fn.push(card.middleName);
  if (card.lastName) fn.push(card.lastName);
  if (card.suffix) fn.push(card.suffix);
  parts.push(`FN:${fn.join(' ')}`);

  if (card.nickname) parts.push(`NICKNAME:${card.nickname}`);
  if (card.jobTitle) parts.push(`TITLE:${card.jobTitle}`);
  if (card.company) parts.push(`ORG:${card.company}${card.department ? `;${card.department}` : ''}`);
  if (card.bio) parts.push(`NOTE:${card.bio.replace(/\n/g, '\\n')}`);

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

  if (card.website) {
    const url = card.website.startsWith('http') ? card.website : `https://${card.website}`;
    parts.push(`URL:${url}`);
  }

  if (card.addresses?.length) {
    card.addresses.forEach((a) => {
      parts.push(`ADR;TYPE=${(a.type || 'WORK').toUpperCase()}:;;${a.street || ''};${a.city || ''};${a.state || ''};${a.zip || ''};${a.country || ''}`);
    });
  }

  if (card.birthday) parts.push(`BDAY:${card.birthday}`);
  if (card.profileImage) parts.push(`PHOTO;VALUE=URI:${card.profileImage}`);

  if (Array.isArray(card.socialLinks)) {
    card.socialLinks.forEach((s) => {
      if (s.url) parts.push(`X-SOCIALPROFILE;TYPE=${s.platform.toUpperCase()}:${s.url}`);
    });
  }

  parts.push('END:VCARD');
  return parts.join('\r\n');
}

export function downloadVCard(card: Card | Partial<Card>, filename?: string) {
  const vcard = generateVCard(card);
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
