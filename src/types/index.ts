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
  birthday?: string;
  anniversary?: string;
  bio?: string;
  profileImage?: string;
  backgroundImage?: string;
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
  isPublic: boolean;
  viewCount?: number;
  saveCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  industry?: string;
}

export type Plan = 'free' | 'pro' | 'business';

export interface UserData {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  plan?: Plan;
  cardCount?: number;
  createdAt?: unknown;
}
