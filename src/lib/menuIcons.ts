import {
  UtensilsCrossed, Briefcase, Wrench, Scissors, Sparkles, Tag, Star,
  type LucideIcon,
} from 'lucide-react';

export interface MenuIconOption {
  value: string;
  label: string;
  icon: LucideIcon | null;
}

export const MENU_ICON_OPTIONS: MenuIconOption[] = [
  { value: 'utensils', label: 'Food & Drink', icon: UtensilsCrossed },
  { value: 'briefcase', label: 'Business', icon: Briefcase },
  { value: 'wrench', label: 'Services', icon: Wrench },
  { value: 'scissors', label: 'Beauty', icon: Scissors },
  { value: 'sparkles', label: 'Spa & Wellness', icon: Sparkles },
  { value: 'tag', label: 'Pricing', icon: Tag },
  { value: 'star', label: 'Featured', icon: Star },
  { value: 'none', label: 'No icon', icon: null },
];

export function getMenuIcon(value?: string): LucideIcon | null {
  if (!value) return UtensilsCrossed;
  return MENU_ICON_OPTIONS.find((o) => o.value === value)?.icon ?? UtensilsCrossed;
}
