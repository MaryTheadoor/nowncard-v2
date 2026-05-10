import { doc, setDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function createStripeCheckout(
  uid: string,
  email: string,
  plan: 'pro' | 'business'
): Promise<string> {
  const priceId =
    plan === 'pro'
      ? import.meta.env.VITE_STRIPE_PRICE_PRO
      : import.meta.env.VITE_STRIPE_PRICE_BUSINESS;

  if (!priceId) throw new Error(`Stripe price ID missing for ${plan}`);

  const docId = `${uid}_${Date.now()}`;
  const sessionRef = doc(db, 'customers', uid, 'checkout_sessions', docId);

  await setDoc(sessionRef, {
    mode: 'subscription',
    price: priceId,
    success_url: `${window.location.origin}/success`,
    cancel_url: `${window.location.origin}/cancel`,
    client_reference_id: uid,
    customer_email: email || undefined,
    metadata: { plan, uid },
    createdAt: serverTimestamp(),
  });

  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(sessionRef, (snap) => {
      const data = snap.data();
      if (data?.error) {
        unsub();
        reject(new Error(data.error.message));
      }
      if (data?.url) {
        unsub();
        resolve(data.url);
      }
    });

    // 30s timeout
    setTimeout(() => {
      unsub();
      reject(new Error('Stripe checkout session timed out'));
    }, 30000);
  });
}

export async function syncStripePlanToUser(uid: string): Promise<string | null> {
  const subsSnap = await getDocs(
    query(
      collection(db, 'customers', uid, 'subscriptions'),
      where('status', 'in', ['active', 'trialing'])
    )
  );

  if (subsSnap.empty) return null;

  const sub = subsSnap.docs[0].data();
  const items = sub.items as Array<{ price: { id: string } }>;
  const priceId = items?.[0]?.price?.id;

  const proPrice = import.meta.env.VITE_STRIPE_PRICE_PRO;
  const busPrice = import.meta.env.VITE_STRIPE_PRICE_BUSINESS;

  const plan: string | null =
    priceId === proPrice ? 'pro' : priceId === busPrice ? 'business' : null;

  if (plan) {
    await setDoc(
      doc(db, 'users', uid),
      { plan, planUpdatedAt: serverTimestamp() },
      { merge: true }
    );
  }
  return plan;
}

export async function getStripePlan(uid: string): Promise<string | null> {
  try {
    const subsSnap = await getDocs(
      query(
        collection(db, 'customers', uid, 'subscriptions'),
        where('status', 'in', ['active', 'trialing'])
      )
    );
    if (subsSnap.empty) return 'free';

    const sub = subsSnap.docs[0].data();
    const items = sub.items as Array<{ price: { id: string } }>;
    const priceId = items?.[0]?.price?.id;

    const proPrice = import.meta.env.VITE_STRIPE_PRICE_PRO;
    const busPrice = import.meta.env.VITE_STRIPE_PRICE_BUSINESS;

    return priceId === proPrice ? 'pro' : priceId === busPrice ? 'business' : 'free';
  } catch {
    return 'free';
  }
}

export async function createPortalSession(uid: string): Promise<string> {
  const docId = `${uid}_${Date.now()}`;
  const portalRef = doc(db, 'customers', uid, 'portal_sessions', docId);

  await setDoc(portalRef, {
    return_url: `${window.location.origin}/dashboard`,
    createdAt: serverTimestamp(),
  });

  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(portalRef, (snap) => {
      const data = snap.data();
      if (data?.error) {
        unsub();
        reject(new Error(data.error.message));
      }
      if (data?.url) {
        unsub();
        resolve(data.url);
      }
    });

    setTimeout(() => {
      unsub();
      reject(new Error('Stripe portal session timed out'));
    }, 30000);
  });
}

export async function syncStripePlanToUserOnce(uid: string) {
  try {
    await syncStripePlanToUser(uid);
  } catch (e) {
    console.warn('[Stripe] Plan sync failed:', e);
  }
}
