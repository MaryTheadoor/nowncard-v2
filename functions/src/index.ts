/**
 * NownCard Firebase Cloud Functions (v2)
 *
 * To deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onRequest, onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Client, Environment } from 'square';

admin.initializeApp();
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Configuration (set via Firebase CLI environment variables)
//   firebase functions:secrets:set SQUARE_ACCESS_TOKEN
//   firebase functions:secrets:set ONESIGNAL_APP_ID
//   firebase functions:secrets:set ONESIGNAL_REST_KEY
// ---------------------------------------------------------------------------
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const SQUARE_ENV = process.env.SQUARE_ENVIRONMENT || 'sandbox';
const SQUARE_SIGNATURE_KEY = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID || '';
const ONESIGNAL_REST_KEY = process.env.ONESIGNAL_REST_KEY || '';

const squareClient = new Client({
  accessToken: SQUARE_ACCESS_TOKEN,
  environment: SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
});

// ---------------------------------------------------------------------------
// Square Webhook — payment.created
// ---------------------------------------------------------------------------
export const squareWebhook = onRequest(async (req, res) => {
  const signature = req.headers['x-square-signature'] as string;
  if (!signature || !SQUARE_SIGNATURE_KEY) {
    console.warn('Missing Square webhook signature or config');
    res.status(400).send('Missing signature');
    return;
  }

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

        const referenceId = payment.reference_id || payment.order_id;
        if (!referenceId) {
          console.log('Payment has no reference_id — skipping');
          res.status(200).send('No reference');
          return;
        }

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

        if (payment.status !== 'COMPLETED') {
          console.log(`Payment ${payment.id} status is ${payment.status} — not applying yet`);
          res.status(200).send('Payment not completed');
          return;
        }

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
export const createCheckout = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }

  const { plan, price } = request.data as { plan: string; price: number };
  if (!plan || !price) {
    throw new HttpsError('invalid-argument', 'Missing plan or price');
  }

  const uid = request.auth.uid;
  const referenceId = `${uid}-${plan}-${Date.now()}`;

  try {
    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: referenceId,
      quickPay: {
        name: `NownCard ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        priceMoney: { amount: BigInt(price * 100), currency: 'USD' },
        locationId: '',
      },
      redirectUrl: `https://nowncard.com/success`,
    } as Parameters<typeof squareClient.checkoutApi.createPaymentLink>[0]);

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
    throw new HttpsError('internal', 'Failed to create checkout');
  }
});

// ---------------------------------------------------------------------------
// OneSignal Push Notification — triggered on new message
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

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_KEY) {
    console.log('OneSignal not configured — skipping push notification');
    return;
  }

  if (message.senderUid === recipientUid) {
    console.log('Sender is recipient — skipping push notification');
    return;
  }

  try {
    const userDoc = await db.collection('users').doc(recipientUid).get();
    const playerId = userDoc.data()?.oneSignalPlayerId as string | undefined;

    if (!playerId) {
      console.log(`Recipient ${recipientUid} has no OneSignal player ID`);
      return;
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: [playerId],
        headings: { en: 'New inquiry on NownCard' },
        contents: { en: `${senderName}: "${content}"` },
        url: 'https://nowncard.com/dashboard',
        data: {
          messageId: event.params.messageId,
          cardSlug,
          senderName,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`OneSignal API error (${response.status}):`, errText);
      return;
    }

    const result = await response.json();
    console.log(`✅ Push notification sent to ${recipientUid}`, result);
  } catch (err) {
    console.error('Push notification error:', err);
  }
});
