# Square Integration Guide

## What's Already Working (Phase 1 — Client-Side)

The checkout flow is **fully automated end-to-end** with these security improvements:

1. **State tokens** — Every checkout gets a random 32-char token stored in Firestore
2. **Verified success page** — `/success?state=abc123` checks the token before applying the upgrade
3. **30-minute expiry** — Pending upgrades auto-expire and delete themselves
4. **Lazy apply on Dashboard** — If a user pays but never hits `/success`, the upgrade applies automatically when they visit Dashboard
5. **One-time use** — State tokens can only be consumed once

## Square Dashboard Setup (for Phase 2 — Webhooks)

### 1. Get your credentials
1. Go to https://developer.squareup.com/apps
2. Create or open your NownCard app
3. Switch to **Sandbox** for testing, **Production** for live
4. Copy:
   - **Application ID**
   - **Access Token** (Sandbox / Production)
   - **Webhook Signature Key** (under Webhooks section)

### 2. Configure environment variables

```bash
# Set Firebase Functions config
firebase functions:config:set square.access_token="YOUR_ACCESS_TOKEN"
firebase functions:config:set square.environment="sandbox"
firebase functions:config:set square.webhook_signature_key="YOUR_SIGNATURE_KEY"
```

### 3. Register the webhook endpoint

In the Square Developer Dashboard:
1. Go to **Webhooks** → **Subscriptions**
2. Click **Create Subscription**
3. Set URL to: `https://us-central1-vcard-studio-314.cloudfunctions.net/squareWebhook`
   (Replace with your actual Firebase Functions URL)
4. Select events:
   - `payment.created`
   - `payment.updated`
5. Save

### 4. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 5. Test the webhook (optional)

Square provides webhook test events in the dashboard, or you can use the sandbox test cards:
- **Visa**: `4111 1111 1111 1111`
- **Expiry**: Any future date
- **CVV**: Any 3 digits
- **ZIP**: Any 5 digits

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Landing   │────▶│ Square Link  │────▶│   Square    │
│   (Upgrade) │     │  + state     │     │   Checkout  │
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                                                │ redirect
                                                ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Dashboard  │◀────│   /success   │◀────│   User      │
│ (lazy apply)│     │ verify state │     │ completes   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            │ webhook (Phase 2)
                            ▼
                     ┌──────────────┐
                     │ Cloud Function│
                     │  squareWebhook│
                     └──────────────┘
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/payments.ts` | Added state tokens, verification, expiry, lazy apply |
| `src/pages/LandingPage.tsx` | Passes `state` token in Square redirect URL |
| `src/pages/SuccessPage.tsx` | Verifies state token before applying upgrade |
| `src/pages/DashboardPage.tsx` | Calls `lazyApplyPendingUpgrade` on mount |
| `functions/src/index.ts` | Cloud Function webhook handler skeleton |
| `scripts/test-square.js` | CLI script to test Square API credentials |
