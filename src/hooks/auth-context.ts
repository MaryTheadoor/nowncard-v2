import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';

export interface AuthState {
  user: User | null;
  userData: { plan?: string; cardCount?: number; isAdmin?: boolean; defaultCardSlug?: string; secondaryCardSlug?: string } | null;
  loading: boolean;
  error: string | null;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  linkGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
