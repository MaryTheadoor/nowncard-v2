# NownCard v2 — Production Status

> Current live state, environment details, and action items.
> **Last updated:** 2026-07-27
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
| Checkout | ✅ | Square checkout links |
| Webhook | ✅ | `squareWebhook` Cloud Function v2 |
| Plan activation | ✅ | Success page + webhook auto-activation |

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
| `squareWebhook` | HTTPS onRequest | Square payment webhook — applies plans on payment completion | ✅ Deployed (HMAC verified) |
| `createCheckout` | HTTPS onCall | Creates dynamic Square checkout link | ✅ Deployed |
| `getPaymentDetails` | HTTPS onCall | Payment/order details lookup | ✅ Deployed |
| `getPaymentHistory` | HTTPS onCall | User payment history | ✅ Deployed |
| `notifyOnMessage` | Firestore onDocumentCreated (`messages/{id}`) | Sends FCM push to recipient | ✅ Deployed |
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
| 2026-07-27 | Rollback | Deployed `master` build (may 18-19 state) after June 12 rebuild discarded |
| 2026-05-18 | `0a439f4` | Last stable deploy — background image fixes, BackgroundPositioner, bottom bar |
| Prior | Various | See `MASTER_SPEC.md` and git history |

---

## Action Items

### 🟡 In Progress (rebuild per MASTER_SPEC.md)
| # | Item | Phase |
|---|------|-------|
| 1 | **Auth consolidation** — context-based AuthProvider | Phase 1 |
| 2 | **CardFace component** — unify card rendering | Phase 2 |
| 3 | **Page improvements** — editor reorg, dashboard fixes | Phase 3 |
| 4 | **Visual polish** — button system, animations | Phase 4 |
| 5 | **Hardening** — CSP headers, ARIA, tests | Phase 5 |

### 🟢 Verify
| # | Item | Notes |
|---|------|-------|
| 6 | **FCM end-to-end** | Send test message, confirm notification delivery |

---

## Monitoring

- **Firebase Console > Hosting:** Check for 4xx/5xx errors
- **Firebase Console > Functions:** Check function execution logs
- **Firebase Console > Firestore > Usage:** Monitor read/write counts
- **Browser console:** Service worker registration, OneSignal init status
