import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, linkWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

const ADMIN_UIDS = new Set(['EeiBBDTu5jOooHbxyOC98JSlt6r1']);

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ plan?: string; cardCount?: number; isAdmin?: boolean; defaultCardSlug?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setError(null);
      if (!u) {
        setUserData(null);
        setLoading(false);
        return;
      }
      const userRef = doc(db, 'users', u.uid);
      getDoc(userRef).then((snap) => {
        if (!snap.exists()) {
          const isAdmin = ADMIN_UIDS.has(u.uid);
          const data = { plan: 'free', createdAt: serverTimestamp(), lastLogin: serverTimestamp(), email: u.email || null, isAdmin };
          setDoc(userRef, data, { merge: true }).catch(() => {});
          setUserData(data);
        } else {
          const data = snap.data();
          const isAdmin = ADMIN_UIDS.has(u.uid) || data.isAdmin === true;
          setUserData({ plan: data.plan || 'free', cardCount: data.cardCount || 0, isAdmin, defaultCardSlug: data.defaultCardSlug || undefined });
          setDoc(userRef, { lastLogin: serverTimestamp(), email: u.email || null }, { merge: true }).catch(() => {});
        }
      }).catch(() => {
        setUserData({ plan: 'free', cardCount: 0, isAdmin: ADMIN_UIDS.has(u.uid), defaultCardSlug: undefined });
      }).finally(() => {
        setLoading(false);
      });
    });
    return unsub;
  }, []);

  const handleError = (err: unknown) => {
    const code = (err as { code?: string })?.code || '';
    const messages: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/email-already-in-use': 'An account already exists with this email.',
      'auth/invalid-email': 'Please enter a valid email address.',
      'auth/weak-password': 'Password should be at least 6 characters.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/internal-error': 'Authentication service error. Please try again.',
    };
    setError(messages[code] || (err instanceof Error ? err.message : 'Authentication failed'));
  };

  const signInEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try { await signInWithEmailAndPassword(auth, email, password); }
    catch (e) { handleError(e); throw e; }
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try { await createUserWithEmailAndPassword(auth, email, password); }
    catch (e) { handleError(e); throw e; }
  }, []);

  const signInGoogle = useCallback(async () => {
    setError(null);
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { handleError(e); throw e; }
  }, []);

  const linkGoogle = useCallback(async () => {
    setError(null);
    try {
      if (!auth.currentUser) throw new Error('Not signed in');
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
    }
    catch (e) { handleError(e); throw e; }
  }, []);

  const signInAnon = useCallback(async () => {
    setError(null);
    try { await signInAnonymously(auth); }
    catch (e) { handleError(e); throw e; }
  }, []);

  const logOut = useCallback(async () => {
    setError(null);
    try { await signOut(auth); }
    catch (e) { handleError(e); throw e; }
  }, []);

  return { user, userData, loading, error, signInEmail, signUpEmail, signInGoogle, linkGoogle, signInAnon, logOut };
}
