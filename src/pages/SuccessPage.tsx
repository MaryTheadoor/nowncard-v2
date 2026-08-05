import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '@/components/Footer';
import { applyPendingUpgrades } from '@/lib/payments';
import { useAuth } from '@/hooks/auth-context';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

type Status = 'checking' | 'applying' | 'done' | 'no-pending' | 'error' | 'signin-required';

export default function SuccessPage() {
  const { user, loading: authLoading } = useAuth();
  const [upgradeResult, setUpgradeResult] = useState<{ applied: number } | 'error' | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const active = userSnap.data()?.activeCheckout as { pendingId?: string } | undefined;
        setUpgradeResult(await applyPendingUpgrades(user.uid, active?.pendingId));
      } catch {
        setUpgradeResult('error');
      }
    })();
  }, [user, authLoading]);

  let status: Status;
  if (authLoading) status = 'checking';
  else if (!user) status = 'signin-required';
  else if (!upgradeResult) status = 'applying';
  else if (upgradeResult === 'error') status = 'error';
  else status = upgradeResult.applied > 0 ? 'done' : 'no-pending';

  const states: Record<Status, { icon: string; title: string; desc: string }> = {
    checking: { icon: '⏳', title: 'Checking...', desc: 'Verifying your payment status.' },
    applying: { icon: '🔄', title: 'Applying Upgrade...', desc: 'Almost there.' },
    done: { icon: '🎉', title: 'Upgrade Complete!', desc: 'Welcome to your new plan.' },
    'no-pending': { icon: '✅', title: 'All Set!', desc: 'Your account is ready to go.' },
    error: { icon: '❌', title: 'Something Went Wrong', desc: 'We could not apply your upgrade. Please contact support.' },
    'signin-required': { icon: '🔒', title: 'Sign In to Complete', desc: 'Please sign in to apply your upgrade.' },
  };

  const s = states[status];

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
          <div className="text-6xl mb-6">{s.icon}</div>
          <h1 className="text-2xl font-extrabold mb-3">{s.title}</h1>
          <p className="text-ink-muted mb-8">{s.desc}</p>
          <Link to="/dashboard" className="inline-block px-6 py-2.5 bg-accent text-space font-bold rounded-full text-sm hover:brightness-110 transition">Go to Dashboard</Link>
        </div>
      </main>

      <Footer compact />
    </div>
  );
}
