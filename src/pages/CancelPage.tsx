import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '@/lib/firebase';
import { cancelPendingUpgrades } from '@/lib/payments';
import { onAuthStateChanged } from 'firebase/auth';

export default function CancelPage() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try { await cancelPendingUpgrades(user.uid); } catch { /* no-op */ }
      }
    });
    return unsub;
  }, []);

  return (
    <div className="min-h-screen bg-space flex flex-col">
      <header className="bg-space/80 backdrop-blur-xl border-b border-line-soft">
        <div className="max-w-4xl mx-auto px-5 flex items-center h-14">
          <Link to="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px]">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>NownCard</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😞</div>
          <h1 className="text-2xl font-extrabold mb-3">Payment Cancelled</h1>
          <p className="text-ink-muted mb-8">No worries. You can upgrade anytime from your dashboard.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition">Go to Dashboard</Link>
            <Link to="/" className="px-6 py-2.5 border border-line text-ink font-bold rounded-full text-sm hover:bg-tile-soft transition">Back to Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
