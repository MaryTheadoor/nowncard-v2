import type { Appointment, Card } from '@/types';

function formatICSDate(dateStr: string, timeStr: string, timezone: string): string {
  // Build an ISO-like string from the user's selected date/time, then convert to UTC.
  // If the browser supports IANA timezone conversion we use it; otherwise fall back to local.
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  // Construct a date object treating the selected values as local to the given timezone.
  let start: Date;
  try {
    start = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    // If timezone is a valid IANA string, shift from UTC to that timezone's offset.
    if (timezone && timezone !== 'local' && Intl.DateTimeFormat().resolvedOptions().timeZone) {
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
      const parts = fmt.formatToParts(start);
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const localInTz = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
      const offset = localInTz.getTime() - start.getTime();
      start = new Date(start.getTime() - offset);
    }
  } catch {
    start = new Date(year, month - 1, day, hours, minutes);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${start.getUTCFullYear()}${pad(start.getUTCMonth() + 1)}${pad(start.getUTCDate())}T${pad(start.getUTCHours())}${pad(start.getUTCMinutes())}${pad(start.getUTCSeconds())}Z`;
}

function formatDateTimeLocal(dateStr: string, timeStr: string): { start: string; end: string } {
  const start = formatICSDate(dateStr, timeStr, 'local');
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const endDate = new Date(year, month - 1, day, hours, minutes);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}Z`;
  return { start, end };
}

export function generateICS(appointment: Appointment, card: Card): string {
  const { start, end } = formatDateTimeLocal(appointment.requestedDate, appointment.requestedTime);
  const name = `${card.firstName || ''} ${card.lastName || ''}`.trim() || card.slug || 'Contact';
  const summary = `Appointment with ${name}`;
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
    `DTSTAMP:${formatICSDate(new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5), 'local')}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    `ORGANIZER;CN=${escapeICS(name)}:mailto:${card.emails?.[0]?.address || ''}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\\r\\n');
}

function escapeICS(value: string): string {
  return value
    .replace(/\\\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\\n/g, '\\n');
}

export function googleCalendarUrl(appointment: Appointment, card: Card): string {
  const name = `${card.firstName || ''} ${card.lastName || ''}`.trim() || card.slug || 'Contact';
  const start = formatICSDate(appointment.requestedDate, appointment.requestedTime, appointment.timezone);
  const [year, month, day] = appointment.requestedDate.split('-').map(Number);
  const [hours, minutes] = appointment.requestedTime.split(':').map(Number);
  const endDate = new Date(year, month - 1, day, hours, minutes);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}T${pad(endDate.getUTCHours())}${pad(endDate.getUTCMinutes())}${pad(endDate.getUTCSeconds())}Z`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Appointment with ${name}`,
    dates: `${start}/${end}`,
    details: `Appointment requested via NownCard for ${name}${appointment.notes ? `\\n\\nNotes: ${appointment.notes}` : ''}`,
  });

  if (card.emails?.[0]?.address) {
    params.set('add', card.emails[0].address);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
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
