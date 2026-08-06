# NownCard v2 — Production Status

> Current live state, environment details, and action items.
> **Last updated:** 2026-08-06
> ⚠️ Source of truth is `MASTER_SPEC.md`. This file documents live state only.

---

## Live Environment

| Property | Value |
|----------|-------|
| **Primary URL** | https://nowncard.com |
| **Firebase Hosting Site 1** | https://nowncard-v2.web.app |
| **Firebase Hosting Site 2** | https://vcard-studio-314.web.app |
| **Firebase Project** | `vcard-studio-314` |
| **Firebase Console** | https://console.firebase.google.com/project/vcard-studio-314 |
| **GitHub Repo** | https://github.com/MaryTheadoor/nowncard-v2 |

---

## Build Status

| Check | Status |
|-------|--------|
| `npm run build` | ✅ Passing |
| `npm run lint` | ✅ Clean (0 errors, 0 warnings) |
| Hosting deploy | ✅ Active on both sites |

---

## Feature Status

### Core Features — LIVE
| Feature | Status | Notes |
|---------|--------|-------|
| Card editor | ✅ | Split-screen with live preview, all fields working |
| Public card viewer | ✅ | 3D flip, QR code, save/share, messaging |
| Dashboard | ✅ | Card list + real-time messaging inbox |
| vCard export | ✅ | Download + native share |
| Analytics | ✅ | Views, saves, taps, device/referrer |
| Rolodex | ✅ | Public directory with search |
| NFC programming | ✅ | Web NFC API support |
| QR poster | ✅ | Printable 8.5"×11" poster |
| Admin panel | ✅ | Pending upgrades, user search, plan assignment |
| Auth (email/Google/anonymous) | ✅ | All three methods working |
| Image upload | ✅ | Client-side compression (800px, 85%, 5MB limit) |
| Custom fonts | ✅ | Google Fonts + custom upload |
| Color customization | ✅ | Accent, card bg, page bg, text color + hex inputs |
| Messaging | ✅ | Simplified — no composite index required |

### Features Requiring Configuration
| Feature | Status | Blocker |
|---------|--------|---------|
| FCM push notifications | ⚠️ Needs verification | Client + SW configured with real keys; `notifyOnMessage` deployed. End-to-end test pending. |

### Payment Integration
| Feature | Status | Provider |
|---------|--------|----------|
| Checkout | ✅ | Square — dynamic `createCheckout` (server-side pricing, redirect allowlist, pending dedupe) |
| Webhook | ✅ | `squareWebhook` Cloud Function v2 — HMAC verified + amount verified, atomic/idempotent apply |
| Plan activation | ✅ | Server-authoritative: webhook + `applyPendingUpgrade` callable; client cannot self-grant |
| Payment history | ✅ | `getPaymentHistory` + admin `getPaymentDetails` |

---

## Security Status (2026-08-05 hardening)

| Item | Status |
|------|--------|
| Admin elevation | ✅ `bootstrapAdmin` callable + server-side allowlist; self-grant blocked in rules |
| Plan self-write | ✅ Blocked in rules; only server/admins write `plan` |
| `pendingUpgrades` client create | ✅ Blocked (`allow create: if false`) |
| `upgrades` client writes | ✅ Admin-only |
| Analytics field validation | ✅ `hasOnly` (was `hasAny`) |
| CSP / Permissions-Policy | ✅ Live on both hosting sites |
| Service worker cache | ✅ `sw.js`/`firebase-messaging-sw.js` → `no-cache` |
| SVG uploads | ✅ Blocked in `storage.rules` |
| FCM push anti-spam | ✅ Only when card owner matches recipient |

---

## Firestore Indexes

### Deployed Composite Indexes
```json
// cards collection
(slug, ownerUid) ASC
(slug, isPublic) ASC
(isPublic, updatedAt) DESC

// messages collection
(recipientUid, createdAt) DESC
(senderUid, recipientUid, createdAt) DESC
```

**Note:** Dashboard messages query was simplified on 2026-05-06 to NOT use `orderBy`, so the `recipientUid` composite index is no longer required for the dashboard. It remains deployed for other potential uses.

---

## Security Rules

