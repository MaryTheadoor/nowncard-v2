import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isFCMReady, requestFCMPermission, onFCMMessage } from '@/lib/messaging';
import { toast } from 'sonner';

export function useFCM(userUid: string | undefined) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Notification.requestPermission().then((perm) => {
      setReady(isFCMReady());
      setSubscribed(perm === 'granted');
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

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
    try {
      const token = await requestFCMPermission();
      if (!token) {
        toast.error('Notification permission denied');
        setSubscribed(false);
        return;
      }
      await setDoc(doc(db, 'users', userUid), { fcmToken: token }, { merge: true });
      toast.success('Push notifications enabled');
      setSubscribed(true);
    } catch (err) {
      console.error('FCM opt-in error:', err);
      toast.error('Failed to enable notifications');
    }
  }, [userUid]);

  return { subscribed, loading, ready, enableNotifications };
}
