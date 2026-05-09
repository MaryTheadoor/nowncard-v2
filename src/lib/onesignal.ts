// OneSignal configuration — replace with your actual App ID from onesignal.com
export const ONE_SIGNAL_APP_ID = 'ONESIGNAL_APP_ID_PLACEHOLDER';

// Check if OneSignal SDK is loaded
export function isOneSignalReady(): boolean {
  return typeof window !== 'undefined' && 'OneSignal' in window && !!(window as unknown as Record<string, unknown>).OneSignal;
}

// Get the OneSignal user ID (subscription ID)
export async function getOneSignalUserId(): Promise<string | null> {
  if (!isOneSignalReady()) return null;
  try {
    const OneSignal = (window as unknown as Record<string, unknown>).OneSignal as {
      User: { OneSignalId: string | null };
    };
    return OneSignal.User?.OneSignalId || null;
  } catch {
    return null;
  }
}

// Opt in to push notifications
export async function optIn(): Promise<boolean> {
  if (!isOneSignalReady()) return false;
  try {
    const OneSignal = (window as unknown as Record<string, unknown>).OneSignal as {
      Notifications: { requestPermission: () => Promise<boolean>; permissionNative: string };
    };
    const granted = await OneSignal.Notifications.requestPermission();
    return granted;
  } catch {
    return false;
  }
}

// Check current permission status
export async function getNotificationPermission(): Promise<string> {
  if (!isOneSignalReady()) return 'default';
  try {
    const OneSignal = (window as unknown as Record<string, unknown>).OneSignal as {
      Notifications: { permissionNative: string };
    };
    return OneSignal.Notifications.permissionNative || 'default';
  } catch {
    return 'default';
  }
}
