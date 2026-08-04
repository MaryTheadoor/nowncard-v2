"use strict";
/**
 * NownCard Firebase Cloud Functions (v2)
 *
 * To deploy:
 *   cd functions && npm install && npm run build
 *   firebase deploy --only functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupPendingUpgrades = exports.notifyOnAppointment = exports.notifyOnMessage = exports.getPaymentDetails = exports.getPaymentHistory = exports.createCheckout = exports.squareWebhook = void 0;
const crypto = __importStar(require("crypto"));
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const square_1 = require("square");
const express_1 = __importDefault(require("express"));
const params_1 = require("firebase-functions/params");
admin.initializeApp();
const db = admin.firestore();
// ---------------------------------------------------------------------------
// Secrets (set via: firebase functions:secrets:set <NAME>)
// Falls back to process.env for local .env development
// ---------------------------------------------------------------------------
const squareAccessToken = (0, params_1.defineSecret)('SQUARE_ACCESS_TOKEN');
const squareSignatureKey = (0, params_1.defineSecret)('SQUARE_WEBHOOK_SIGNATURE_KEY');
const squareWebhookUrl = (0, params_1.defineString)('SQUARE_WEBHOOK_URL', { default: '' });
function getSquareToken() {
    return process.env.SQUARE_ACCESS_TOKEN || '';
}
function getSignatureKey() {
    return process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '';
}
const SQUARE_ENV = process.env.SQUARE_ENVIRONMENT || 'sandbox';
const SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || '';
// Startup validation — fail fast if missing required config
if (!getSquareToken() && SQUARE_ENV === 'production') {
    console.error('❌ SQUARE_ACCESS_TOKEN not set. Payment operations will fail.');
}
if (!getSignatureKey() && SQUARE_ENV === 'production') {
    console.error('❌ SQUARE_WEBHOOK_SIGNATURE_KEY not set. Webhook verification will fail.');
}
const squareClient = new square_1.Client({
    accessToken: getSquareToken(),
    environment: SQUARE_ENV === 'production' ? square_1.Environment.Production : square_1.Environment.Sandbox,
});
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function verifySquareSignature(signature, notificationUrl, rawBody) {
    const key = getSignatureKey();
    if (!key)
        return false;
    try {
        const hmac = crypto.createHmac('sha256', key);
        hmac.update(notificationUrl + rawBody, 'utf8');
        const expected = Buffer.from(hmac.digest('base64'));
        const actual = Buffer.from(signature);
        return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }
    catch {
        return false;
    }
}
function formatCents(amount) {
    return `$${(amount / 100).toFixed(2)}`;
}
// ---------------------------------------------------------------------------
// Square Webhook — uses express.raw() to preserve raw body for HMAC verification
// ---------------------------------------------------------------------------
const webhookApp = (0, express_1.default)();
webhookApp.use(express_1.default.raw({ type: '*/*' }));
webhookApp.post('/', async (req, res) => {
    const signature = req.headers['x-square-hmacsha256-signature'];
    if (!signature) {
        console.warn('Missing Square webhook signature header');
        res.status(400).send('Missing signature');
        return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    if (!rawBody) {
        console.warn('Empty webhook body');
        res.status(400).send('Empty body');
        return;
    }
    const notificationUrl = squareWebhookUrl.value() || `https://${req.headers.host || req.hostname}${req.originalUrl || req.url}`;
    if (!verifySquareSignature(signature, notificationUrl, rawBody)) {
        console.warn('Square webhook signature verification failed', { notificationUrl });
        res.status(403).send('Invalid signature');
        return;
    }
    let event;
    try {
        event = JSON.parse(rawBody);
    }
    catch {
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
                const paymentLinkId = payment.payment_link_id;
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
                await db.collection('upgrades').add({
                    uid: pending.uid,
                    plan: pending.plan,
                    price: pending.price,
                    paymentId: payment.id,
                    orderId: orderId,
                    amountPaid: totalMoney.amount,
                    currency: totalMoney.currency,
                    cardBrand: payment.card_details?.card?.card_brand || null,
                    lastFour: payment.card_details?.card?.last_4 || null,
                    receiptUrl: payment.receipt_url || null,
                    appliedAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'square_webhook',
                });
                await pendingDoc.ref.delete();
                await db.collection('users').doc(pending.uid).update({
                    plan: pending.plan,
                    planUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`✅ Applied ${pending.plan} to user ${pending.uid} via webhook — ${formatCents(totalMoney.amount)}`);
                res.status(200).send('OK');
                return;
            }
            default:
                console.log(`Unhandled Square event: ${eventType}`);
                res.status(200).send('Unhandled');
                return;
        }
    }
    catch (err) {
        console.error('Webhook error:', err);
        res.status(500).send('Internal error');
    }
});
exports.squareWebhook = (0, https_1.onRequest)({ secrets: [squareAccessToken, squareSignatureKey] }, webhookApp);
// ---------------------------------------------------------------------------
// Get Square Location ID (callable from client or used internally)
// ---------------------------------------------------------------------------
async function resolveLocationId() {
    if (SQUARE_LOCATION_ID)
        return SQUARE_LOCATION_ID;
    try {
        const { result } = await squareClient.locationsApi.listLocations();
        const loc = result.locations?.[0];
        if (loc?.id) {
            console.log(`Auto-detected Square location: ${loc.id} (${loc.name})`);
            return loc.id;
        }
    }
    catch (err) {
        console.error('Failed to list Square locations:', err);
    }
    return '';
}
// ---------------------------------------------------------------------------
// Create Square Checkout URL (callable from client)
// ---------------------------------------------------------------------------
exports.createCheckout = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    }
    const { plan, successUrl, cancelUrl } = request.data;
    if (!plan || (plan !== 'pro' && plan !== 'business')) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid plan');
    }
    // Look up price server-side — never trust client-supplied price
    let price;
    try {
        const pricingSnap = await db.collection('config').doc('pricing').get();
        const pricing = pricingSnap.data() || {};
        const rawPrice = plan === 'pro' ? pricing.proPrice : pricing.businessPrice;
        price = Number(rawPrice ?? (plan === 'pro' ? 19 : 39));
        if (!price || price <= 0 || !Number.isFinite(price)) {
            throw new https_1.HttpsError('internal', 'Pricing not configured');
        }
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        console.error('Failed to load pricing for checkout:', err);
        throw new https_1.HttpsError('internal', 'Failed to load pricing');
    }
    const uid = request.auth.uid;
    const idempotencyKey = `${uid}-${plan}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const locationId = await resolveLocationId();
    if (!locationId) {
        throw new https_1.HttpsError('internal', 'Square location not configured. Set SQUARE_LOCATION_ID env var.');
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
                redirectUrl: successUrl || 'https://nowncard.com/success',
            },
            paymentNote: `NownCard ${plan} plan upgrade — ${uid}`,
        });
        const orderId = result.paymentLink?.orderId;
        const checkoutUrl = result.paymentLink?.url;
        if (!checkoutUrl) {
            throw new https_1.HttpsError('internal', 'Failed to create payment link URL');
        }
        await db.collection('pendingUpgrades').add({
            uid,
            plan,
            price,
            orderId: orderId || null,
            paymentLinkId: result.paymentLink?.id || null,
            checkoutUrl,
            cancelUrl: cancelUrl || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
            used: false,
        });
        return { url: checkoutUrl, orderId: orderId || null };
    }
    catch (err) {
        console.error('Create checkout error:', err);
        throw new https_1.HttpsError('internal', 'Failed to create checkout');
    }
});
// ---------------------------------------------------------------------------
// Get Payment History (Phase 2 — Square Orders + Payments API)
// ---------------------------------------------------------------------------
exports.getPaymentHistory = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
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
    }
    catch (err) {
        console.error('Payment history error:', err);
        throw new https_1.HttpsError('internal', 'Failed to fetch payment history');
    }
});
// ---------------------------------------------------------------------------
// Get Square Payment / Order Details (Phase 2 — for admin deep-dive)
// ---------------------------------------------------------------------------
exports.getPaymentDetails = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Sign in required');
    }
    // Only admins can look up specific payment details
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.data()?.isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Admin only');
    }
    const { orderId } = request.data;
    if (!orderId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing orderId');
    }
    try {
        const { result: orderResult } = await squareClient.ordersApi.retrieveOrder(orderId);
        const order = orderResult.order;
        let payment = null;
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
                }
                catch {
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
    }
    catch (err) {
        console.error('Payment details error:', err);
        throw new https_1.HttpsError('internal', 'Failed to fetch payment details');
    }
});
// ---------------------------------------------------------------------------
// FCM Push Notification — triggered on new message
// ---------------------------------------------------------------------------
exports.notifyOnMessage = (0, firestore_1.onDocumentCreated)('messages/{messageId}', async (event) => {
    const message = event.data?.data();
    if (!message) {
        console.log('No message data');
        return;
    }
    const recipientUid = message.recipientUid;
    const senderName = message.senderName;
    const cardSlug = message.cardSlug;
    const content = message.content?.slice(0, 120) || 'New inquiry';
    if (message.senderUid === recipientUid) {
        console.log('Sender is recipient — skipping push notification');
        return;
    }
    try {
        const userDoc = await db.collection('users').doc(recipientUid).get();
        const fcmToken = userDoc.data()?.fcmToken;
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
    }
    catch (err) {
        const code = err?.code;
        if (code === 'messaging/registration-token-not-registered') {
            await db.collection('users').doc(recipientUid).update({ fcmToken: admin.firestore.FieldValue.delete() });
            console.log(`Cleaned stale FCM token for ${recipientUid}`);
        }
        else {
            console.error('FCM push error:', err);
        }
    }
});
// ---------------------------------------------------------------------------
// FCM Push Notification — triggered on new appointment request
// ---------------------------------------------------------------------------
exports.notifyOnAppointment = (0, firestore_1.onDocumentCreated)('appointments/{appointmentId}', async (event) => {
    const appointment = event.data?.data();
    if (!appointment) {
        console.log('No appointment data');
        return;
    }
    const ownerUid = appointment.ownerUid;
    const requesterName = appointment.requesterName;
    const requestedDate = appointment.requestedDate;
    const requestedTime = appointment.requestedTime;
    try {
        const userDoc = await db.collection('users').doc(ownerUid).get();
        const fcmToken = userDoc.data()?.fcmToken;
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
                cardSlug: appointment.cardSlug || '',
                requesterName,
            },
        });
        console.log(`✅ Appointment notification sent to ${ownerUid}`);
    }
    catch (err) {
        const code = err?.code;
        if (code === 'messaging/registration-token-not-registered') {
            await db.collection('users').doc(ownerUid).update({ fcmToken: admin.firestore.FieldValue.delete() });
            console.log(`Cleaned stale FCM token for ${ownerUid}`);
        }
        else {
            console.error('Appointment FCM push error:', err);
        }
    }
});
// ---------------------------------------------------------------------------
// Scheduled cleanup — delete expired pendingUpgrades (> 7 days old)
// Runs every 6 hours
// ---------------------------------------------------------------------------
exports.cleanupPendingUpgrades = (0, scheduler_1.onSchedule)('every 6 hours', async () => {
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
//# sourceMappingURL=index.js.map