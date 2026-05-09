import { useEffect, useState, useCallback } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isOneSignalReady, optIn, getNotificationPermission, getOneSignalUserId } from '@/lib/onesignal';
import { toast } from 'sonner';

export function useOneSignal(userUid: string | undefined) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isOneSignalReady()) {
        if (!cancelled) setLoading(false);
        return;
      }
      const perm = await getNotificationPermission();
      if (!cancelled) {
        setSubscribed(perm === 'granted');
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!userUid) {
      toast.error('Sign in to enable notifications');
      return;
    }
    try {
      const granted = await optIn();
      if (!granted) {
        toast.error('Notification permission denied');
        setSubscribed(false);
        return;
      }
      // Wait a moment for OneSignal to assign an ID
      await new Promise((r) => setTimeout(r, 1500));
      const playerId = await getOneSignalUserId();
      if (playerId) {
        await setDoc(doc(db, 'users', userUid), { oneSignalPlayerId: playerId }, { merge: true });
        toast.success('Push notifications enabled');
        setSubscribed(true);
      } else {
        toast.error('Could not get subscription ID — try again');
      }
    } catch (err) {
      console.error('OneSignal opt-in error:', err);
      toast.error('Failed to enable notifications');
    }
  }, [userUid]);

  return { subscribed, loading, enableNotifications };
}
