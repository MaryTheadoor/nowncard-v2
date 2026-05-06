import type { Card } from '@/types';

function vCardUnescape(val: string): string {
  return val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseVCardLine(line: string): { key: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx < 0) return null;
  const left = line.slice(0, colonIdx);
  const value = vCardUnescape(line.slice(colonIdx + 1).trim());
  const parts = left.split(';');
  const key = parts[0].trim().toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i].trim();
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toLowerCase()] = p.slice(eq + 1);
    else params[p.toLowerCase()] = 'true';
  }
  return { key, params, value };
}

export function parseVCard(text: string): Partial<Card> {
  const result: Partial<Card> = {
    phones: [],
    emails: [],
    websites: [],
    addresses: [],
    socialLinks: [],
  };

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const unfolded: string[] = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (unfolded.length > 0) unfolded[unfolded.length - 1] += line.trimStart();
    } else {
      unfolded.push(line);
    }
  }

  for (const raw of unfolded) {
    const parsed = parseVCardLine(raw);
    if (!parsed) continue;
    const { key, params, value } = parsed;
    const type = (params.type || params.type || '').toLowerCase();

    switch (key) {
      case 'N': {
        const parts = value.split(';');
        result.lastName = parts[0]?.trim() || undefined;
        result.firstName = parts[1]?.trim() || undefined;
        result.middleName = parts[2]?.trim() || undefined;
        result.prefix = parts[3]?.trim() || undefined;
        result.suffix = parts[4]?.trim() || undefined;
        break;
      }
      case 'FN':
        // Full name fallback — only use if firstName not set
        if (!result.firstName && !result.lastName) {
          const parts = value.split(' ');
          result.firstName = parts[0];
          result.lastName = parts.slice(1).join(' ');
        }
        break;
      case 'ORG': {
        const orgParts = value.split(';');
        result.company = orgParts[0]?.trim() || undefined;
        result.department = orgParts[1]?.trim() || undefined;
        break;
      }
      case 'TITLE':
        result.jobTitle = value || undefined;
        break;
      case 'TEL': {
        const phoneType = type || 'cell';
        result.phones!.push({ type: phoneType.charAt(0).toUpperCase() + phoneType.slice(1), number: value });
        break;
      }
      case 'EMAIL': {
        const emailType = type || 'work';
        result.emails!.push({ type: emailType.charAt(0).toUpperCase() + emailType.slice(1), address: value });
        break;
      }
      case 'URL': {
        const urlType = type || 'Work';
        result.websites!.push({ type: urlType.charAt(0).toUpperCase() + urlType.slice(1), url: value });
        break;
      }
      case 'ADR': {
        const adrParts = value.split(';');
        result.addresses!.push({
          type: (type || 'work').charAt(0).toUpperCase() + (type || 'work').slice(1),
          street: adrParts[2]?.trim() || undefined,
          city: adrParts[3]?.trim() || undefined,
          state: adrParts[4]?.trim() || undefined,
          zip: adrParts[5]?.trim() || undefined,
          country: adrParts[6]?.trim() || undefined,
        });
        break;
      }
      case 'BDAY':
        result.birthday = value || undefined;
        break;
      case 'NOTE':
        result.bio = value || undefined;
        break;
      case 'X-SOCIALPROFILE':
      case 'X-SOCIAL': {
        const platform = params.type || params.service || 'Website';
        (result.socialLinks as { platform: string; url: string }[]).push({ platform, url: value });
        break;
      }
    }
  }

  // Clean up empty arrays
  if (result.phones?.length === 0) delete result.phones;
  if (result.emails?.length === 0) delete result.emails;
  if (result.websites?.length === 0) delete result.websites;
  if (result.addresses?.length === 0) delete result.addresses;
  if (result.socialLinks?.length === 0) delete result.socialLinks;

  return result;
}
