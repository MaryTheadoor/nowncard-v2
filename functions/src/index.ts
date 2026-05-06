/**
 * NownCard Firebase Cloud Functions
 *
 * To deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Client, Environment } from 'square';

admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Configuration (set via Firebase CLI: firebase functions:config:set ...)
//   square.access_token="..."
//   square.environment="sandbox" | "production"
//   square.webhook_signature_key="..."
// ---------------------------------------------------------------------------
const config = functions.config();
const SQUARE_ACCESS_TOKEN = config.square?.access_token || process.env.SQUARE_ACCESS_TOKEN || '';
const SQUARE_ENV = config.square?.environment || process.env.SQUARE_ENVIRONMENT || 'sandbox';
const SQUARE_SIGNATURE_KEY = config.square?.webhook_signature_key || process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';

const squareClient = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
});

// ---------------------------------------------------------------------------
// Square Webhook — payment.created
// ---------------------------------------------------------------------------
export const squareWebhook = functions.https.onRequest(async (req, res) => {
  // 1. Verify Square webhook signature
  const signature = req.headers['x-square-signature'] as string;
  if (!signature || !SQUARE_SIGNATURE_KEY) {
    console.warn('Missing Square webhook signature or config');
    res.status(400).send('Missing signature');
    return;
  }

  // Note: In production, verify the HMAC-SHA256 signature here.
  // const body = JSON.stringify(req.body);
  // Square provides the signature key in the Developer Dashboard.
  // See: https://developer.squareup.com/docs/webhooks/overview#verify-webhooks

  // 2. Handle the event
  const event = req.body;
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

        // Extract reference_id that we embedded when creating the checkout
        const referenceId = payment.reference_id || payment.order_id;
        if (!referenceId) {
          console.log('Payment has no reference_id — skipping');
          res.status(200).send('No reference');
          return;
        }

        // Look up pending upgrade by reference_id (stored in the doc)
        const pendingSnap = await db
          .collection('pendingUpgrades')
          .where('referenceId', '==', referenceId)
          .limit(1)
          .get();

        if (pendingSnap.empty) {
          console.log(`No pending upgrade found for reference ${referenceId}`);
          res.status(200).send('No pending upgrade');
          return;
        }

        const pendingDoc = pendingSnap.docs[0];
        const pending = pendingDoc.data();

        // Only apply if payment succeeded
        if (payment.status !== 'COMPLETED') {
          console.log(`Payment ${payment.id} status is ${payment.status} — not applying yet`);
          res.status(200).send('Payment not completed');
          return;
        }

        // Apply the upgrade
        await db.collection('upgrades').add({
          uid: pending.uid,
          plan: pending.plan,
          price: pending.price,
          paymentId: payment.id,
          orderId: payment.order_id,
          appliedAt: admin.firestore.FieldValue.serverTimestamp(),
          source: 'square_webhook',
        });

        await db.collection('users').doc(pending.uid).update({
          plan: pending.plan,
          planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await pendingDoc.ref.delete();

        console.log(`✅ Applied ${pending.plan} to user ${pending.uid} via webhook`);
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

// ---------------------------------------------------------------------------
// Create Square Checkout URL (callable from client)
// ---------------------------------------------------------------------------
export const createCheckout = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }

  const { plan, price } = data as { plan: string; price: number };
  if (!plan || !price) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing plan or price');
  }

  const uid = context.auth.uid;
  const referenceId = `${uid}-${plan}-${Date.now()}`;

  try {
    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: referenceId,
      quickPay: {
        name: `NownCard ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        priceMoney: { amount: BigInt(price * 100), currency: 'USD' },
        locationId: '', // Set your Square location ID
      },
      redirectUrl: `https://nowncard.com/success`,
    });

    // Store the reference so the webhook can correlate
    await db.collection('pendingUpgrades').add({
      uid,
      plan,
      price,
      referenceId,
      checkoutUrl: result.paymentLink?.url,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      used: false,
    });

    return { url: result.paymentLink?.url };
  } catch (err) {
    console.error('Create checkout error:', err);
    throw new functions.https.HttpsError('internal', 'Failed to create checkout');
  }
});
