import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BackLinkProps {
  to: string;
  children: string;
}

export default function BackLink({ to, children }: BackLinkProps) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition no-underline">
      <ArrowLeft className="w-3.5 h-3.5" /> {children}
    </Link>
  );
}