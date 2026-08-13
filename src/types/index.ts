export interface Phone {
  type: string;
  number: string;
}

export interface Email {
  type: string;
  address: string;
}

export interface Address {
  type: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Website {
  type: string;
  url: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface FeaturedLink {
  label: string;
  url: string;
}

export interface MenuItem {
  name: string;
  description?: string;
  price?: string;
}

export interface MenuCategory {
  name: string;
  image?: string;
  items: MenuItem[];
}

export interface Card {
  id: string;
  ownerUid: string;
  ownerId?: string;
  slug: string;
  prefix?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  nickname?: string;
  jobTitle?: string;
  department?: string;
  company?: string;
  phones?: Phone[];
  phone?: string;
  emails?: Email[];
  email?: string;
  addresses?: Address[];
  address?: string;
  website?: string;
  websites?: Website[];
  socialLinks?: SocialLink[] | Record<string, string>;
  paymentLinks?: SocialLink[];
  featuredLinks?: FeaturedLink[];
  menu?: MenuCategory[];
  menuTitle?: string;
  menuIcon?: string;
  birthday?: string;
  anniversary?: string;
  bio?: string;
  profileImage?: string;
  profileSize?: 'small' | 'medium' | 'large';
  profileShape?: 'circle' | 'rounded' | 'square';
  backgroundImage?: string;
  backBackgroundImage?: string;
  bgDisplayMode?: 'full' | 'header';
  bgOpacity?: number;
  bgPosition?: string;
  bgSize?: string;
  bgZoom?: number;
  bgRotation?: number;
  backBgPosition?: string;
  backBgZoom?: number;
  backBgRotation?: number;
  accentColor?: string;
  cardTheme?: 'light' | 'dark';
  cardBgColor?: string;
  pageBgColor?: string;
  fontFamily?: string;
  fontSizeScale?: number;
  customFontUrl?: string;
  nameLayout?: 'personal' | 'business';
  isTeamCard?: boolean;
  teamOwnerUid?: string;
  teamOwnerId?: string;
  isPublic: boolean;
  viewCount?: number;
  saveCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  industry?: string;
  hideNavbar?: boolean;
  hideLogo?: boolean;
  textColor?: string;
  qrMode?: 'url' | 'vcard';
  appointmentsEnabled?: boolean;
  appointmentSettings?: {
    durationMinutes?: number;
    weeklyHours?: AppointmentWeeklyHour[];
  };
  featuredLinksEnabled?: boolean;
  leadFormEnabled?: boolean;
}

export interface AppointmentWeeklyHour {
  day: number; // 0 = Sunday ... 6 = Saturday (Date.getDay() convention)
  start: string; // 'HH:MM' 24-hour, local
  end: string; // 'HH:MM' 24-hour, local
}

export interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  senderPhone?: string;
  senderCompany?: string;
  recipientUid: string;
  cardId: string;
  cardSlug: string;
  content: string;
  createdAt: unknown;
  read: boolean;
  isLead?: boolean;
}

export interface Appointment {
  id: string;
  cardId: string;
  cardSlug: string;
  ownerUid: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requestedDate: string;
  requestedTime: string;
  timezone: string;
  durationMinutes?: number;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface Review {
  id: string;
  userId: string;
  displayName?: string;
  company?: string;
  email?: string;
  rating: number;
  content: string;
  featured: boolean;
  createdAt: unknown;
}
