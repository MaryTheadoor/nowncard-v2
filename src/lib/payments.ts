import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, serverTimestamp, query, where, getDocs, doc, deleteDoc, getDoc, setDoc, orderBy, limit, runTransaction } from 'firebase/firestore';
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
// Apply pending upgrades (used by SuccessPage fallback + Dashboard)
// ---------------------------------------------------------------------------
// pendingId: apply the exact pending doc (SuccessPage, via activeCheckout).
// Otherwise (Dashboard fallback): apply the newest pending doc that the webhook
// has flagged as paid — never applies an abandoned/unpaid checkout.
export async function applyPendingUpgrades(uid: string, pendingId?: string) {
  if (pendingId) {
    const applied = await applyPendingDoc(uid, pendingId, 'auto_success_page');
    return { applied: applied ? 1 : 0 };
  }

  const snap = await getDocs(query(
    collection(db, 'pendingUpgrades'),
    where('uid', '==', uid),
    where('paymentCompleted', '==', true),
    orderBy('createdAt', 'desc'),
    limit(1),
  ));
  if (snap.empty) return { applied: 0 };

  const applied = await applyPendingDoc(uid, snap.docs[0].id, 'auto_dashboard');
  return { applied: applied ? 1 : 0 };
}

async function applyPendingDoc(uid: string, pendingId: string, source: string): Promise<boolean> {
  let applied = false;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'pendingUpgrades', pendingId);
    const cur = await tx.get(ref);
    if (!cur.exists() || cur.data().uid !== uid) return;

    const data = cur.data();
    tx.set(doc(collection(db, 'upgrades')), {
      uid,
      plan: data.plan,
      price: data.price,
      orderId: data.orderId || null,
      checkoutUrl: data.checkoutUrl || null,
      createdAt: data.createdAt || serverTimestamp(),
      appliedAt: serverTimestamp(),
      source,
    });
    tx.delete(ref);
    tx.update(doc(db, 'users', uid), {
      plan: data.plan,
      planUpdatedAt: serverTimestamp(),
      activeCheckout: null,
    });
    applied = true;
  });
  return applied;
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
