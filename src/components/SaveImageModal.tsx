import { Image as ImageIcon, QrCode } from 'lucide-react';
import ModalShell from './ModalShell';
import { toast } from 'sonner';
import type { Card } from '@/types';

interface SaveImageModalProps {
  open: boolean;
  onClose: () => void;
  card: Card | null;
  name: string;
  onTrack: (type: string) => void;
}

export default function SaveImageModal({ open, onClose, card, name, onTrack }: SaveImageModalProps) {
  if (!card) return null;
  const safe = (name || card.slug || 'card').replace(/[^a-z0-9_-]/gi, '_');
  const slug = encodeURIComponent(card.slug);
  const qrTarget = card.qrMode === 'vcard' ? 'your vCard' : 'your card page';

  const download = (href: string, filename: string, trackType: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onTrack(trackType);
    toast.success('Download started');
    onClose();
  };

  const options: Array<{ key: string; icon: React.ReactNode; label: string; desc: string; href: string; file: string; track: string }> = [
    {
      key: 'image',
      icon: <ImageIcon className="w-5 h-5" />,
      label: 'Card image',
      desc: 'The card design, no QR.',
      href: `/card-images/${slug}.png`,
      file: `${safe}-nowncard.png`,
      track: 'image',
    },
    {
      key: 'image-qr',
      icon: <QrCode className="w-5 h-5" />,
      label: 'Image with QR',
      desc: `Card image with a QR panel (points to ${qrTarget}).`,
      href: `/card-images/${slug}.png?qr=1`,
      file: `${safe}-nowncard-qr.png`,
      track: 'image',
    },
    {
      key: 'qr',
      icon: <QrCode className="w-5 h-5" />,
      label: 'QR code only',
      desc: `A clean QR that points to ${qrTarget}.`,
      href: `/qr-images/${slug}.png`,
      file: `${safe}-qr.png`,
      track: 'qr',
    },
  ];

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="save-image-modal-title" panelClassName="relative bg-tile border border-line rounded-2xl p-6 w-full max-w-[420px] shadow-surface">
      <h2 id="save-image-modal-title" className="text-lg font-extrabold mb-1">Save image</h2>
      <p className="text-sm text-ink-muted mb-5">Choose what to download.</p>

      <div className="flex flex-col gap-2.5">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => download(o.href, o.file, o.track)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-space border border-line hover:border-accent-text transition text-left cursor-pointer"
          >
            <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent-text flex items-center justify-center flex-shrink-0">{o.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-bold text-ink">{o.label}</span>
              <span className="block text-xs text-ink-muted">{o.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <button onClick={onClose} className="w-full text-sm text-ink-muted hover:text-ink mt-4 cursor-pointer">Cancel</button>
    </ModalShell>
  );
}
