import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, serverTimestamp, query, where, getDocs, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
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
// Apply pending upgrades — SERVER-verified (replaces the old client-side
// transaction, which was exploitable for free plan grants).
// ---------------------------------------------------------------------------
// pendingId: apply the exact pending doc (SuccessPage, via activeCheckout).
// Otherwise (Dashboard fallback): the server applies the newest pending doc
// that the verified webhook has flagged as paid.
export async function applyPendingUpgrades(pendingId?: string): Promise<{ applied: number }> {
  const functions = getFunctions();
  const fn = httpsCallable<{ pendingId?: string }, { applied: number }>(functions, 'applyPendingUpgrade');
  const result = await fn({ pendingId });
  return result.data;
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
