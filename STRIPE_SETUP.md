# Stripe Integration Setup Guide

This project supports two payment providers: **Square** (legacy) and **Stripe** (recommended). This guide walks you through setting up Stripe + the Firebase Extension.

---

## Overview

**Architecture:**
```
User clicks Upgrade
  → App writes checkout session to Firestore
  → Firebase Extension creates Stripe Checkout session
  → Extension writes back Stripe URL
  → App redirects user to Stripe Checkout
  → User pays
  → Stripe webhook → Extension writes subscription to Firestore
  → App reads subscription on Dashboard/Success
```

**No custom Cloud Functions needed.** The Firebase Stripe Extension handles all webhook logic.

---

## Step 1: Create Stripe Products & Prices

1. Go to https://dashboard.stripe.com/products
2. Create two products:
   - **NownCard Pro** — $19/year
   - **NownCard Business** — $39/year
3. For each product, create a **recurring** price:
   - Currency: USD
   - Billing period: Yearly
4. Copy the **Price IDs** (they look like `price_1ABC...`)

---

## Step 2: Install the Firebase Stripe Extension

```bash
# Make sure you have the Firebase CLI
npm install -g firebase-tools

# Login (if not already)
firebase login

# Install the extension
firebase ext:install stripe/firestore-stripe-payments --project=vcard-studio-314
```

During installation, you'll be asked for:

| Prompt | Value |
|--------|-------|
| Cloud Functions location | `us-central1` (or your closest) |
| Stripe API key with write access | Your **Stripe Secret Key** (sk_live_... or sk_test_...) |
| Stripe webhook secret | Leave blank initially — the extension will create the webhook and show you the secret after install |
| Products collection | `products` |
| Customer collection | `customers` |
| Stripe config collection | `configuration` |
| Enable sync | Yes |
| Delete customer data on user deletion | Yes (recommended) |
| Minimum instance count | 0 (default) |

After installation, the extension will display a **Webhook Signing Secret**. Copy it and run:

```bash
firebase ext:configure stripe/firestore-stripe-payments --project=vcard-studio-314
```

Then paste the webhook secret when prompted.

---

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env` (or update your existing `.env`):

```bash
# Switch to Stripe
VITE_PAYMENT_PROVIDER=stripe

# Paste your Stripe Price IDs from Step 1
VITE_STRIPE_PRICE_PRO=price_xxx
VITE_STRIPE_PRICE_BUSINESS=price_xxx

# Use 'subscription' for recurring annual billing (recommended)
# Use 'payment' for one-time purchases
VITE_STRIPE_CHECKOUT_MODE=subscription
```

> **Note:** `VITE_` prefix is required for Vite to expose env vars to the client.

---

## Step 4: Deploy Firestore Rules

The Stripe Extension needs access to the `customers` collection and its subcollections. The rules have already been updated in `firestore.rules`. Deploy them:

```bash
firebase deploy --only firestore:rules
```

---

## Step 5: Test the Flow

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Sign in and click **Upgrade to Pro**
3. You should be redirected to Stripe Checkout (test mode URLs start with `https://checkout.stripe.com/c/pay/...`)
4. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
5. After payment, you'll return to `/success?session_id=xxx`
6. Check Dashboard — your plan should show **pro**

---

## Step 6: Go Live

1. In Stripe Dashboard, toggle from **Test mode** to **Production**
2. Create the same products/prices in production
3. Copy the new production Price IDs to your `.env`
4. Re-install or reconfigure the Firebase Extension with your **live Secret Key** (`sk_live_...`)
5. The extension will create a new production webhook
6. Update the webhook secret in the extension config
7. Rebuild and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

---

## Switching Back to Square

If you need to revert:

```bash
# In .env
VITE_PAYMENT_PROVIDER=square
```

Then rebuild and deploy. The Square flow (state tokens + pending upgrades) still works.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "No Stripe Price ID configured" | Check that `VITE_STRIPE_PRICE_PRO` and `VITE_STRIPE_PRICE_BUSINESS` are set in `.env` and restart the dev server |
| "Stripe checkout timed out" | The Firebase Extension may not be installed or the Cloud Function is cold-starting. Wait 30s and retry. |
| Subscription not showing after payment | The webhook may not be configured. Check the Firebase Extension logs in the Firebase Console. |
| "Permission denied" on customers collection | Deploy the updated `firestore.rules`. The Stripe Extension writes to these collections. |
| Plan not syncing on Dashboard | `syncUserPlan` is called on Dashboard mount. If it fails silently, check the browser console for errors. |

---

## Files Changed

| File | Purpose |
|------|---------|
| `src/lib/stripe-payments.ts` | Stripe Checkout creation, subscription reading, plan sync |
| `src/lib/payments.ts` | Provider-agnostic wrapper (`startCheckout`, `syncUserPlan`) |
| `src/pages/LandingPage.tsx` | Pricing cards use `startCheckout` |
| `src/pages/SuccessPage.tsx` | Handles both Stripe (`session_id`) and Square (`state`) returns |
| `src/pages/DashboardPage.tsx` | Calls `syncUserPlan` on mount |
| `firestore.rules` | Added rules for `customers/*` collections |
| `.env.example` | Added Stripe config vars |
