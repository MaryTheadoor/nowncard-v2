import { useState } from 'react';
import { Menu, X, Shield, Sun, Moon, Heart, Star, Bell } from 'lucide-react';
import { useTheme } from '@/hooks/useThemeContext';
import { useAuth } from '@/hooks/auth-context';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onAuthClick?: () => void;
  messageCount?: number;
}

export default function Navbar({ onAuthClick, messageCount = 0 }: NavbarProps) {
  const [open, setOpen] = useState(false);
  const { setTheme, resolved } = useTheme();
  const { user, userData, logOut } = useAuth();
  const navigate = useNavigate();

  const userEmail = user?.email;
  const isAdmin = userData?.isAdmin;
  const defaultCardSlug = userData?.defaultCardSlug;
  const secondaryCardSlug = userData?.secondaryCardSlug;

  const handleAuthClick = () => {
    if (onAuthClick) {
      onAuthClick();
    } else {
      navigate('/');
    }
  };

  const handleSignOut = async () => {
    await logOut();
    navigate('/');
  };

  const handleFavorite = (slug?: string) => {
    if (!userEmail) {
      handleAuthClick();
      return;
    }
    if (slug) {
      navigate(`/card/${slug}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-space/95 backdrop-blur-sm border-b border-line-soft">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center no-underline" aria-label="NownCard home">
            <img src="/nowncard-logo.png" alt="NownCard" className="h-[28px] w-auto object-contain rounded-lg" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {/* Favorite cards — always visible */}
            <button
              onClick={() => handleFavorite(defaultCardSlug)}
              className={`p-2 transition ${defaultCardSlug ? 'text-accent-text hover:text-accent-text-hover' : 'text-ink-muted hover:text-accent-text'}`}
              title={userEmail ? (defaultCardSlug ? `Favorite: ${defaultCardSlug}` : 'No favorite set') : 'Sign in to view your cards'}
            >
              <Heart className="w-4 h-4" fill={defaultCardSlug ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => handleFavorite(secondaryCardSlug)}
              className={`p-2 transition ${secondaryCardSlug ? 'text-secondary hover:text-secondary' : 'text-ink-muted hover:text-secondary'}`}
              title={userEmail ? (secondaryCardSlug ? `Second favorite: ${secondaryCardSlug}` : 'No second favorite set') : 'Sign in to view your cards'}
            >
              <Star className="w-4 h-4" fill={secondaryCardSlug ? 'currentColor' : 'none'} />
            </button>

            {isAdmin && (
              <Link to="/admin" className="p-2 text-ink-muted hover:text-accent-text transition" title="Admin">
                <Shield className="w-4 h-4" />
              </Link>
            )}

            {userEmail && (
              <Link to="/dashboard" className="relative p-2 text-ink-muted hover:text-accent-text transition" title={`${messageCount} unread message${messageCount !== 1 ? 's' : ''}`}>
                <Bell className="w-4 h-4" />
                {messageCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-space text-[10px] font-bold flex items-center justify-center leading-none">
                    {messageCount > 9 ? '9+' : messageCount}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
              className="p-2 text-ink-muted hover:text-ink transition"
              title={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link to="/rolodex" className="ml-2 btn btn-secondary btn-md no-underline">Directory</Link>

            {userEmail ? (
              <>
                <Link to="/dashboard" className="ml-2 btn btn-primary btn-md no-underline">My Cards</Link>
                <button onClick={handleSignOut} className="ml-2 btn btn-secondary btn-md">Sign Out</button>
              </>
            ) : (
              <button onClick={handleAuthClick} className="ml-2 btn btn-primary btn-md">Sign In</button>
            )}
          </nav>

          {/* Mobile header icons */}
          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={() => handleFavorite(defaultCardSlug)}
              className={`p-2 transition ${defaultCardSlug ? 'text-accent-text hover:text-accent-text-hover' : 'text-ink-muted hover:text-accent-text'}`}
              title={userEmail ? (defaultCardSlug ? `Favorite: ${defaultCardSlug}` : 'No favorite set') : 'Sign in to view your cards'}
            >
              <Heart className="w-5 h-5" fill={defaultCardSlug ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => handleFavorite(secondaryCardSlug)}
              className={`p-2 transition ${secondaryCardSlug ? 'text-secondary hover:text-secondary' : 'text-ink-muted hover:text-secondary'}`}
              title={userEmail ? (secondaryCardSlug ? `Second favorite: ${secondaryCardSlug}` : 'No second favorite set') : 'Sign in to view your cards'}
            >
              <Star className="w-5 h-5" fill={secondaryCardSlug ? 'currentColor' : 'none'} />
            </button>
            <button className="p-2 rounded-lg hover:bg-tile-soft transition" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open} aria-controls="mobile-nav">
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div id="mobile-nav" className={cn('md:hidden fixed inset-0 z-50 transition-opacity', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')} aria-hidden={!open} inert={!open}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <div className={cn('absolute right-0 top-0 bottom-0 w-[280px] max-w-[80vw] bg-tile border-l border-line p-6 pt-16 transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
          <button aria-label="Close menu" className="absolute top-4 right-4 p-2 text-ink-muted" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>

          <div className="flex flex-col gap-3 h-full">
            <div className="flex flex-col gap-3">
              {userEmail ? (
                <>
                  <div className="text-sm text-ink-muted truncate">{userEmail}</div>
                  <Link to="/dashboard" onClick={() => setOpen(false)} className="btn btn-primary btn-md flex items-center justify-center gap-2 no-underline">
                    My Cards
                    {messageCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-space/20 text-space text-[10px] font-bold flex items-center justify-center leading-none">
                        {messageCount > 9 ? '9+' : messageCount}
                      </span>
                    )}
                  </Link>
                  <Link to="/rolodex" onClick={() => setOpen(false)} className="btn btn-secondary btn-md text-center no-underline">Directory</Link>
                  <button onClick={() => { setOpen(false); handleSignOut(); }} className="btn btn-secondary btn-md">Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setOpen(false); handleAuthClick(); }} className="btn btn-primary btn-md">Sign In</button>
                  <Link to="/rolodex" onClick={() => setOpen(false)} className="btn btn-secondary btn-md text-center no-underline">Directory</Link>
                </>
              )}
            </div>

            <div className="h-px bg-line-soft my-2" />

            <button
              onClick={() => { setTheme(resolved === 'dark' ? 'light' : 'dark'); setOpen(false); }}
              className="flex items-center gap-2 text-sm font-semibold text-ink py-2"
            >
              {resolved === 'dark' ? <Sun className="w-4 h-4 text-accent-text" /> : <Moon className="w-4 h-4 text-accent-text" />}
              {resolved === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>

            {isAdmin && (
              <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 text-sm font-semibold text-ink py-2">
                <Shield className="w-4 h-4 text-accent-text" /> Admin
              </Link>
            )}

            <div className="mt-auto flex flex-col gap-3 pb-4">
              <div className="h-px bg-line-soft" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
