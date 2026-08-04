# NownCard v2 — Session State
> Last updated: 2026-05-15 | High-priority fixes applied (not yet deployed)
>
> ⚠️ **SUPERSEDED.** This file documents the pre-rebuild session state. The June 2026 rebuild was discarded; the canonical baseline is `master` (2026-05-19). See **`MASTER_SPEC.md`**.

---

## Current Deploy Status
- **Hosting:** ✅ Live at nowncard.com, nowncard-v2.web.app, vcard-studio-314.web.app
- **Functions:** ⚠️ 5 deployed but squareWebhook has signature verification bug in production (see fixes below)
- **Firestore:** ✅ Rules + indexes deployed (analytics rules updated locally, not yet deployed)
- **Storage:** ✅ Rules deployed
- **Build:** ✅ TypeScript + Vite passing, Functions tsc passing
- **Lint:** ✅ 0 errors, 0 warnings

---

## 🔴 High-Priority Fixes (2026-05-15)

### 1. Square Webhook — Raw Body Parsing Fixed
**Problem:** `squareWebhook` used `(req as any).rawBody` but Firebase Functions v2 `onRequest` auto-parses JSON body, discarding raw bytes. HMAC signature verification always failed.
**Fix:** Rewrote webhook to use `express.raw()` middleware via a dedicated Express app. `onRequest` now wraps the Express app with `defineSecret` for proper secret injection.
**File:** `functions/src/index.ts`
**Deploy needed:** Yes — `firebase deploy --only functions`

### 2. Secrets Migration (.env → Firebase Secrets)
**Problem:** `functions/.env` contained plaintext production Square access token and webhook signing key.
**Fix:** Replaced `.env` values with placeholder sandbox values. Added `defineSecret()` for `SQUARE_ACCESS_TOKEN` and `SQUARE_WEBHOOK_SIGNATURE_KEY`. Production secrets must be set via:
```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY
```
**Deploy needed:** Yes — set secrets before next functions deploy

### 3. AuthModal — Invisible Focusable Elements
**Problem:** Modal stayed in DOM with `opacity-0 pointer-events-none` when closed. Keyboard users could Tab into hidden form fields.
**Fix:** Added early return `if (!open) return null` — modal content is removed from DOM when closed.
**File:** `src/components/AuthModal.tsx`
**Deploy needed:** Yes — `firebase deploy --only hosting`

### 4. Analytics Spam Protection
**Problem:** `allow write: if true` on analytics collections allowed anyone to write unlimited arbitrary documents.
**Fix:** Added field validation — only known analytics fields allowed, `type` field must be string ≤ 50 chars. Writes still open (needed for anonymous tracking from public cards) but spam-safety improved.
**File:** `firestore.rules`
**Deploy needed:** Yes — `firebase deploy --only firestore:rules`

### 5. Functions Env Var Startup Validation
**Problem:** Functions silently continued with empty Square config, producing confusing errors.
**Fix:** Added startup checks that log `console.error` when `SQUARE_ACCESS_TOKEN` or `SQUARE_WEBHOOK_SIGNATURE_KEY` are missing in production.
**File:** `functions/src/index.ts`
**Deploy needed:** Yes — included with functions deploy

### 6. Pending Upgrades TTL Cleanup
**Problem:** Orphaned `pendingUpgrades` documents never cleaned up.
**Fix:** Added `expiresAt` field (createdAt + 7 days) to new pending upgrades. Webhook skips expired pendings. New scheduled function `cleanupPendingUpgrades` runs every 6 hours to delete expired documents.
**File:** `functions/src/index.ts`
**Deploy needed:** Yes — `firebase deploy --only functions`

### 7. Dependencies
- Added `express@^4.21.0` and `@types/express@^4.17.21` to `functions/package.json`
- Node.js runtime: already on **nodejs22** ✅

## What's Been Completed This Session

### Payment Pipeline
- [x] Dynamic Square checkout via Cloud Function (replaced hardcoded URLs)
- [x] Webhook signature verification (crypto HMAC-SHA256)
- [x] Dual matching (orderId + paymentLinkId) for auto-activation
- [x] Atomic webhook operations (delete pending BEFORE updating user)
- [x] BigInt float precision fix in createCheckout
- [x] Redirect URL in checkoutOptions for post-payment redirect
- [x] Dynamic pricing via Firestore config/pricing doc
- [x] Admin Pricing tab (editable Pro/Business prices)
- [x] Composite indexes: upgrades (uid, appliedAt), messages (recipientUid, createdAt)
- [x] Stripe live key removed from .env.example
- [x] Duplicate plan purchase prevention

### Admin Panel (6 tabs)
- [x] Overview — live user/card/upgrade counts
- [x] Pricing — editable plan prices saved to Firestore
- [x] Pending — approve/reject with user emails (not UIDs)
- [x] Upgrades — paginated history with card brand/last4, Square order detail drill-down
- [x] Users — search by email, plan assignment, admin badge
- [x] Cards — search by slug, toggle public/private, view link, delete

### Bug Fixes (Critical)
- [x] useAuth flicker (loading=false before userData fetched)
- [x] AuthModal silent auth failures + Google button label
- [x] saveCount increments publicCards
- [x] vCard semicolon/comma escaping
- [x] ShareModal copied state reset on reopen
- [x] SuccessPage/CancelPage use useAuth instead of raw onAuthStateChanged
- [x] App Check debug token string (was boolean)
- [x] firebase.ts init error handling with cause preservation
- [x] publicCards write rules (was admin-only, now authenticated)
- [x] Storage rules — unauthenticated read for card images
- [x] customFontUrl CSS injection (single-quote sanitization)
- [x] Missing type fields (ownerId, teamOwnerId, isAdmin, defaultCardSlug, fcmToken)
- [x] Deleted unused stripe-payments.ts (139 lines)

