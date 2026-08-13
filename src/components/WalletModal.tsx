import { useState } from 'react';
import { Wallet, Apple } from 'lucide-react';
import ModalShell from './ModalShell';
import { toast } from 'sonner';
import type { Card } from '@/types';

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  card: Card | null;
  onTrack: (type: string) => void;
}

export default function WalletModal({ open, onClose, card, onTrack }: WalletModalProps) {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const googleWallet = async () => {
    if (!card) return;
    setLoading('google');
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fn = httpsCallable(getFunctions(), 'getWalletPass');
      const res = await fn({ slug: card.slug });
      const data = res.data as { configured?: boolean; googleSaveUrl?: string };
      if (!data.configured || !data.googleSaveUrl) {
        toast.info('Google Wallet is being set up — coming soon.');
        return;
      }
      window.open(data.googleSaveUrl, '_blank');
      onTrack('wallet');
      onClose();
    } catch (err) {
      console.error('[WalletModal] Google:', err);
      toast.error('Could not create a Google Wallet pass.');
    } finally {
      setLoading(null);
    }
  };

  const appleWallet = async () => {
    if (!card) return;
    setLoading('apple');
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const fn = httpsCallable(getFunctions(), 'getApplePass');
      const res = await fn({ slug: card.slug });
      const data = res.data as { configured?: boolean; pkpassBase64?: string; filename?: string };
      if (!data.configured || !data.pkpassBase64) {
        toast.info('Apple Wallet is coming soon.');
        return;
      }
      const bytes = Uint8Array.from(atob(data.pkpassBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/vnd.apple.pkpass' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || 'card.pkpass';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onTrack('wallet');
      onClose();
    } catch (err) {
      console.error('[WalletModal] Apple:', err);
      toast.error('Could not create an Apple Wallet pass.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="wallet-modal-title" panelClassName="relative bg-tile border border-line rounded-2xl p-6 w-full max-w-[420px] shadow-surface">
      <h2 id="wallet-modal-title" className="text-lg font-extrabold mb-1">Save to Wallet</h2>
      <p className="text-sm text-ink-muted mb-5">Add this card to your phone's wallet.</p>

      <div className="flex flex-col gap-2.5">
        <button
          onClick={googleWallet}
          disabled={loading !== null}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-space border border-line hover:border-accent-text transition text-left cursor-pointer disabled:opacity-60"
        >
          <span className="w-9 h-9 rounded-lg bg-accent/15 text-accent-text flex items-center justify-center flex-shrink-0"><Wallet className="w-5 h-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{loading === 'google' ? 'Opening…' : 'Google Wallet'}</span>
            <span className="block text-xs text-ink-muted">Add the card to Google Wallet on Android.</span>
          </span>
        </button>

        <button
          onClick={appleWallet}
          disabled={loading !== null}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-space border border-line transition text-left cursor-pointer disabled:opacity-60"
        >
          <span className="w-9 h-9 rounded-lg bg-tile-soft text-ink-faint flex items-center justify-center flex-shrink-0"><Apple className="w-5 h-5" /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-ink">{loading === 'apple' ? 'Creating…' : 'Apple Wallet'}</span>
            <span className="block text-xs text-ink-muted">Apple Wallet passes are coming soon.</span>
          </span>
        </button>
      </div>

      <button onClick={onClose} className="w-full text-sm text-ink-muted hover:text-ink mt-4 cursor-pointer">Cancel</button>
    </ModalShell>
  );
}
