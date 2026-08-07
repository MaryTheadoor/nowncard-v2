import { getFunctions, httpsCallable } from 'firebase/functions';

// All admin writes route through the adminMutation callable, which re-checks
// isAdmin server-side (defense in depth on top of the Firestore rules).
export async function adminMutation(op: string, data: Record<string, unknown>): Promise<{ ok: boolean }> {
  const fn = httpsCallable<{ op: string; data: Record<string, unknown> }, { ok: boolean }>(getFunctions(), 'adminMutation');
  const result = await fn({ op, data });
  return result.data;
}
