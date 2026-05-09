import { Link } from 'react-router-dom';

interface FooterProps {
  compact?: boolean;
}

export default function Footer({ compact = false }: FooterProps) {
  if (compact) {
    return (
      <div className="text-center py-4">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Link to="/terms" className="text-[10px] text-ink-faint hover:text-ink no-underline">Terms</Link>
          <span className="text-ink-faint text-[10px]">·</span>
          <Link to="/privacy" className="text-[10px] text-ink-faint hover:text-ink no-underline">Privacy</Link>
          <span className="text-ink-faint text-[10px]">·</span>
          <Link to="/contact" className="text-[10px] text-ink-faint hover:text-ink no-underline">Contact</Link>
        </div>
        <p className="text-[10px] text-ink-faint">
          © 2026 NownCard
        </p>
      </div>
    );
  }

  return (
    <footer className="border-t border-line-soft py-8 text-center">
      <div className="flex items-center justify-center gap-4 mb-3">
        <Link to="/terms" className="text-xs text-ink-faint hover:text-ink no-underline">Terms of Service</Link>
        <span className="text-ink-faint text-xs">·</span>
        <Link to="/privacy" className="text-xs text-ink-faint hover:text-ink no-underline">Privacy Policy</Link>
        <span className="text-ink-faint text-xs">·</span>
        <Link to="/contact" className="text-xs text-ink-faint hover:text-ink no-underline">Contact Support</Link>
      </div>
      <p className="text-sm text-ink-faint">
        © 2026 NownCard — A product of{' '}
        <a href="https://www.nowndigital.com" target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-ink underline underline-offset-2">NOWN Digital</a>
      </p>
    </footer>
  );
}
