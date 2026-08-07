import { X, FileDown } from 'lucide-react';

interface ImportVCardModalProps {
  open: boolean;
  onClose: () => void;
  platform: 'android' | 'ios';
}

const STEPS: Record<ImportVCardModalProps['platform'], { title: string; steps: string[] }> = {
  android: {
    title: 'Add the downloaded contact',
    steps: [
      'Your card file (.vcf) was downloaded to this phone.',
      'Swipe down and tap the "Card downloaded" notification (or open your Downloads / Files app).',
      'Tap the .vcf file, then choose "Import" or "Add Contact".',
      'Review the details and tap Save.',
    ],
  },
  ios: {
    title: 'Add the downloaded contact',
    steps: [
      'Your card file (.vcf) is downloading.',
      'Tap the download when it finishes (or open it in Files).',
      'Tap "New Contact" (or "Add to Existing Contact").',
      'Review the details and tap Done.',
    ],
  },
};

export default function ImportVCardModal({ open, onClose, platform }: ImportVCardModalProps) {
  if (!open) return null;
  const content = STEPS[platform];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-tile border border-line rounded-2xl p-6 w-full max-w-[400px] shadow-surface">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><FileDown className="w-5 h-5" /></div>
          <h2 className="text-lg font-extrabold">Contact file downloaded</h2>
        </div>
        <p className="text-sm text-ink-muted mb-4">{content.title}. Follow these steps to add it to your phone:</p>
        <ol className="space-y-2.5 mb-6">
          {content.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-tile-soft border border-line text-ink-muted text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <button onClick={onClose} className="w-full btn btn-primary btn-lg">Got it</button>
      </div>
    </div>
  );
}
