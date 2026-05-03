import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignUpEmail: (email: string, password: string) => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onSignInAnon: () => Promise<void>;
  error: string | null;
}

export default function AuthModal({ open, onClose, onSignInEmail, onSignUpEmail, onSignInGoogle, onSignInAnon, error }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') await onSignInEmail(email, password);
      else await onSignUpEmail(email, password);
      onClose();
    } catch {}
    setLoading(false);
  };

  return (
    <div className={cn('fixed inset-0 z-[100] flex items-center justify-center px-6 transition-opacity', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-tile border border-line rounded-2xl p-8 w-full max-w-[420px] shadow-surface">
        <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink"><X className="w-5 h-5" /></button>
        <h2 className="text-xl font-extrabold mb-1">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-sm text-ink-muted mb-6">{mode === 'signin' ? 'Sign in to manage your cards.' : 'Get started with NownCard.'}</p>

        <button onClick={async () => { try { await onSignInGoogle(); onClose(); } catch {} }} className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-line bg-transparent text-ink text-sm font-semibold hover:bg-tile-soft transition mb-4">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.842 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.035-3.71H.957v2.332C2.438 15.983 5.481 18 9 18z"/><path fill="#FBBC05" d="M3.965 10.711A5.54 5.54 0 0 1 3.682 9c0-.593.102-1.166.283-1.711V4.957H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.043l3.008-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.481 0 2.438 2.017.957 4.957L3.965 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          Sign in with Google
        </button>

        <div className="text-center text-xs text-ink-faint mb-4">or use email</div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
          {error && <p className="text-xs text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-accent text-space font-bold rounded-lg text-sm hover:brightness-110 transition disabled:opacity-50">
            {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm text-ink-muted">
          {mode === 'signin' ? (
            <>Need an account? <button onClick={() => setMode('signup')} className="text-accent font-semibold">Sign Up</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode('signin')} className="text-accent font-semibold">Sign In</button></>
          )}
        </div>

        <button onClick={async () => { try { await onSignInAnon(); onClose(); } catch {} }} className="w-full mt-4 py-2 text-xs text-ink-faint hover:text-ink transition">
          Try without an account →
        </button>
      </div>
    </div>
  );
}
