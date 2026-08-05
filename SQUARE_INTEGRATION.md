# Square Integration Guide

## How Checkout Works Today

The flow is fully automated end-to-end and server-authoritative:

1. **Dynamic checkout** — Pricing is looked up server-side by the `createCheckout` Cloud Function. The client never supplies the price, so it can't be tampered with.
2. **Payment link** — `createCheckout` creates a Square Payment Link and records a `pendingUpgrades` doc (`uid`, `plan`, `price`, `paymentLinkId`, `expiresAt`) keyed to the signed-in user.
3. **Webhook auto-activation** — Square posts `payment.created` / `payment.updated` to the `squareWebhook` function. When status is `COMPLETED`, it writes an `upgrades` record, deletes the `pendingUpgrades` doc, and sets the user's plan. Requests are verified with an HMAC-SHA256 signature (header `X-Square-Hmacsha256-Signature`) over the notification URL + raw body.
4. **Lazy apply** — If the webhook is missed or the user closes the tab, the upgrade still applies when they visit `/success` or `/dashboard` (`applyPendingUpgrades` applies any of the user's remaining pending upgrades).
5. **Cancellation** — `/cancel` deletes the user's pending upgrades.
6. **Expiry** — Pending upgrades expire after 7 days; `cleanupPendingUpgrades` (scheduled, every 6h) deletes them.

### Square Dashboard Setup

1. Go to https://developer.squareup.com/apps
2. Create or open your NownCard app
3. Switch to **Sandbox** for testing, **Production** for live
4. Copy:
   - **Access Token** (Sandbox / Production)
   - **Webhook Signature Key** (under Webhooks section)
   - **Location ID** (Locations → one of your locations)

### Configure Firebase Functions

```bash
# Secrets (used for Square API + webhook HMAC)
firebase functions:secrets:set SQUARE_ACCESS_TOKEN
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY

# Params
# SQUARE_WEBHOOK_URL — the EXACT public URL Square POSTs to (e.g. https://us-central1-vcard-studio-314.cloudfunctions.net/squareWebhook).
#   Used for HMAC verification; if unset it is derived from the request, which only matches if the request host is identical.
# SQUARE_LOCATION_ID — pin a location to avoid the auto-detection API call.
firebase functions:params:set SQUARE_WEBHOOK_URL=...
firebase functions:params:set SQUARE_LOCATION_ID=...

# Or for local dev, via functions/.env (see functions/.env.example):
# SQUARE_ACCESS_TOKEN=...
# SQUARE_WEBHOOK_SIGNATURE_KEY=...
# SQUARE_LOCATION_ID=...
```

### Register the webhook endpoint

In the Square Developer Dashboard:
1. Go to **Webhooks** → **Subscriptions**
2. Click **Create Subscription**
3. Set URL to: `https://us-central1-vcard-studio-314.cloudfunctions.net/squareWebhook`
   (must match `SQUARE_WEBHOOK_URL`)
4. Select events:
   - `payment.created`
   - `payment.updated`
5. Save

### Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### Test with sandbox

Sandbox test cards:
- **Visa**: `4111 1111 1111 1111`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **ZIP**: Any 5 digits

## Architecture

```
┌─────────────┐   createCheckout   ┌──────────────┐   redirect   ┌─────────────┐
│  Landing    │ ─────────────────▶ │  Square Link │ ────────────▶ │    Square   │
│  (Upgrade)  │  (server pricing)  │  + pendingUpgrades           │   Checkout  │
└─────────────┘                    └──────────────┘               └─────────────┘
                                                                        │
                                  webhook (payment.created/updated)     │ redirect
                                        ▼                               ▼
                              ┌─────────────────┐                ┌─────────────┐
                              │ squareWebhook   │                │  /success   │
                              │ HMAC verify →   │                │  applyPending│
                              │ apply plan      │                │  Upgrades   │
                              └─────────────────┘                └─────────────┘
                                        │                               │
                                        ▼                               ▼
                              ┌─────────────────────────────────────────────┐
                              │  /dashboard lazy-apply (safety net)         │
                              └─────────────────────────────────────────────┘
```

## Files

| File | Role |
|------|------|
| `functions/src/index.ts` | `createCheckout`, `squareWebhook`, `getPaymentDetails`, `getPaymentHistory`, `cleanupPendingUpgrades` |
| `src/lib/payments.ts` | Client wrappers: `createSquareCheckout`, `applyPendingUpgrades`, `cancelPendingUpgrades`, `getPaymentHistory`, `getPaymentDetails`, pricing read/write |
| `src/pages/LandingPage.tsx` | Pricing section → `createSquareCheckout` |
| `src/pages/SuccessPage.tsx` | `applyPendingUpgrades` on load |
| `src/pages/CancelPage.tsx` | `cancelPendingUpgrades` on load |
| `src/pages/DashboardPage.tsx` | Lazy-apply on mount |
| `src/pages/AdminPage.tsx` | Pending approvals, upgrade history, pricing editor |
| `firestore.rules` | `pendingUpgrades` create validation + admin management |
