import type { Appointment, Card } from '@/types';

function toUTCDate(dateStr: string, timeStr: string, timezone: string): Date {
  // Interpret the wall-clock date/time as being in the given IANA timezone
  // (or the browser's local timezone when 'local'/unset) and return the UTC instant.
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  try {
    if (timezone && timezone !== 'local') {
      const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes));
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = fmt.formatToParts(utcGuess);
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const hour = get('hour') === 24 ? 0 : get('hour');
      const wallInTz = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
      const offset = wallInTz - utcGuess.getTime();
      return new Date(utcGuess.getTime() - offset);
    }
  } catch {
    // Invalid timezone string — fall back to browser-local interpretation.
  }
  return new Date(year, month - 1, day, hours, minutes);
}

function formatICSStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function generateICS(appointment: Appointment, card: Card): string {
  const startDate = toUTCDate(appointment.requestedDate, appointment.requestedTime, appointment.timezone);
  const endDate = new Date(startDate.getTime() + (appointment.durationMinutes || 30) * 60 * 1000);
  const name = `${card.firstName || ''} ${card.lastName || ''}`.trim() || card.slug || 'Contact';
  const summary = `Appointment with ${name}`;
  // ICS encodes line breaks inside property values as the two characters \n
  const description = `Appointment requested via NownCard for ${name}${appointment.notes ? `\\n\\nNotes: ${appointment.notes}` : ''}`;
  const location = card.company || '';
  const uid = `${appointment.id}@nowncard.com`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NownCard//Appointment//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSStamp(new Date())}`,
    `DTSTART:${formatICSStamp(startDate)}`,
    `DTEND:${formatICSStamp(endDate)}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    `ORGANIZER;CN=${escapeICS(name)}:mailto:${card.emails?.[0]?.address || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  // RFC 5545 requires real CRLF line endings
  return lines.join('\r\n');
}

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function googleCalendarUrl(appointment: Appointment, card: Card): string {
  const name = `${card.firstName || ''} ${card.lastName || ''}`.trim() || card.slug || 'Contact';
  const startDate = toUTCDate(appointment.requestedDate, appointment.requestedTime, appointment.timezone);
  const endDate = new Date(startDate.getTime() + (appointment.durationMinutes || 30) * 60 * 1000);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Appointment with ${name}`,
    dates: `${formatICSStamp(startDate)}/${formatICSStamp(endDate)}`,
    details: `Appointment requested via NownCard for ${name}${appointment.notes ? `\n\nNotes: ${appointment.notes}` : ''}`,
  });

  if (card.emails?.[0]?.address) {
    params.set('add', card.emails[0].address);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(appointment: Appointment, card: Card): string {
  const name = `${card.firstName || ''} ${card.lastName || ''}`.trim() || card.slug || 'Contact';
  const startDate = toUTCDate(appointment.requestedDate, appointment.requestedTime, appointment.timezone);
  const endDate = new Date(startDate.getTime() + (appointment.durationMinutes || 30) * 60 * 1000);

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: `Appointment with ${name}`,
    startdt: startDate.toISOString(),
    enddt: endDate.toISOString(),
    body: `Appointment requested via NownCard for ${name}${appointment.notes ? `\n\nNotes: ${appointment.notes}` : ''}`,
  });

  if (card.emails?.[0]?.address) {
    params.set('add', card.emails[0].address);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function downloadICS(appointment: Appointment, card: Card, filename?: string): void {
  const ics = generateICS(appointment, card);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `appointment-${appointment.requestedDate}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
