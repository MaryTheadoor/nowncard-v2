/**
 * NownCard Firebase Cloud Functions (v2)
 *
 * To deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import * as crypto from 'crypto';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest, onCall, HttpsError, Request } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Client, Environment } from 'square';
import express from 'express';
import { defineSecret, defineString } from 'firebase-functions/params';
import jwt from 'jsonwebtoken';

admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Secrets (set via: firebase functions:secrets:set <NAME>)
// Falls back to process.env for local .env development
// ---------------------------------------------------------------------------
const squareAccessToken = defineSecret('SQUARE_ACCESS_TOKEN');
const squareSignatureKey = defineSecret('SQUARE_WEBHOOK_SIGNATURE_KEY');
const squareWebhookUrl = defineString('SQUARE_WEBHOOK_URL', { default: '' });
const squareEnvironment = defineString('SQUARE_ENVIRONMENT', { default: 'production' });
const squareLocationId = defineString('SQUARE_LOCATION_ID', { default: '' });

function getSquareToken(): string {
  return process.env.SQUARE_ACCESS_TOKEN || '';
}
function getSignatureKey(): string {
  return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
}

// Local emulator reads functions/.env into process.env; production uses params
// (firebase functions:params:set). Default environment is production so a
// production token is never accidentally used against the sandbox API.
const SQUARE_ENV = process.env.SQUARE_ENVIRONMENT || squareEnvironment.value();
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || squareLocationId.value();

// Startup validation — fail fast if missing required config
if (!getSquareToken() && SQUARE_ENV === 'production') {
  console.error('❌ SQUARE_ACCESS_TOKEN not set. Payment operations will fail.');
}
if (!getSignatureKey() && SQUARE_ENV === 'production') {
  console.error('❌ SQUARE_WEBHOOK_SIGNATURE_KEY not set. Webhook verification will fail.');
}

const squareClient = new Client({
  accessToken: getSquareToken(),
  environment: SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
});

// Server-side admin allowlist. This is the ONLY way to become an admin — the
// client can never self-grant isAdmin (rules block it; bootstrapAdmin checks
// this list server-side).
const ADMIN_UIDS = new Set(['EeiBBDTu5jOooHbxyOC98JSlt6r1']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function verifySquareSignature(signature: string, notificationUrl: string, rawBody: string): boolean {
  const key = getSignatureKey();
  if (!key) return false;
  try {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(notificationUrl + rawBody, 'utf8');
    const expected = Buffer.from(hmac.digest('base64'));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// Square signs the payload over the EXACT URL it posts to (plus the raw body).
// Prefer the explicitly-configured SQUARE_WEBHOOK_URL param; otherwise derive a
// best-effort URL from the request and log so it can be pinned down if it drifts.
function resolveNotificationUrl(req: express.Request): string {
  const explicit = squareWebhookUrl.value();
  if (explicit) return explicit.replace(/\/+$/, '');

  const host = (req.headers.host as string) || req.hostname || '';
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (!host) {
    console.warn('⚠️ Cannot derive Square webhook URL. Set the SQUARE_WEBHOOK_URL param so HMAC verification matches what Square registers.');
  }
  return `https://${host}${path}`;
}

function formatCents(amount: number): string {
  return `$${(amount / 100).toFixed(2)}`;
}

// Only allow redirects to our own domains (prevents open-redirect style abuse
// of the checkout bounce).
function sanitizeRedirectUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  try {
    const host = new URL(url).hostname;
    if (host === 'nowncard.com' || host.endsWith('.web.app') || host === 'localhost') {
      return url;
    }
  } catch {
    // malformed — fall through to fallback
  }
  return fallback;
}

interface PaymentDetails {
  paymentId?: string | null;
  orderId?: string | null;
  amountPaid?: number | null;
  currency?: string | null;
  cardBrand?: string | null;
  lastFour?: string | null;
  receiptUrl?: string | null;
  source: string;
}

// Server-only atomic apply. Used by the webhook and the applyPendingUpgrade
// callable. Reads the pending doc inside the transaction so it is idempotent
// against retries/concurrent applies.
async function applyPaidUpgradeTx(pendingRef: admin.firestore.DocumentReference, payment: PaymentDetails) {
  return db.runTransaction(async (tx) => {
    const current = await tx.get(pendingRef);
    if (!current.exists) return 'already-applied';
    const data = current.data()!;

    tx.set(db.collection('upgrades').doc(), {
      uid: data.uid,
      plan: data.plan,
      price: data.price,
      paymentId: payment.paymentId || null,
      orderId: payment.orderId || null,
      amountPaid: payment.amountPaid || null,
      currency: payment.currency || 'USD',
      cardBrand: payment.cardBrand || null,
      lastFour: payment.lastFour || null,
      receiptUrl: payment.receiptUrl || null,
      appliedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: payment.source,
    });

    tx.delete(pendingRef);
    tx.update(db.collection('users').doc(data.uid), {
      plan: data.plan,
      planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      activeCheckout: null,
    });

    return 'applied';
  });
}

// ---------------------------------------------------------------------------
// Square Webhook — reads req.rawBody (the wire-format Buffer preserved by the
// Functions Framework). express.raw() cannot be used: CF v2 pre-parses the body
// by Content-Type before the app runs, so its stream is already consumed.
// ---------------------------------------------------------------------------
const webhookApp = express();

webhookApp.post('/', async (req, res) => {
  const signature = req.headers['x-square-hmacsha256-signature'] as string;
  if (!signature) {
    console.warn('Missing Square webhook signature header');
    res.status(400).send('Missing signature');
    return;
  }

  const rawBody = (req as Request).rawBody?.toString('utf8') || '';
  if (!rawBody) {
    console.warn('Empty webhook body');
    res.status(400).send('Empty body');
    return;
  }

  const notificationUrl = resolveNotificationUrl(req);

  if (!verifySquareSignature(signature, notificationUrl, rawBody)) {
    console.warn('Square webhook signature verification failed', { notificationUrl });
    console.warn('Hint: ensure SQUARE_WEBHOOK_URL equals the webhook URL registered in the Square dashboard (scheme, host, and path must match exactly).');
    res.status(403).send('Invalid signature');
    return;
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.warn('Invalid JSON in webhook body');
    res.status(400).send('Invalid JSON');
    return;
  }

  const eventType = event.type;

  try {
    switch (eventType) {
      case 'payment.created':
      case 'payment.updated': {
        const payment = event.data?.object?.payment;
        if (!payment) {
          res.status(200).send('No payment data');
          return;
        }

        const orderId = payment.order_id;
        const paymentLinkId = (payment as Record<string, unknown>).payment_link_id as string | undefined;
        if (!orderId && !paymentLinkId) {
          console.log('Payment has no order_id or payment_link_id — skipping');
          res.status(200).send('No matching ID');
          return;
        }

        let pendingSnap;
        if (orderId) {
          pendingSnap = await db.collection('pendingUpgrades')
            .where('orderId', '==', orderId)
            .limit(1)
            .get();
        }
        if ((!pendingSnap || pendingSnap.empty) && paymentLinkId) {
          pendingSnap = await db.collection('pendingUpgrades')
            .where('paymentLinkId', '==', paymentLinkId)
            .limit(1)
            .get();
        }

        if (!pendingSnap || pendingSnap.empty) {
          console.log(`No pending upgrade for order=${orderId} link=${paymentLinkId}`);
          res.status(200).send('No pending upgrade');
          return;
        }

        const pendingDoc = pendingSnap.docs[0];
        const pending = pendingDoc.data();

        // Skip expired pending upgrades (> 7 days old)
        const expiresAt = pending.expiresAt?.toDate?.();
        if (expiresAt && expiresAt < new Date()) {
          console.log(`Pending upgrade ${pendingDoc.id} expired at ${expiresAt.toISOString()} — skipping`);
          res.status(200).send('Expired');
          return;
        }

        if (payment.status !== 'COMPLETED') {
          console.log(`Payment ${payment.id} status is ${payment.status} — not applying yet`);
          res.status(200).send('Payment not completed');
          return;
        }

        const totalMoney = payment.total_money || { amount: pending.price != null ? Math.round(pending.price * 100) : 0, currency: 'USD' };

        // Server-authoritative amount check: only apply when the paid amount
        // matches the configured price (cents). Prevents applying a plan on a
        // mismatched/partial payment.
        const expectedCents = pending.price != null ? Math.round(pending.price * 100) : 0;
        if (expectedCents > 0 && totalMoney.amount != null && totalMoney.amount < expectedCents) {
          console.warn(`⚠️ Payment ${payment.id} for ${pending.uid} paid ${totalMoney.amount}¢ but expected ≥ ${expectedCents}¢ — not applying.`);
          res.status(200).send('Amount mismatch — not applying');
          return;
        }

        // Mark as paid first so the server callable (SuccessPage/Dashboard) can
        // honor a completed payment even if the apply transaction below fails.
        // Tolerate the doc already being consumed by a concurrent apply.
        try {
          await pendingDoc.ref.update({ paymentCompleted: true });
        } catch {
          // Already applied elsewhere — the transaction below will confirm.
        }

        // Apply atomically: upgrade row + pending deletion + plan update in one
        // transaction. Re-reading the pending doc inside the transaction makes
        // this idempotent — Square retries and concurrent applies will find the
        // doc already gone and skip.
        const outcome = await applyPaidUpgradeTx(pendingDoc.ref, {
          paymentId: payment.id,
          orderId,
          amountPaid: totalMoney.amount,
          currency: totalMoney.currency,
          cardBrand: payment.card_details?.card?.card_brand || null,
          lastFour: payment.card_details?.card?.last_4 || null,
          receiptUrl: payment.receipt_url || null,
          source: 'square_webhook',
        });

        console.log(`✅ ${outcome === 'applied' ? 'Applied' : 'Skipped (already applied)'} ${pending.plan} to user ${pending.uid} via webhook — ${formatCents(totalMoney.amount)}`);
        res.status(200).send(outcome === 'applied' ? 'OK' : 'OK (already applied)');
        return;
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = event.data?.object?.refund as
          | { id?: string; status?: string; order_id?: string | null; payment_id?: string | null; amount_money?: { amount?: number } }
          | undefined;
        if (!refund) {
          res.status(200).send('No refund data');
          return;
        }
        // Only COMPLETED refunds have returned money to the buyer.
        if (refund.status !== 'COMPLETED') {
          console.log(`Refund ${refund.id} status ${refund.status} — no downgrade`);
          res.status(200).send('Refund not completed');
          return;
        }

        const orderId = refund.order_id || null;
        const paymentId = refund.payment_id || null;
        let upgradeSnap;
        if (orderId) {
          upgradeSnap = await db.collection('upgrades').where('orderId', '==', orderId).limit(1).get();
        }
        if ((!upgradeSnap || upgradeSnap.empty) && paymentId) {
          upgradeSnap = await db.collection('upgrades').where('paymentId', '==', paymentId).limit(1).get();
        }
        if (!upgradeSnap || upgradeSnap.empty) {
          console.log(`No upgrade found for refund order=${orderId} payment=${paymentId}`);
          res.status(200).send('No upgrade to downgrade');
          return;
        }

        const upgradeDoc = upgradeSnap.docs[0];
        const upgrade = upgradeDoc.data();
        const uid: string = upgrade.uid;

        // Guard against partial refunds: only revoke the plan when the refunded
        // amount covers the originally paid price.
        const refundedCents = refund.amount_money?.amount ?? Math.round((upgrade.price ?? 0) * 100);
        const paidCents = upgrade.price != null ? Math.round(upgrade.price * 100) : refundedCents;
        if (refundedCents < paidCents) {
          console.log(`Partial refund ${refund.id} of ${refundedCents}¢ < ${paidCents}¢ — keeping plan for ${uid}`);
          res.status(200).send('Partial refund — plan kept');
          return;
        }

        const userSnap = await db.collection('users').doc(uid).get();
        // Only downgrade when the user is still on the plan that was refunded —
        // if they re-upgraded since, don't clobber the newer purchase.
        if (userSnap.exists && userSnap.data()?.plan === upgrade.plan) {
          await db.collection('users').doc(uid).update({
            plan: 'free',
            planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            activeCheckout: null,
            downgradeReason: `refunded ${upgrade.plan} (${refund.id})`,
          });
          console.log(`⬇️ Downgraded ${uid} from ${upgrade.plan} to free (refund ${refund.id})`);
        } else {
          console.log(`User ${uid} on ${userSnap.exists ? userSnap.data()?.plan : '?'} (refunded was ${upgrade.plan}) — no downgrade`);
        }

        await db.collection('refunds').add({
          refundId: refund.id || null,
          paymentId: paymentId || null,
          orderId,
          upgradeId: upgradeDoc.id,
          uid,
          plan: upgrade.plan,
          amountCents: refundedCents,
          status: refund.status,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).send('OK');
        return;
      }

      default:
        console.log(`Unhandled Square event: ${eventType}`);
        res.status(200).send('Unhandled');
        return;
    }
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Internal error');
  }
});

export const squareWebhook = onRequest(
  { secrets: [squareAccessToken, squareSignatureKey] },
  webhookApp,
);

// ---------------------------------------------------------------------------
// Get Square Location ID (callable from client or used internally)
// ---------------------------------------------------------------------------
async function resolveLocationId(): Promise<string> {
  if (SQUARE_LOCATION_ID) return SQUARE_LOCATION_ID;
  try {
    const { result } = await squareClient.locationsApi.listLocations();
    const active = result.locations?.find((l) => l.status === 'ACTIVE');
    const loc = active || result.locations?.[0];
    if (loc?.id) {
      console.log(`Resolved Square location: ${loc.id} (${loc.name})${active ? '' : ' — fallback: no ACTIVE location found'}`);
      return loc.id;
    }
  } catch (err) {
    console.error('Failed to list Square locations:', err);
  }
  return '';
}

// ---------------------------------------------------------------------------
// Create Square Checkout URL (callable from client)
// ---------------------------------------------------------------------------
export const createCheckout = onCall(
  { secrets: [squareAccessToken] },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const { plan, successUrl, cancelUrl } = request.data as {
    plan: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!plan || (plan !== 'pro' && plan !== 'business')) {
    throw new HttpsError('invalid-argument', 'Invalid plan');
  }

  // Redirect allowlist — never let Square bounce users to an arbitrary host.
  const safeSuccessUrl = sanitizeRedirectUrl(successUrl, 'https://nowncard.com/success');
  const safeCancelUrl = sanitizeRedirectUrl(cancelUrl, 'https://nowncard.com/dashboard');

  // Look up price server-side — never trust client-supplied price
  let price: number;
  try {
    const pricingSnap = await db.collection('config').doc('pricing').get();
    const pricing = pricingSnap.data() || {};
    const rawPrice = plan === 'pro' ? pricing.proPrice : pricing.businessPrice;
    price = Number(rawPrice ?? (plan === 'pro' ? 19 : 39));
    if (!price || price <= 0 || !Number.isFinite(price)) {
      throw new HttpsError('internal', 'Pricing not configured');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('Failed to load pricing for checkout:', err);
    throw new HttpsError('internal', 'Failed to load pricing');
  }

  const uid = request.auth.uid;
  const idempotencyKey = `${uid}-${plan}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const locationId = await resolveLocationId();

  if (!locationId) {
    throw new HttpsError('internal', 'Square location not configured. Set SQUARE_LOCATION_ID env var.');
  }

  try {
    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey,
      quickPay: {
        name: `NownCard ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
        priceMoney: { amount: BigInt(Math.round(Number((price * 100).toFixed(2)))), currency: 'USD' },
        locationId,
      },
      checkoutOptions: {
        redirectUrl: safeSuccessUrl,
      },
      paymentNote: `NownCard ${plan} plan upgrade — ${uid}`,
    });

    const orderId = result.paymentLink?.orderId;
    const checkoutUrl = result.paymentLink?.url;
    const paymentLinkId = result.paymentLink?.id || null;

    if (!checkoutUrl) {
      throw new HttpsError('internal', 'Failed to create payment link URL');
    }

    // Dedupe: cancel stale unpaid pending upgrades for this user first, so
    // repeated clicks don't stack up unfulfilled pending docs. Only delete ones
    // older than 10 minutes — a checkout in flight in another tab must not be
    // deleted or the arriving webhook would have no pending doc to consume.
    const staleSnap = await db.collection('pendingUpgrades')
      .where('uid', '==', uid)
      .where('paymentCompleted', '==', false)
      .get();
    const staleCutoffMs = Date.now() - 10 * 60 * 1000;
    const batch = db.batch();
    staleSnap.docs.forEach((d) => {
      const createdAt = d.data().createdAt;
      const createdMs = createdAt && typeof createdAt.toMillis === 'function' ? createdAt.toMillis() : 0;
      if (createdMs && createdMs < staleCutoffMs) batch.delete(d.ref);
    });
    await batch.commit();

    const pendingRef = await db.collection('pendingUpgrades').add({
      uid,
      plan,
      price,
      orderId: orderId || null,
      paymentLinkId,
      checkoutUrl,
      cancelUrl: safeCancelUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      paymentCompleted: false,
    });

    // Point the user's active checkout at this pending doc so the /success page
    // can apply the exact upgrade that was paid (the redirect URL cannot carry
    // the link id — it only exists after this call).
    await db.collection('users').doc(uid).set({
      activeCheckout: {
        pendingId: pendingRef.id,
        plan,
        paymentLinkId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    }, { merge: true });

    return { url: checkoutUrl, orderId: orderId || null };
  } catch (err) {
    console.error('Create checkout error:', err);
    throw new HttpsError('internal', 'Failed to create checkout');
  }
});

// ---------------------------------------------------------------------------
// Bootstrap admin (callable) — server-verified admin elevation
// Only UIDs in the server-side allowlist may become admin.
// ---------------------------------------------------------------------------
export const bootstrapAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  if (!ADMIN_UIDS.has(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Not an admin');
  }

  await db.collection('users').doc(request.auth.uid).set({
    isAdmin: true,
    plan: 'business',
    planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Apply pending upgrade (callable) — server-verified plan activation
// Replaces the old client-side transaction. Only applies when the pending doc
// has paymentCompleted == true (set ONLY by the verified Square webhook).
// ---------------------------------------------------------------------------
export const applyPendingUpgrade = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  const uid = request.auth.uid;

  const pendingId = request.data?.pendingId as string | undefined;

  let pendingRef: admin.firestore.DocumentReference;
  if (pendingId) {
    const ref = db.collection('pendingUpgrades').doc(pendingId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== uid) {
      return { applied: 0 };
    }
    pendingRef = ref;
  } else {
    // Dashboard fallback: newest pending doc the webhook marked as paid.
    const snap = await db.collection('pendingUpgrades')
      .where('uid', '==', uid)
      .where('paymentCompleted', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snap.empty) return { applied: 0 };
    pendingRef = snap.docs[0].ref;
  }

  // Only apply if the webhook has verified the payment.
  const current = await pendingRef.get();
  if (!current.exists) return { applied: 0 };
  const pending = current.data()!;
  if (pending.paymentCompleted !== true) return { applied: 0 };

  const outcome = await applyPaidUpgradeTx(pendingRef, { source: 'apply_pending_upgrade' });
  return { applied: outcome === 'applied' ? 1 : 0 };
});

// ---------------------------------------------------------------------------
// Get Payment History (Phase 2 — Square Orders + Payments API)
// ---------------------------------------------------------------------------
export const getPaymentHistory = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const uid = request.auth.uid;

  try {
    const snap = await db
      .collection('upgrades')
      .where('uid', '==', uid)
      .orderBy('appliedAt', 'desc')
      .limit(20)
      .get();

    const history = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        plan: data.plan || 'unknown',
        price: data.price || 0,
        amountPaid: data.amountPaid || 0,
        currency: data.currency || 'USD',
        cardBrand: data.cardBrand || null,
        lastFour: data.lastFour || null,
        receiptUrl: data.receiptUrl || null,
        paymentId: data.paymentId || null,
        orderId: data.orderId || null,
        source: data.source || 'unknown',
        appliedAt: data.appliedAt?.toMillis?.() || null,
      };
    });

    return { history };
  } catch (err) {
    console.error('Payment history error:', err);
    throw new HttpsError('internal', 'Failed to fetch payment history');
  }
});

// ---------------------------------------------------------------------------
// Get Square Payment / Order Details (Phase 2 — for admin deep-dive)
// ---------------------------------------------------------------------------
export const getPaymentDetails = onCall(
  { secrets: [squareAccessToken] },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  // Only admins can look up specific payment details
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.data()?.isAdmin) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { orderId } = request.data as { orderId: string };
  if (!orderId) {
    throw new HttpsError('invalid-argument', 'Missing orderId');
  }

  try {
    const { result: orderResult } = await squareClient.ordersApi.retrieveOrder(orderId);
    const order = orderResult.order;

    let payment: Record<string, unknown> | null = null;
    if (order?.tenders?.length) {
      const tender = order.tenders[0];
      if (tender.paymentId) {
        try {
          const { result: payResult } = await squareClient.paymentsApi.getPayment(tender.paymentId);
          payment = {
            id: payResult.payment?.id,
            status: payResult.payment?.status,
            amountMoney: payResult.payment?.amountMoney,
            totalMoney: payResult.payment?.totalMoney,
            cardDetails: payResult.payment?.cardDetails,
            receiptUrl: payResult.payment?.receiptUrl,
            createdAt: payResult.payment?.createdAt,
          };
        } catch {
          payment = null;
        }
      }
    }

    return {
      orderId,
      state: order?.state,
      totalMoney: order?.totalMoney,
      netAmounts: order?.netAmounts,
      tenders: order?.tenders?.map((t) => ({
        type: t.type,
        amountMoney: t.amountMoney,
        paymentId: t.paymentId,
        note: t.note,
      })),
      payment,
    };
  } catch (err) {
    console.error('Payment details error:', err);
    throw new HttpsError('internal', 'Failed to fetch payment details');
  }
});

// ---------------------------------------------------------------------------
// FCM Push Notification — triggered on new message
// ---------------------------------------------------------------------------
export const notifyOnMessage = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message) {
    console.log('No message data');
    return;
  }

  const recipientUid = message.recipientUid as string;
  const senderName = message.senderName as string;
  const cardSlug = message.cardSlug as string;
  const content = (message.content as string)?.slice(0, 120) || 'New inquiry';

  if (message.senderUid === recipientUid) {
    console.log('Sender is recipient — skipping push notification');
    return;
  }

  // Anti-abuse: only push when the recipient is actually the card owner, so a
  // stranger cannot use a known UID to spam notifications.
  try {
    const cardId = message.cardId as string | undefined;
    if (cardId) {
      const cardSnap = await db.collection('cards').doc(cardId).get();
      const owner = cardSnap.data()?.ownerUid || cardSnap.data()?.ownerId;
      if (owner && owner !== recipientUid) {
        console.log(`Message recipient ${recipientUid} is not owner of card ${cardId} — skipping push`);
        return;
      }
    }
  } catch (err) {
    console.error('Failed to verify card ownership for message push:', err);
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(recipientUid).get();
    const fcmToken = userDoc.data()?.fcmToken as string | undefined;

    if (!fcmToken) {
      console.log(`Recipient ${recipientUid} has no FCM token`);
      return;
    }

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'New inquiry on NownCard',
        body: `${senderName}: "${content}"`,
      },
      webpush: {
        fcmOptions: {
          link: `https://nowncard.com/dashboard`,
        },
      },
      data: {
        messageId: event.params.messageId,
        cardSlug,
        senderName,
      },
    });

    console.log(`✅ Push notification sent to ${recipientUid}`);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'messaging/registration-token-not-registered') {
      await db.collection('users').doc(recipientUid).update({ fcmToken: admin.firestore.FieldValue.delete() });
      console.log(`Cleaned stale FCM token for ${recipientUid}`);
    } else {
      console.error('FCM push error:', err);
    }
  }
});

// ---------------------------------------------------------------------------
// FCM Push Notification — triggered on new appointment request
// ---------------------------------------------------------------------------
export const notifyOnAppointment = onDocumentCreated('appointments/{appointmentId}', async (event) => {
  const appointment = event.data?.data();
  if (!appointment) {
    console.log('No appointment data');
    return;
  }

  const ownerUid = appointment.ownerUid as string;
  const requesterName = appointment.requesterName as string;
  const requestedDate = appointment.requestedDate as string;
  const requestedTime = appointment.requestedTime as string;

  // Anti-abuse: confirm the requester actually booked the card they claim.
  try {
    const cardId = appointment.cardId as string | undefined;
    if (cardId) {
      const cardSnap = await db.collection('cards').doc(cardId).get();
      const owner = cardSnap.data()?.ownerUid || cardSnap.data()?.ownerId;
      if (owner && owner !== ownerUid) {
        console.log(`Appointment owner ${ownerUid} is not owner of card ${cardId} — skipping push`);
        return;
      }
    }
  } catch (err) {
    console.error('Failed to verify card ownership for appointment push:', err);
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(ownerUid).get();
    const fcmToken = userDoc.data()?.fcmToken as string | undefined;

    if (!fcmToken) {
      console.log(`Owner ${ownerUid} has no FCM token`);
      return;
    }

    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: 'New appointment request on NownCard',
        body: `${requesterName} requested ${requestedDate} at ${requestedTime}`,
      },
      webpush: {
        fcmOptions: {
          link: `https://nowncard.com/dashboard`,
        },
      },
      data: {
        appointmentId: event.params.appointmentId,
        cardSlug: (appointment.cardSlug as string) || '',
        requesterName,
      },
    });

    console.log(`✅ Appointment notification sent to ${ownerUid}`);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'messaging/registration-token-not-registered') {
      await db.collection('users').doc(ownerUid).update({ fcmToken: admin.firestore.FieldValue.delete() });
      console.log(`Cleaned stale FCM token for ${ownerUid}`);
    } else {
      console.error('Appointment FCM push error:', err);
    }
  }
});

// ---------------------------------------------------------------------------
// Scheduled cleanup — delete expired pendingUpgrades (> 7 days old)
// Runs every 6 hours
// ---------------------------------------------------------------------------
export const cleanupPendingUpgrades = onSchedule('every 6 hours', async () => {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const snap = await db.collection('pendingUpgrades')
    .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(cutoff))
    .limit(500)
    .get();

  if (snap.empty) {
    console.log('No expired pending upgrades to clean up');
    return;
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`🧹 Cleaned up ${snap.size} expired pending upgrades`);
});

// ---------------------------------------------------------------------------
// getBookedSlots (callable, public) — returns the booked date/time slots for a
// card so anonymous visitors can't double-book. Returns only scheduling fields
// (no requester PII). Unauthenticated reads of the appointments collection are
// blocked by rules, so this callable is the intended public path.
// ---------------------------------------------------------------------------
export const getBookedSlots = onCall(async (request) => {
  const { cardId } = request.data as { cardId?: string };
  if (!cardId || typeof cardId !== 'string') {
    throw new HttpsError('invalid-argument', 'cardId is required');
  }
  const snap = await db.collection('appointments')
    .where('cardId', '==', cardId)
    .get();
  const slots: Array<{ requestedDate: string; requestedTime: string; durationMinutes: number }> = [];
  snap.docs.forEach((d) => {
    const a = d.data();
    if (a.status === 'cancelled') return;
    if (typeof a.requestedDate === 'string' && typeof a.requestedTime === 'string') {
      slots.push({
        requestedDate: a.requestedDate,
        requestedTime: a.requestedTime,
        durationMinutes: typeof a.durationMinutes === 'number' ? a.durationMinutes : 30,
      });
    }
  });
  return { slots };
});

// ---------------------------------------------------------------------------
// submitLead (callable, anonymous) — optional full contact/lead form on a card.
// Writes into the existing `messages` collection (marked isLead) so leads show
// up in the owner's Dashboard Inquiries and fire the same FCM notify trigger.
// Basic rate limit per card to curb spam.
// ---------------------------------------------------------------------------
export const submitLead = onCall(async (request) => {
  const data = request.data as {
    cardId?: string;
    cardSlug?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    message?: string;
  };

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const company = typeof data.company === 'string' ? data.company.trim() : '';
  const cardId = typeof data.cardId === 'string' ? data.cardId : '';
  const cardSlug = typeof data.cardSlug === 'string' ? data.cardSlug : '';

  if (!cardId) throw new HttpsError('invalid-argument', 'cardId is required');
  if (!name || !email || !message) throw new HttpsError('invalid-argument', 'Name, email, and message are required');
  if (name.length > 100 || email.length > 254 || message.length > 2000 || phone.length > 40 || company.length > 120) {
    throw new HttpsError('invalid-argument', 'One or more fields are too long');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpsError('invalid-argument', 'Invalid email');

  const cardSnap = await db.collection('cards').doc(cardId).get();
  if (!cardSnap.exists) throw new HttpsError('not-found', 'Card not found');
  const card = cardSnap.data()!;
  if (card.isPublic !== true) throw new HttpsError('permission-denied', 'Card is not public');
  const owner = typeof card.ownerUid === 'string' ? card.ownerUid : typeof card.ownerId === 'string' ? card.ownerId : '';
  if (!owner) throw new HttpsError('internal', 'Card has no owner');

  // Basic spam guard: max 10 leads per card per 10 minutes. Uses a single-field
  // query (no composite index) and counts client-side so it never blocks on an
  // index build; on any error we fail open (allow) rather than reject the lead.
  let recentLeadCount = 0;
  try {
    const cutoff = Date.now() - 10 * 60 * 1000;
    const recent = await db.collection('messages').where('cardId', '==', cardId).limit(100).get();
    recentLeadCount = recent.docs.filter((d) => {
      const data = d.data();
      if (data.isLead !== true) return false;
      const at = data.createdAt;
      return at && typeof at.toMillis === 'function' ? at.toMillis() >= cutoff : false;
    }).length;
  } catch (err) {
    console.warn('[submitLead] rate-limit query failed (allowing):', err);
  }
  if (recentLeadCount >= 10) {
    throw new HttpsError('resource-exhausted', 'Too many messages for this card right now. Please try again later.');
  }

  await db.collection('messages').add({
    senderUid: '',
    senderName: name,
    senderEmail: email,
    senderPhone: phone || null,
    senderCompany: company || null,
    recipientUid: owner,
    cardId,
    cardSlug,
    content: message,
    isLead: true,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// getWalletPass (callable) — returns an "Add to Google Wallet" link for a card.
// Requires env vars on this function: GOOGLE_WALLET_ISSUER_ID (the Google Wallet
// issuer id) and GOOGLE_WALLET_SERVICE_ACCOUNT (JSON service-account key with
// Wallet access). Until those are set, returns { configured: false } so the UI
// can show "coming soon". Apple Wallet (.pkpass) needs an Apple Developer cert —
// see docs/WALLET_INTEGRATION.md.
// ---------------------------------------------------------------------------
export const getWalletPass = onCall(async (request) => {
  const slug = typeof request.data?.slug === 'string' ? request.data.slug : '';
  if (!slug) throw new HttpsError('invalid-argument', 'slug is required');

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || '';
  const saJson = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT || '';
  if (!issuerId || !saJson) {
    return { configured: false };
  }

  const cardSnap = await db.collection('cards').where('slug', '==', slug).limit(1).get();
  const card = cardSnap.docs[0]?.data();
  if (!card || card.isPublic !== true) throw new HttpsError('not-found', 'Card not found');

  const sa = JSON.parse(saJson) as { client_email?: string; private_key?: string; private_key_id?: string };
  if (!sa.client_email || !sa.private_key || !sa.private_key_id) {
    throw new HttpsError('internal', 'Wallet service account is malformed');
  }

  const cardUrl = `https://nowncard.com/card/${slug}`;
  const name = [card.firstName, card.lastName].filter(Boolean).join(' ') || card.slug || 'Contact';
  const firstEmail = Array.isArray(card.emails) ? (card.emails[0] as { address?: unknown })?.address : typeof card.email === 'string' ? card.email : '';
  const firstPhone = Array.isArray(card.phones) ? (card.phones[0] as { number?: unknown })?.number : typeof card.phone === 'string' ? card.phone : '';
  const contact = [firstEmail, firstPhone].filter(Boolean).join(' · ') || 'Shared via NownCard';

  const classId = `${issuerId}.nowncard-card`;
  const objectId = `${issuerId}.${slug}`;
  const payload = {
    iss: sa.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: ['https://nowncard.com', 'https://nowncard-v2.web.app', 'http://localhost:5173'],
    payload: {
      genericClasses: [
        {
          id: classId,
          issuerName: 'NownCard',
          logo: { sourceUri: { uri: 'https://nowncard.com/nowncard-logo.png' } },
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfo: {
                oneItem: { item: { firstValue: { fields: [{ fieldPath: 'object.firstRow' }] } } },
              },
            },
            listTemplateOverride: {
              firstRow: { fields: [{ fieldPath: 'object.firstRow' }] },
              secondRow: { fields: [{ fieldPath: 'object.secondRow' }] },
            },
          },
        },
      ],
      genericObjects: [
        {
          id: objectId,
          classId,
          state: 'ACTIVE',
          genericType: 'GENERIC_TYPE_UNSPECIFIED',
          firstRow: { kind: 'uri', uri: cardUrl },
          secondRow: { kind: 'text', textValue: name },
          barcode: { type: 'QR_CODE', value: cardUrl },
          hexBackgroundColor: '#391681',
          linksModuleData: { uris: [{ kind: 'uri', uri: cardUrl, description: 'View card' }] },
          textModulesData: [
            { header: 'Contact', body: contact },
            ...(typeof card.bio === 'string' && card.bio ? [{ header: 'About', body: card.bio.slice(0, 200) }] : []),
          ],
        },
      ],
    },
  };

  const token = jwt.sign(payload, sa.private_key, {
    algorithm: 'RS256',
    header: { alg: 'RS256', typ: 'JWT', kid: sa.private_key_id },
  });

  return { configured: true, googleSaveUrl: `https://pay.google.com/gp/v/save/${token}` };
});

// ---------------------------------------------------------------------------
// getApplePass (callable) — generates a signed .pkpass for a card.
// INACTIVE until configured: reads APPLE_PASS_TYPE_ID / APPLE_PASS_TEAM_ID /
// APPLE_PASS_CERT (base64 .p12) / APPLE_PASS_CERT_PASSWORD from the function
// env. Returns { configured: false } until then so the UI can flag it inactive.
// ---------------------------------------------------------------------------
export const getApplePass = onCall(async (request) => {
  const slug = typeof request.data?.slug === 'string' ? request.data.slug : '';
  if (!slug) throw new HttpsError('invalid-argument', 'slug is required');

  const passTypeId = process.env.APPLE_PASS_TYPE_ID || '';
  const teamId = process.env.APPLE_PASS_TEAM_ID || '';
  const certP12 = process.env.APPLE_PASS_CERT || '';
  const certPassword = process.env.APPLE_PASS_CERT_PASSWORD || '';
  if (!passTypeId || !teamId || !certP12) {
    return { configured: false };
  }

  const cardSnap = await db.collection('cards').where('slug', '==', slug).limit(1).get();
  const card = cardSnap.docs[0]?.data();
  if (!card || card.isPublic !== true) throw new HttpsError('not-found', 'Card not found');

  const cardUrl = `https://nowncard.com/card/${slug}`;
  const name = [card.firstName, card.lastName].filter(Boolean).join(' ') || card.slug || 'Contact';
  const firstEmailRaw = Array.isArray(card.emails) ? (card.emails[0] as { address?: unknown })?.address : typeof card.email === 'string' ? card.email : '';
  const firstPhoneRaw = Array.isArray(card.phones) ? (card.phones[0] as { number?: unknown })?.number : typeof card.phone === 'string' ? card.phone : '';
  const websiteRaw = Array.isArray(card.websites) ? (card.websites[0] as { url?: unknown })?.url : typeof card.website === 'string' ? card.website : '';
  const firstEmail = typeof firstEmailRaw === 'string' ? firstEmailRaw : '';
  const firstPhone = typeof firstPhoneRaw === 'string' ? firstPhoneRaw : '';
  const website = typeof websiteRaw === 'string' ? websiteRaw : '';

  const { buildApplePass } = await import('./apple-pass');
  const pkpass = await buildApplePass(
    {
      slug,
      name,
      company: typeof card.company === 'string' ? card.company : undefined,
      jobTitle: typeof card.jobTitle === 'string' ? card.jobTitle : undefined,
      phone: firstPhone || undefined,
      email: firstEmail || undefined,
      website: website || undefined,
      bio: typeof card.bio === 'string' ? card.bio : undefined,
      cardUrl,
    },
    { passTypeId, teamId, certP12Base64: certP12, certPassword },
  );

  return { configured: true, pkpassBase64: pkpass.toString('base64'), filename: `${slug}.pkpass` };
});

// ---------------------------------------------------------------------------
// adminMutation (callable) — all admin writes go through here so admin status
// is re-checked server-side (defense in depth on top of the rules).
// ---------------------------------------------------------------------------
export const adminMutation = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const adminSnap = await db.collection('users').doc(request.auth.uid).get();
  if (!adminSnap.exists || adminSnap.data()?.isAdmin !== true) {
    throw new HttpsError('permission-denied', 'Admin only');
  }

  const { op, data } = request.data as { op?: string; data?: Record<string, unknown> };

  switch (op) {
    case 'setPlan': {
      const uid = typeof data?.uid === 'string' ? data.uid : '';
      const plan = typeof data?.plan === 'string' ? data.plan : '';
      if (!uid || !['free', 'pro', 'business'].includes(plan)) throw new HttpsError('invalid-argument', 'Invalid plan');
      await db.collection('users').doc(uid).update({ plan, planUpdatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return { ok: true };
    }

    case 'approveUpgrade': {
      const upgradeId = typeof data?.upgradeId === 'string' ? data.upgradeId : '';
      const uid = typeof data?.uid === 'string' ? data.uid : '';
      const plan = typeof data?.plan === 'string' ? data.plan : '';
      const price = Number(data?.price ?? 0);
      if (!upgradeId || !uid || !['pro', 'business'].includes(plan)) throw new HttpsError('invalid-argument', 'Invalid upgrade');
      const pendingRef = db.collection('pendingUpgrades').doc(upgradeId);
      const pendingSnap = await pendingRef.get();
      const orderId = pendingSnap.exists ? (pendingSnap.data()?.orderId || null) : null;
      await db.runTransaction(async (tx) => {
        tx.update(db.collection('users').doc(uid), {
          plan,
          planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          activeCheckout: null,
        });
        tx.set(db.collection('upgrades').doc(), {
          uid,
          plan,
          price,
          orderId,
          source: 'admin_manual',
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        tx.delete(pendingRef);
      });
      return { ok: true };
    }

    case 'rejectUpgrade': {
      const upgradeId = typeof data?.upgradeId === 'string' ? data.upgradeId : '';
      if (!upgradeId) throw new HttpsError('invalid-argument', 'Invalid upgrade');
      await db.collection('pendingUpgrades').doc(upgradeId).delete();
      return { ok: true };
    }

    case 'updatePricing': {
      const proPrice = Number(data?.proPrice ?? 0);
      const businessPrice = Number(data?.businessPrice ?? 0);
      if (!Number.isFinite(proPrice) || !Number.isFinite(businessPrice) || proPrice < 1 || businessPrice < 1) {
        throw new HttpsError('invalid-argument', 'Invalid prices');
      }
      await db.collection('config').doc('pricing').set(
        { proPrice, businessPrice, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
      return { ok: true };
    }

    case 'toggleCardPublic': {
      const cardId = typeof data?.cardId === 'string' ? data.cardId : '';
      if (!cardId) throw new HttpsError('invalid-argument', 'Invalid cardId');
      const current = data?.current === true;
      await db.collection('cards').doc(cardId).update({ isPublic: !current });
      return { ok: true };
    }

    case 'deleteCard': {
      const cardId = typeof data?.cardId === 'string' ? data.cardId : '';
      if (!cardId) throw new HttpsError('invalid-argument', 'Invalid cardId');
      const cardRef = db.collection('cards').doc(cardId);
      const snap = await cardRef.get();
      const slug = snap.exists ? (snap.data()?.slug as string | undefined) : undefined;
      await cardRef.delete();
      if (slug) await db.collection('slugs').doc(slug).delete().catch(() => undefined);
      return { ok: true };
    }

    case 'toggleFeaturedReview': {
      const userId = typeof data?.userId === 'string' ? data.userId : '';
      if (!userId) throw new HttpsError('invalid-argument', 'Invalid userId');
      const featured = data?.featured === true;
      await db.collection('reviews').doc(userId).update({ featured: !featured });
      return { ok: true };
    }

    case 'deleteReview': {
      const userId = typeof data?.userId === 'string' ? data.userId : '';
      if (!userId) throw new HttpsError('invalid-argument', 'Invalid userId');
      await db.collection('reviews').doc(userId).delete();
      return { ok: true };
    }

    default:
      throw new HttpsError('invalid-argument', `Unknown op: ${op}`);
  }
});

// ---------------------------------------------------------------------------
// Card share previews — cardOgImage (/og-images/<slug>.png) generates a
// branded 1200x630 thumbnail; cardPage (/card/<slug>) injects per-card
// meta tags into index.html so link previews render without JS.
// ---------------------------------------------------------------------------
export { cardPage, cardOgImage } from './preview';
