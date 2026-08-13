import { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, Mail, User, Phone, FileText, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadICS, googleCalendarUrl, outlookCalendarUrl } from '@/lib/appointments';
import ModalShell from './ModalShell';
import { toast } from 'sonner';
import type { Appointment, AppointmentWeeklyHour, Card } from '@/types';

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  card: Card;
}

const DEFAULT_HOURS: AppointmentWeeklyHour[] = [
  { day: 1, start: '09:00', end: '17:00' },
  { day: 2, start: '09:00', end: '17:00' },
  { day: 3, start: '09:00', end: '17:00' },
  { day: 4, start: '09:00', end: '17:00' },
  { day: 5, start: '09:00', end: '17:00' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function localDateFromStr(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function dateStrOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Slot {
  time: string;
  disabled: boolean;
}

export default function AppointmentModal({ open, onClose, card }: AppointmentModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [existing, setExisting] = useState<Appointment[]>([]);
  const [submitted, setSubmitted] = useState<Appointment | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const weeklyHours = card.appointmentSettings?.weeklyHours?.length
    ? card.appointmentSettings.weeklyHours
    : DEFAULT_HOURS;
  const durationMinutes = card.appointmentSettings?.durationMinutes || 30;

  useEffect(() => {
    if (!open || !card.id) return;
    let cancelled = false;
    (async () => {
      try {
        setNowMs(Date.now());
        // Visitors are unauthenticated and can't read the appointments collection
        // directly (rules require auth), so booked slots come from a callable that
        // returns only scheduling fields (no requester PII).
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const callable = httpsCallable(getFunctions(), 'getBookedSlots');
        const res = await callable({ cardId: card.id });
        const data = res.data as { slots?: Array<{ requestedDate: string; requestedTime: string; durationMinutes: number }> };
        if (!cancelled) {
          setExisting((data.slots || []).map((s, i) => ({ id: String(i), cardId: card.id, cardSlug: card.slug, ownerUid: '', requesterName: '', requesterEmail: '', requestedDate: s.requestedDate, requestedTime: s.requestedTime, timezone: '', durationMinutes: s.durationMinutes, status: 'pending', createdAt: null, updatedAt: null })));
        }
      } catch (err) {
        console.error('[AppointmentModal] Failed to load existing appointments:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [open, card.id, card.slug]);

  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'local', []);

  const today = useMemo(() => { const n = new Date(); n.setHours(0, 0, 0, 0); return n; }, []);

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
    const cells: Array<{ date: Date; available: boolean; disabled: boolean; selected: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ date: new Date(0), available: false, disabled: true, selected: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
      const hasHours = weeklyHours.some((h) => h.day === date.getDay());
      const isPast = date < today;
      cells.push({
        date,
        available: hasHours,
        disabled: isPast || !hasHours,
        selected: dateStrOf(date) === selectedDate,
      });
    }
    return cells;
  }, [viewMonth, weeklyHours, today, selectedDate]);

  const slots = useMemo<Slot[]>(() => {
    if (!selectedDate) return [];
    const date = localDateFromStr(selectedDate, '00:00');
    const hours = weeklyHours.find((h) => h.day === date.getDay());
    if (!hours) return [];
    const list: Slot[] = [];
    let start = toMinutes(hours.start);
    const end = toMinutes(hours.end);
    while (start + durationMinutes <= end) {
      const time = `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
      const slotStart = localDateFromStr(selectedDate, time).getTime();
      const slotEnd = slotStart + durationMinutes * 60_000;
      const isPast = slotStart <= nowMs;
      const overlaps = existing.some((a) => {
        if (a.status === 'cancelled' || a.requestedDate !== selectedDate) return false;
        const aStart = localDateFromStr(selectedDate, a.requestedTime).getTime();
        const aEnd = aStart + (a.durationMinutes || 30) * 60_000;
        return aStart < slotEnd && slotStart < aEnd;
      });
      list.push({ time, disabled: isPast || overlaps });
      start += durationMinutes;
    }
    return list;
  }, [selectedDate, weeklyHours, durationMinutes, existing, nowMs]);

  const ownerUid = card.ownerUid || card.ownerId;
  const selectableCount = slots.filter((s) => !s.disabled).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !selectedDate || !selectedTime) {
      toast.error('Please fill in your name, email, and pick a date and time.');
      return;
    }
    if (!ownerUid) {
      toast.error('Card owner not found.');
      return;
    }

    setLoading(true);
    try {
      const appointmentData = {
        cardId: card.id,
        cardSlug: card.slug,
        ownerUid: ownerUid as string,
        requesterName: name.trim(),
        requesterEmail: email.trim(),
        requesterPhone: phone.trim() || null,
        requestedDate: selectedDate,
        requestedTime: selectedTime,
        timezone,
        durationMinutes,
        notes: notes.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
      setSubmitted({ id: docRef.id, ...appointmentData, requesterPhone: appointmentData.requesterPhone || undefined, notes: appointmentData.notes || undefined } as Appointment);
      toast.success('Appointment requested.');
    } catch (err) {
      console.error('[AppointmentModal] Booking failed:', err);
      toast.error('Failed to request appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setNotes('');
    setSelectedDate(null); setSelectedTime(null); setSubmitted(null);
    setExisting([]);
  };

  if (!open) return null;

  const ownerFirstName = card.firstName || card.lastName || card.slug || 'Contact';

  return (
    <ModalShell open={open} onClose={() => { onClose(); reset(); }} labelledBy="appointment-modal-title" panelClassName="relative bg-tile border border-line rounded-2xl p-6 w-full max-w-[480px] shadow-surface max-h-[92vh] overflow-y-auto">
      <button onClick={() => { onClose(); reset(); }} aria-label="Close" className="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>

      {submitted ? (
        <>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-14 h-14 rounded-full bg-success/15 text-success flex items-center justify-center mb-3"><CheckCircle2 className="w-8 h-8" /></div>
            <h2 id="appointment-modal-title" className="text-xl font-extrabold mb-1">Request sent!</h2>
              <p className="text-sm text-ink-muted mb-6">
                {ownerFirstName} has been notified. Add the appointment to your calendar:
              </p>
              <div className="w-full space-y-2.5">
                <a href={googleCalendarUrl(submitted, card)} target="_blank" rel="noopener noreferrer" className="block w-full btn btn-primary btn-lg text-center no-underline">Add to Google Calendar</a>
                <a href={outlookCalendarUrl(submitted, card)} target="_blank" rel="noopener noreferrer" className="block w-full btn btn-secondary btn-lg text-center no-underline">Add to Outlook</a>
                <button onClick={() => downloadICS(submitted, card)} className="w-full btn btn-secondary btn-lg">Download .ics (Apple Calendar)</button>
                <button onClick={() => { onClose(); reset(); }} className="w-full text-sm text-ink-muted hover:text-ink mt-2 cursor-pointer">Done</button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 id="appointment-modal-title" className="text-xl font-extrabold mb-1">Book an Appointment</h2>
            <p className="text-sm text-ink-muted mb-5">Choose a time to meet with {ownerFirstName}.</p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-ink">Pick a day</label>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))} className="p-1.5 text-ink-muted hover:text-ink hover:bg-tile-soft rounded-lg cursor-pointer" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
                    <span className="text-sm font-bold w-36 text-center">{MONTH_LABELS[viewMonth.getMonth()]} {viewMonth.getFullYear()}</span>
                    <button type="button" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))} className="p-1.5 text-ink-muted hover:text-ink hover:bg-tile-soft rounded-lg cursor-pointer" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                  {WEEKDAY_LABELS.map((w) => (
                    <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wider text-ink-faint py-1">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarCells.map((cell, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={cell.disabled}
                      onClick={() => { setSelectedDate(dateStrOf(cell.date)); setSelectedTime(null); }}
                      className={`aspect-square rounded-lg text-sm font-semibold transition flex items-center justify-center ${cell.disabled ? 'text-ink-faint/40 cursor-not-allowed' : cell.selected ? 'bg-accent text-space' : cell.available ? 'bg-tile-soft text-ink hover:bg-accent/20 hover:text-accent-text cursor-pointer' : 'text-ink-faint/40 cursor-not-allowed'} ${cell.date.getTime() === today.getTime() ? 'ring-1 ring-accent-text' : ''}`}
                    >
                      {cell.date.getTime() === 0 ? '' : cell.date.getDate()}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-2 text-[10px] text-ink-faint">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-accent/60 inline-block" /> Available</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-tile-soft border border-line inline-block" /> Unavailable</span>
                </div>
              </div>

              {selectedDate && (
                <div className="mb-4">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-2">
                    <Clock className="w-3.5 h-3.5 text-ink-faint" /> Pick a time
                    <span className="text-ink-faint font-normal text-xs">({durationMinutes} min, {timezone})</span>
                  </label>
                  {slots.length === 0 ? (
                    <p className="text-xs text-ink-faint">No availability for this day.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          disabled={s.disabled}
                          onClick={() => setSelectedTime(s.time)}
                          className={`px-3.5 py-2 rounded-lg border text-sm font-semibold transition ${s.disabled ? 'border-line text-ink-faint/40 cursor-not-allowed line-through' : selectedTime === s.time ? 'border-accent-text bg-accent text-space' : 'border-line bg-tile-soft text-ink hover:border-accent-text hover:text-accent-text cursor-pointer'}`}
                        >
                          {fmtMinutes(toMinutes(s.time))}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectableCount === 0 && slots.length > 0 && (
                    <p className="text-[11px] text-ink-faint mt-2">All slots for this day are already booked.</p>
                  )}
                </div>
              )}

              <div className="space-y-3 border-t border-line pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="appt-name" className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5"><User className="w-3.5 h-3.5 text-ink-faint" /> Your name</label>
                    <input id="appt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent-text" />
                  </div>
                  <div>
                    <label htmlFor="appt-email" className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5"><Mail className="w-3.5 h-3.5 text-ink-faint" /> Email</label>
                    <input id="appt-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent-text" />
                  </div>
                </div>
                <div>
                  <label htmlFor="appt-phone" className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5"><Phone className="w-3.5 h-3.5 text-ink-faint" /> Phone <span className="text-ink-faint font-normal">(optional)</span></label>
                  <input id="appt-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent-text" />
                </div>
                <div>
                  <label htmlFor="appt-notes" className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5"><FileText className="w-3.5 h-3.5 text-ink-faint" /> Notes <span className="text-ink-faint font-normal">(optional)</span></label>
                  <textarea id="appt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What would you like to discuss?" rows={2} className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent-text" />
                </div>

                {selectedDate && selectedTime && (
                  <p className="text-xs text-ink-muted">
                    <Calendar className="w-3.5 h-3.5 inline-block mr-1 text-ink-faint" />
                    Requesting <span className="font-semibold text-ink">{new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span> at{' '}
                    <span className="font-semibold text-ink">{fmtMinutes(toMinutes(selectedTime))}</span> ({timezone}).
                  </p>
                )}

                <button type="submit" disabled={loading || !selectedDate || !selectedTime} className="w-full btn btn-primary btn-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? 'Requesting…' : 'Request Appointment'}
                </button>
              </div>
            </form>
          </>
        )}
    </ModalShell>
  );
}
