import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { cancelPendingUpgrades } from '@/lib/payments';
import { useAuth } from '@/hooks/auth-context';

export default function CancelPage() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      cancelPendingUpgrades(user.uid).catch(() => {});
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-space flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">😞</div>
          <h1 className="text-2xl font-extrabold mb-3">Payment Cancelled</h1>
          <p className="text-ink-muted mb-8">No worries. You can upgrade anytime from your dashboard.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/dashboard" className="btn btn-primary btn-lg no-underline">Go to Dashboard</Link>
            <Link to="/" className="btn btn-secondary btn-lg no-underline">Back to Home</Link>
          </div>
        </div>
      </main>

      <Footer compact />
    </div>
  );
}
