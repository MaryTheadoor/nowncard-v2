import { useState } from 'react';
import { Menu, X, Shield, Sun, Moon, Heart } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onAuthClick?: () => void;
  onSignOut?: () => void;
  userEmail?: string | null;
  isAdmin?: boolean;
  defaultCardSlug?: string;
}

export default function Navbar({ onAuthClick, onSignOut, userEmail, isAdmin, defaultCardSlug }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { setTheme, resolved } = useTheme();
  const navigate = useNavigate();

  const handleFavorite = () => {
    if (!userEmail) {
      onAuthClick?.();
      return;
    }
    if (defaultCardSlug) {
      navigate(`/card/${defaultCardSlug}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-space/95 backdrop-blur-sm border-b border-line-soft">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px] no-underline">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>NownCard</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {/* Favorite card — always visible */}
            <button
              onClick={handleFavorite}
              className="p-2 text-ink-muted hover:text-accent transition"
              title={userEmail ? (defaultCardSlug ? 'My Card' : 'My Cards') : 'Sign in to view your cards'}
            >
              <Heart className="w-4 h-4" />
            </button>

            <Link to="/#features" className="text-sm font-medium text-ink-muted hover:text-ink transition px-2">Features</Link>
            <Link to="/#pricing" className="text-sm font-medium text-ink-muted hover:text-ink transition px-2">Pricing</Link>

            {isAdmin && (
              <Link to="/admin" className="p-2 text-ink-muted hover:text-accent transition" title="Admin">
                <Shield className="w-4 h-4" />
              </Link>
            )}

            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 text-ink-muted hover:text-ink transition"
              title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link to="/rolodex" className="ml-2 px-4 py-1.5 border border-line text-ink text-sm font-bold rounded-full hover:bg-tile-soft transition">Browse</Link>

            {userEmail ? (
              <Link to="/dashboard" className="ml-2 px-4 py-1.5 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">My Cards</Link>
            ) : (
              <button onClick={onAuthClick} className="ml-2 px-4 py-1.5 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">Sign In</button>
            )}
          </nav>

          {/* Mobile header icons */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={handleFavorite}
              className="p-2 text-ink-muted hover:text-accent transition"
              title={userEmail ? (defaultCardSlug ? 'My Card' : 'My Cards') : 'Sign in to view your cards'}
            >
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-tile-soft transition" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer — ACCOUNT AT TOP, LINKS AT BOTTOM */}
      <div className={cn('md:hidden fixed inset-0 z-50 transition-opacity', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <div className={cn('absolute right-0 top-0 bottom-0 w-[280px] max-w-[80vw] bg-tile border-l border-line p-6 pt-16 transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
          <button className="absolute top-4 right-4 p-2 text-ink-muted" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>

          <div className="flex flex-col gap-3 h-full">
            {/* TOP: Account section */}
            <div className="flex flex-col gap-3">
              {userEmail ? (
                <>
                  <div className="text-sm text-ink-muted truncate">{userEmail}</div>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="px-4 py-2.5 bg-accent text-space text-sm font-bold rounded-full text-center">My Cards</Link>
                  <Link to="/rolodex" onClick={() => setOpen(false)} className="px-4 py-2.5 border border-line text-ink text-sm font-bold rounded-full text-center">Browse</Link>
                  <button onClick={() => { setOpen(false); onSignOut?.(); }} className="px-4 py-2.5 border border-line text-ink text-sm font-bold rounded-full">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setOpen(false); onAuthClick?.(); }} className="px-4 py-2.5 bg-accent text-space text-sm font-bold rounded-full">Sign In</button>
                  <Link to="/rolodex" onClick={() => setOpen(false)} className="px-4 py-2.5 border border-line text-ink text-sm font-bold rounded-full text-center">Browse</Link>
                </>
              )}
            </div>

            <div className="h-px bg-line-soft my-2" />

            {/* MIDDLE: Utility toggles */}
            <button
              onClick={() => { setTheme(resolved === 'dark' ? 'light' : 'dark'); setOpen(false); }}
              className="flex items-center gap-2 text-sm font-semibold text-ink py-2"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-accent" /> : <Moon className="w-4 h-4 text-accent" />}
              {resolved === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-semibold text-ink py-2">
                <Shield className="w-4 h-4 text-accent" /> Admin
              </Link>
            )}

            {/* BOTTOM: Nav links */}
            <div className="mt-auto flex flex-col gap-3 pb-4">
              <div className="h-px bg-line-soft" />
              <Link to="/#features" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-muted hover:text-ink transition">Features</Link>
              <Link to="/#pricing" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-muted hover:text-ink transition">Pricing</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
