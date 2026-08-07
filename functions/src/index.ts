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

    // Dedupe: cancel any existing unpaid pending upgrades for this user first,
    // so repeated clicks don't stack up unfulfilled pending docs.
    const staleSnap = await db.collection('pendingUpgrades')
      .where('uid', '==', uid)
      .where('paymentCompleted', '==', false)
      .get();
    const batch = db.batch();
    staleSnap.docs.forEach((d) => batch.delete(d.ref));
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
// Card share previews — cardOgImage (/og-images/<slug>.png) generates a
// branded 1200x630 thumbnail; cardPage (/card/<slug>) injects per-card
// meta tags into index.html so link previews render without JS.
// ---------------------------------------------------------------------------
export { cardPage, cardOgImage } from './preview';
