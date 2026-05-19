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
}

export interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  recipientUid: string;
  cardId: string;
  cardSlug: string;
  content: string;
  createdAt: unknown;
  read: boolean;
}

export type Plan = 'free' | 'pro' | 'business';

export interface UserData {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  plan?: Plan;
  cardCount?: number;
  isAdmin?: boolean;
  defaultCardSlug?: string;
  fcmToken?: string;
  createdAt?: unknown;
  lastLogin?: unknown;
  planUpdatedAt?: unknown;
}
