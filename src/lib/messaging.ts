import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';

let messaging: Messaging | null = null;

export function getFCM(): Messaging | null {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return null;
  try {
    if (!messaging) messaging = getMessaging();
    return messaging;
  } catch {
    return null;
  }
}

export async function requestFCMPermission(): Promise<string | null> {
  const m = getFCM();
  if (!m) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  // Register the dedicated FCM service worker with a NARROW scope so it does NOT
  // collide with the PWA caching worker (/sw.js), which is also registered at scope
  // '/'. Two registrations at the same scope would ping-pong (one uninstalls the
  // other). Firebase's SDK uses '/firebase-cloud-messaging-push-scope' by default.
  const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/firebase-cloud-messaging-push-scope' });

  const vapidKey = 'BLIFncz4-3yYsHxs2h6W3GOJ55imlmFmRgrE_Eu-F93ZoOJ_nm6xazwC0RRmu09JTw01u7E0lM0Iz-X3ClJa5gg';
  try {
    const token = await getToken(m, { vapidKey, serviceWorkerRegistration: swRegistration });
    return token;
  } catch (err) {
    console.error('[FCM] getToken failed:', err);
    return null;
  }
}

export function onFCMMessage(callback: (payload: Record<string, unknown>) => void): () => void {
  const m = getFCM();
  if (!m) return () => {};
  return onMessage(m, (payload) => {
    callback(payload as unknown as Record<string, unknown>);
  });
}

export function isFCMReady(): boolean {
  return getFCM() !== null;
}
