import { useState } from 'react';
import { X, Calendar, Clock, Mail, User, Phone, FileText } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { downloadICS, googleCalendarUrl } from '@/lib/appointments';
import { toast } from 'sonner';
import type { Card } from '@/types';

interface AppointmentModalProps {
  open: boolean;
  onClose: () => void;
  card: Card;
}

export default function AppointmentModal({ open, onClose, card }: AppointmentModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);

  if (!open) return null;

  const ownerUid = card.ownerUid || card.ownerId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !date || !time) {
      toast.error('Please fill in name, email, date, and time.');
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
        requestedDate: date,
        requestedTime: time,
        timezone: timezone.trim() || 'local',
        notes: notes.trim() || null,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);

      const appointment = {
        id: docRef.id,
        ...appointmentData,
        requesterPhone: appointmentData.requesterPhone || undefined,
        notes: appointmentData.notes || undefined,
      } as import('@/types').Appointment;

      downloadICS(appointment, card);
      setGoogleUrl(googleCalendarUrl(appointment, card));

      toast.success('Appointment requested. Calendar file downloaded.');
    } catch (err) {
      console.error('[AppointmentModal] Booking failed:', err);
      toast.error('Failed to request appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-tile border border-line rounded-2xl p-6 w-full max-w-[460px] shadow-surface max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-extrabold mb-1">Book an Appointment</h2>
        <p className="text-sm text-ink-muted mb-6">Request a meeting with {card.firstName || card.lastName || card.slug}.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
              <User className="w-3.5 h-3.5 text-ink-faint" /> Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
              <Mail className="w-3.5 h-3.5 text-ink-faint" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              required
              className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
              <Phone className="w-3.5 h-3.5 text-ink-faint" /> Phone <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-ink-faint" /> Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
                <Clock className="w-3.5 h-3.5 text-ink-faint" /> Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-ink mb-1.5 block">Timezone</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
              className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-semibold text-ink mb-1.5">
              <FileText className="w-3.5 h-3.5 text-ink-faint" /> Notes <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What would you like to discuss?"
              rows={3}
              className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary btn-lg disabled:opacity-50"
          >
            {loading ? 'Requesting…' : 'Request Appointment'}
          </button>

          {googleUrl && (
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full btn btn-secondary btn-lg text-center no-underline"
            >
              Add to Google Calendar
            </a>
          )}
        </form>
      </div>
    </div>
  );
}