| Collection | Rule Summary |
|------------|-------------|
| `users` | Own doc only (read/write), admin can read all |
| `cards` | Owner or team owner can CRUD; public cards readable by anyone |
| `messages` | Sender must be authenticated (`senderUid == request.auth.uid`); recipient can read messages sent to them |
| `publicCards` | Readable by anyone; admin write only |
| `analytics` | Write allowed by anyone (client-side tracking) |
| `pendingUpgrades` | Admin only |

---

## Cloud Functions (v2)

| Function | Trigger | Purpose | Status |
|----------|---------|---------|--------|
| `squareWebhook` | HTTPS onRequest | Square payment webhook — applies plans on payment completion | ✅ Deployed (HMAC + amount verified) |
| `createCheckout` | HTTPS onCall | Creates dynamic Square checkout link | ✅ Deployed |
| `applyPendingUpgrade` | HTTPS onCall | Server-verified plan activation (SuccessPage/Dashboard) | ✅ Deployed |
| `bootstrapAdmin` | HTTPS onCall | Server-verified admin elevation (allowlist) | ✅ Deployed |
| `getPaymentDetails` | HTTPS onCall | Payment/order details lookup | ✅ Deployed |
| `getPaymentHistory` | HTTPS onCall | User payment history | ✅ Deployed |
| `notifyOnMessage` | Firestore onDocumentCreated (`messages/{id}`) | Sends FCM push to recipient | ✅ Deployed |
| `notifyOnAppointment` | Firestore onDocumentCreated (`appointments/{id}`) | Sends FCM push on appointment request | ✅ Deployed |
| `cleanupPendingUpgrades` | Scheduled (6h) | Deletes expired pending upgrades | ✅ Deployed |

### Runtime
- Node.js 22 (deployed)

---

## Service Worker

- **Cache name:** `nowncard-v2`
- **Strategy:** Cache-first for images, network-first for HTML
- **Important:** Does NOT intercept `.js` or `.css` files — Vite content-hashes them, letting the browser cache handle versioning. This prevents stale build issues.

---

## Recent Deployments

| Date | Commit | Changes |
|------|--------|---------|
| 2026-08-06 | `c2883d1` | Cleanup: dead code removed, editor toggles unified, dynamic FAQ pricing |
| 2026-08-06 | `bb325a8` | Editor hex sync, favorite refresh, origin-relative QR, surface load errors |
| 2026-08-05 | `1d3c5ae` | **Security rework** — server-authoritative plan/admin, locked rules, CSP, SW caching |
| 2026-08-05 | `3765312` | Blue secondary buttons restored, landing section-title colors |
| 2026-08-05 | `06c3466` | Tactile button system unified app-wide |
| 2026-08-05 | `38f0af5` | Navigation unification (BackLink, underline tabs, editor back link) |
| 2026-08-05 | `81bf4ab` | Payments: apply only paid upgrade, atomically + idempotently |
| 2026-08-05 | `030dd66` | Webhook raw-body fix (`req.rawBody`) |
| 2026-08-04 | `abec8f5` | Square payment history in Dashboard Billing tab |
| 2026-07-27 | Rollback | Deployed `master` build (may 18-19 state) after June 12 rebuild discarded |
| 2026-05-18 | `0a439f4` | Last stable pre-2026-08 deploy — background image fixes, BackgroundPositioner, bottom bar |

---

## Action Items

### 🟡 Verify (blocking release confidence)
| # | Item | Notes |
|---|------|-------|
| 1 | **Live checkout E2E** | Real Pro/Business purchase after 2026-08-05 security rework (webhook verified; full flow not yet exercised) |
| 2 | **FCM end-to-end** | Send test message, confirm notification delivery to a device |

### 🟢 Done (completed 2026-08-05/06)
- ✅ Auth consolidation (context-based AuthProvider) — Phase 1
- ✅ CardFace/flip-card rendering unified (`LiveCardPreview` used everywhere; `CardPreview` removed) — Phase 2
- ✅ Page improvements (editor reorg, dashboard fixes, hex sync, favorites refresh) — Phase 3
- ✅ Visual polish (tactile button system, navigation unification) — Phase 4
- ✅ Hardening (server-authoritative payment/admin, locked rules, CSP, SW caching, SVG block) — Phase 5

---

## Monitoring

- **Firebase Console > Hosting:** Check for 4xx/5xx errors
- **Firebase Console > Functions:** Check function execution logs
- **Firebase Console > Firestore > Usage:** Monitor read/write counts
- **Browser console:** Service worker registration, OneSignal init status
