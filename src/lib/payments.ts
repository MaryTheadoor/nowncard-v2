import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ---------------------------------------------------------------------------
// Dynamic Pricing from Firestore
// ---------------------------------------------------------------------------
export interface PricingConfig {
  proPrice: number;
  businessPrice: number;
}

const DEFAULT_PRICING: PricingConfig = { proPrice: 19, businessPrice: 39 };

export async function getPricing(): Promise<PricingConfig> {
  try {
    const snap = await getDoc(doc(db, 'config', 'pricing'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        proPrice: data.proPrice || DEFAULT_PRICING.proPrice,
        businessPrice: data.businessPrice || DEFAULT_PRICING.businessPrice,
      };
    }
  } catch { /* fall through to default */ }
  return DEFAULT_PRICING;
}

export async function updatePricing(pricing: PricingConfig): Promise<void> {
  await setDoc(doc(db, 'config', 'pricing'), {
    proPrice: pricing.proPrice,
    businessPrice: pricing.businessPrice,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ---------------------------------------------------------------------------
// Existing hardcoded Square links (legacy fallback)
// ---------------------------------------------------------------------------
export const SQUARE_LINKS: Record<string, string> = {
  pro: 'https://square.link/u/t3wedRic?src=sheet',
  business: 'https://square.link/u/PhQ6IzOn?src=sheet',
};

// ---------------------------------------------------------------------------
// Dynamic Square Checkout via Cloud Function (primary path)
// ---------------------------------------------------------------------------
interface CheckoutResult {
  url: string;
  orderId: string | null;
}

export async function createSquareCheckout(
  plan: string,
  price: number,
  successUrl?: string,
  cancelUrl?: string,
): Promise<CheckoutResult> {
  const functions = getFunctions();
  const createCheckoutFn = httpsCallable<{
    plan: string;
    price: number;
    successUrl?: string;
    cancelUrl?: string;
  }, CheckoutResult>(functions, 'createCheckout');

  const result = await createCheckoutFn({ plan, price, successUrl, cancelUrl });
  return result.data as CheckoutResult;
}

// ---------------------------------------------------------------------------
// Legacy pending upgrade (kept for backward compat — Prefer createSquareCheckout)
// ---------------------------------------------------------------------------
export async function createPendingUpgrade(uid: string, plan: string, price: number) {
  const ref = await addDoc(collection(db, 'pendingUpgrades'), {
    uid,
    plan,
    price: price || null,
    createdAt: serverTimestamp(),
    used: false,
  });
  return ref.id;
}

// ---------------------------------------------------------------------------
// Apply pending upgrades (used by SuccessPage fallback)
// ---------------------------------------------------------------------------
export async function applyPendingUpgrades(uid: string) {
  const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('uid', '==', uid)));
  if (snap.empty) return { applied: 0 };

  let applied = 0;
  for (const d of snap.docs) {
    const data = d.data();
    await addDoc(collection(db, 'upgrades'), {
      uid,
      plan: data.plan,
      price: data.price,
      orderId: data.orderId || null,
      checkoutUrl: data.checkoutUrl || null,
      createdAt: serverTimestamp(),
      appliedAt: serverTimestamp(),
      source: 'auto_success_page',
    });
    await updateDoc(doc(db, 'users', uid), {
      plan: data.plan,
      planUpdatedAt: serverTimestamp(),
    });
    await deleteDoc(d.ref);
    applied++;
  }
  return { applied };
}

export async function cancelPendingUpgrades(uid: string) {
  const snap = await getDocs(query(collection(db, 'pendingUpgrades'), where('uid', '==', uid)));
  const promises = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(promises);
}

// ---------------------------------------------------------------------------
// Payment History (Phase 2)
// ---------------------------------------------------------------------------
export interface PaymentRecord {
  id: string;
  plan: string;
  price: number;
  amountPaid: number;
  currency: string;
  cardBrand: string | null;
  lastFour: string | null;
  receiptUrl: string | null;
  paymentId: string | null;
  orderId: string | null;
  source: string;
  appliedAt: number | null;
}

export async function getPaymentHistory(): Promise<PaymentRecord[]> {
  const functions = getFunctions();
  const fn = httpsCallable<Record<string, never>, { history: PaymentRecord[] }>(
    functions,
    'getPaymentHistory',
  );
  const result = await fn({});
  return result.data.history;
}

// ---------------------------------------------------------------------------
// Payment Details (admin only — Phase 2)
// ---------------------------------------------------------------------------
export async function getPaymentDetails(orderId: string): Promise<Record<string, unknown>> {
  const functions = getFunctions();
  const fn = httpsCallable<{ orderId: string }, Record<string, unknown>>(
    functions,
    'getPaymentDetails',
  );
  const result = await fn({ orderId });
  return result.data;
}
