import { UtensilsCrossed, Briefcase, Wrench, Scissors, Sparkles, Tag, Star } from 'lucide-react';

export default function MenuHeaderIcon({ value, className }: { value?: string; className?: string }) {
  switch (value) {
    case 'briefcase': return <Briefcase className={className} />;
    case 'wrench': return <Wrench className={className} />;
    case 'scissors': return <Scissors className={className} />;
    case 'sparkles': return <Sparkles className={className} />;
    case 'tag': return <Tag className={className} />;
    case 'star': return <Star className={className} />;
    case 'none': return null;
    default: return <UtensilsCrossed className={className} />;
  }
}
