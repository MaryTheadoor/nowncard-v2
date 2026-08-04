import { useState, useEffect, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isFCMReady, requestFCMPermission, onFCMMessage } from '@/lib/messaging';
import { toast } from 'sonner';

function getInitialState() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { subscribed: false, ready: false, loading: false };
  }
  return {
    subscribed: Notification.permission === 'granted',
    ready: isFCMReady(),
    loading: false,
  };
}

export function useFCM(userUid: string | undefined) {
  const [state, setState] = useState(getInitialState);
  const { subscribed, ready, loading } = state;

  useEffect(() => {
    const unsub = onFCMMessage((payload) => {
      if (payload.notification) {
        const n = payload.notification as Record<string, string>;
        toast(n.title || 'NownCard', { description: n.body || '' });
      }
    });
    return unsub;
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!userUid) {
      toast.error('Sign in to enable notifications');
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Notifications are not supported in this environment');
      return;
    }
    try {
      const token = await requestFCMPermission();
      if (!token) {
        toast.error('Notification permission denied');
        setState((s) => ({ ...s, subscribed: false }));
        return;
      }
      await setDoc(doc(db, 'users', userUid), { fcmToken: token }, { merge: true });
      toast.success('Push notifications enabled');
      setState((s) => ({ ...s, subscribed: true }));
    } catch (err) {
      console.error('FCM opt-in error:', err);
      toast.error('Failed to enable notifications');
    }
  }, [userUid]);

  return { subscribed, loading, ready, enableNotifications };
}