### Features Added
- [x] Payment links on cards (CashApp, Venmo, PayPal, Zelle, Apple/Google Pay, Stripe)
- [x] QR Poster page (/poster/:slug) — printable 8.5"×11"
- [x] Messaging (inquiry send form on cards + inbox in dashboard)
- [x] FCM push notifications (replaced OneSignal)
- [x] Pain points section on landing ("Does This Sound Familiar?")
- [x] FAQ section with Schema.org structured data
- [x] Eco-friendly messaging + sustainability section
- [x] Per-card dynamic meta description
- [x] Sitemap expanded (terms, privacy, contact)

### Code Architecture
- [x] Shared CardIcons.tsx (IconPhone, IconMail, IconGlobe, IconPin)
- [x] PLAT/PAYMENT_PLAT constants moved to utils.ts
- [x] Deleted useOneSignal.ts + onesignal.ts (replaced by useFCM + messaging.ts)
- [x] firebase-messaging-sw.js created
- [x] OneSignal CDN removed from index.html

### UI Polish
- [x] Accent color: #c9a278 → #d4a34a (punchier metallic gold)
- [x] btn-metallic class (gradient + inset shadows + press animation)
- [x] Background noise texture (SVG feTurbulence at 3% opacity)
- [x] btn-press class applied to upgrade buttons
- [x] Demo card theme inversion (light when site is dark, vice versa)
- [x] Preview scale simplified (removed XS/S/M, fixed at 0.9)
- [x] Logo moved to bottom of card back face
- [x] "Tap to flip" text removed from card faces
- [x] "Learn More" → "View Plans" (scrolls to pricing)
- [x] Big em-dash count reduced (15+ → 3)

### SEO
- [x] Viewport: removed max-scale/user-scalable (mobile-friendly)
- [x] Expanded title tag + meta description
- [x] OG image URL fixed (consistent nowncard.com domain)
- [x] OG image dimensions + locale added
- [x] JSON-LD: WebSite + Organization + FAQPage schema
- [x] robots.txt: Crawl-delay, disallowed service worker
- [x] robots meta: index, follow
- [x] <main> tag on LandingPage

---

## Remaining TODO (from full audit)

### 🔴 High
- [x] functions/.env secrets — migrated to Firebase Secrets + .env sanitized
- [x] AuthModal invisible-focusable elements — fixed with early return (removes from DOM)
- [x] Analytics open write rules — added field validation (still writable for public tracking but spam-safe)
- [x] Functions env var startup validation — logs clear errors on missing Square config
- [x] Orphaned pending upgrades — added TTL + scheduled cleanup function

### 🟡 Medium
- [ ] 32+ empty catch blocks still need console.error (only auth ones were fixed)
- [ ] Card rendering tc theme object duplicated 4x (could extract to hook)
- [ ] CardRow extracted from DashboardPage to module scope
- [ ] Firebase Admin SDK v12 → v13, firebase-functions v5 → v6
- [ ] Square SDK v38 → v42+
- [ ] Missing CSP/HSTS security headers
- [ ] Functions: CJS → ESM migration
- [ ] Dashboard 4x Firestore queries (legacy ownerId creates duplicates)
- [ ] AdminPage tab bar missing ARIA roles

### 🟢 Low
- [ ] Hardcoded admin UID in 2 files → shared constant
- [ ] SQUARE_LINKS + createPendingUpgrade dead exports
- [ ] getLuminance + getFCM unused exports
- [ ] VITE_PAYMENT_PROVIDER + VITE_STRIPE_CHECKOUT_MODE dead env vars
- [ ] SQUARE_LOCATION_ID missing from .env.example
- [ ] FEATURE_CHECKLIST.md entirely outdated
- [ ] PRODUCTION_STATUS.md action items not updated
- [ ] EditorPage ~30 unlabeled inputs (WCAG)

---

## Files Modified (34 changed, 4 new)
```
M  .env.example
M  firestore.indexes.json
M  firestore.rules
M  functions/src/index.ts
M  functions/tsconfig.json
M  index.html
M  public/robots.txt
M  public/sitemap.xml
M  src/App.tsx
M  src/components/AuthModal.tsx
M  src/components/DemoCard.tsx
M  src/components/LiveCardPreview.tsx
M  src/components/ShareModal.tsx
M  src/hooks/useAuth.ts
D  src/hooks/useOneSignal.ts
M  src/index.css
M  src/lib/firebase.ts
D  src/lib/onesignal.ts
M  src/lib/payments.ts
D  src/lib/stripe-payments.ts
M  src/lib/utils.ts
M  src/lib/vcard.ts
M  src/pages/AdminPage.tsx
M  src/pages/CancelPage.tsx
M  src/pages/CardViewerPage.tsx
M  src/pages/DashboardPage.tsx
M  src/pages/EditorPage.tsx
M  src/pages/LandingPage.tsx
M  src/pages/SuccessPage.tsx
M  src/types/index.ts
M  storage.rules
A  public/firebase-messaging-sw.js
A  src/components/CardIcons.tsx
A  src/hooks/useFCM.ts
A  src/lib/messaging.ts
A  src/pages/QrPosterPage.tsx
```

---

## Quick Deploy Commands
```bash
# Build
npm run build
cd functions && npm run build && cd ..

# Deploy all
firebase deploy

# Deploy specific
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage

# Dev
npm run dev
```

---

## Key URLs
- **Production:** https://nowncard.com
- **Firebase Console:** https://console.firebase.google.com/project/vcard-studio-314
- **GitHub:** https://github.com/MaryTheadoor/nowncard-v2
- **Square Dashboard:** https://developer.squareup.com/apps
- **Webhook URL:** https://squarewebhook-bms24k7cqa-uc.a.run.app
