import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, linkWithPopup } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<{ plan?: string; cardCount?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u) {
        setUserData(null);
        return;
      }
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        getDoc(userRef).then((snap) => {
          if (!snap.exists()) {
            const data = { plan: 'free', createdAt: serverTimestamp(), lastLogin: serverTimestamp(), email: u.email || null, isAdmin: false };
            setDoc(userRef, data, { merge: true }).catch(() => {});
            setUserData(data);
          } else {
            const data = snap.data();
            setUserData({ plan: data.plan || 'free', cardCount: data.cardCount || 0 });
            setDoc(userRef, { lastLogin: serverTimestamp(), email: u.email || null }, { merge: true }).catch(() => {});
          }
        }).catch(() => {});
      }
    });
    return unsub;
  }, []);

  const handleError = (err: unknown) => {
    if (err instanceof Error) setError(err.message);
    else setError('Authentication failed');
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
