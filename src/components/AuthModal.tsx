import { useState, useEffect } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import ModalShell from './ModalShell';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSignInEmail: (email: string, password: string) => Promise<void>;
  onSignUpEmail: (email: string, password: string) => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onLinkGoogle: () => Promise<void>;
  error: string | null;
  isAuthenticated?: boolean;
}

export default function AuthModal({ open, onClose, onSignInEmail, onSignUpEmail, onSignInGoogle, onLinkGoogle, error, isAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setEmail('');
        setPassword('');
        setLoading(false);
      });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signin') await onSignInEmail(email, password);
      else await onSignUpEmail(email, password);
      onClose();
    } catch (e) { console.error('[AuthModal] Email auth:', e); }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={onClose} labelledBy="auth-modal-title" panelClassName="relative bg-tile border border-line rounded-2xl p-8 w-full max-w-[420px] shadow-surface">
      <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-ink-muted hover:text-ink cursor-pointer"><X className="w-5 h-5" /></button>
      <h2 id="auth-modal-title" className="text-xl font-extrabold mb-1">{mode === 'signin' ? 'Welcome Back' : 'Create Account'}</h2>
        <p className="text-sm text-ink-muted mb-6">{mode === 'signin' ? 'Sign in to manage your cards.' : 'Get started with NownCard.'}</p>

        <button
          onClick={async () => {
            setLoading(true);
            try { await (isAuthenticated ? onLinkGoogle() : onSignInGoogle()); onClose(); } catch (e) { console.error('[AuthModal] Google auth:', e); }
            setLoading(false);
          }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-line bg-transparent text-ink text-sm font-semibold hover:bg-tile-soft transition mb-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.842 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.035-3.71H.957v2.332C2.438 15.983 5.481 18 9 18z"/><path fill="#FBBC05" d="M3.965 10.711A5.54 5.54 0 0 1 3.682 9c0-.593.102-1.166.283-1.711V4.957H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.043l3.008-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.481 0 2.438 2.017.957 4.957L3.965 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          {loading ? 'Signing in…' : isAuthenticated ? 'Link Google Account' : 'Sign in with Google'}
        </button>

        <div className="text-center text-xs text-ink-faint mb-4">Or use email</div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" aria-label="Email" required className="w-full px-3.5 py-2.5 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" required className="w-full px-3.5 py-2.5 pr-10 bg-space border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20" />
            <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer p-1" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary btn-md w-full">
            {loading ? (mode === 'signin' ? 'Signing in…' : 'Creating account…') : mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm text-ink-muted">
          {mode === 'signin' ? (
            <>Need an account? <button onClick={() => { setMode('signup'); setEmail(''); setPassword(''); }} className="text-accent font-semibold cursor-pointer">Sign Up</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setMode('signin'); setEmail(''); setPassword(''); }} className="text-accent font-semibold cursor-pointer">Sign In</button></>
          )}
        </div>

          <p className="mt-4 text-[11px] text-ink-faint text-center">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-ink-muted hover:text-ink underline underline-offset-2">Terms</a>{' '}
            and{' '}
            <a href="/privacy" className="text-ink-muted hover:text-ink underline underline-offset-2">Privacy Policy</a>.
          </p>
    </ModalShell>
  );
}
