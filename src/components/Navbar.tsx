import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface NavbarProps {
  onAuthClick: () => void;
  onSignOut?: () => void;
  userEmail?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function Navbar({ onAuthClick, onSignOut: _onSignOut, userEmail }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 bg-space/95 backdrop-blur-sm border-b border-line-soft">
        <div className="max-w-6xl mx-auto px-4 sm:px-5 flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2.5 text-ink font-bold text-[15px] no-underline">
            <img src="/nowncard-logo.png" alt="" className="h-[28px] w-auto object-contain rounded-lg" />
            <span>NownCard</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link to="/#features" className="text-sm font-medium text-ink-muted hover:text-ink transition">Features</Link>
            <Link to="/#pricing" className="text-sm font-medium text-ink-muted hover:text-ink transition">Pricing</Link>
            <Link to="/rolodex" className="text-sm font-medium text-ink-muted hover:text-ink transition">Rolodex</Link>
            {userEmail ? (
              <Link to="/dashboard" className="px-4 py-1.5 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">My Cards</Link>
            ) : (
              <button onClick={onAuthClick} className="px-4 py-1.5 bg-accent text-space text-sm font-bold rounded-full hover:brightness-110 transition">Sign In</button>
            )}
          </nav>

          <button className="md:hidden p-2 rounded-lg hover:bg-tile-soft transition" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer — rendered outside header so z-index works globally */}
      <div className={cn('md:hidden fixed inset-0 z-50 transition-opacity', open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')}>
        <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
        <div className={cn('absolute right-0 top-0 bottom-0 w-[280px] max-w-[80vw] bg-tile border-l border-line p-6 pt-16 transition-transform', open ? 'translate-x-0' : 'translate-x-full')}>
          <button className="absolute top-4 right-4 p-2 text-ink-muted" onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
          <div className="flex flex-col gap-4">
            <Link to="/#features" onClick={() => setOpen(false)} className="text-base font-semibold text-ink py-2 border-b border-line-soft">Features</Link>
            <Link to="/#pricing" onClick={() => setOpen(false)} className="text-base font-semibold text-ink py-2 border-b border-line-soft">Pricing</Link>
            <Link to="/rolodex" onClick={() => setOpen(false)} className="text-base font-semibold text-ink py-2 border-b border-line-soft">Rolodex</Link>
            {userEmail ? (
              <Link to="/dashboard" onClick={() => setOpen(false)} className="mt-4 px-4 py-2.5 bg-accent text-space text-sm font-bold rounded-full text-center">My Cards</Link>
            ) : (
              <button onClick={() => { setOpen(false); onAuthClick(); }} className="mt-4 px-4 py-2.5 bg-accent text-space text-sm font-bold rounded-full">Sign In</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
