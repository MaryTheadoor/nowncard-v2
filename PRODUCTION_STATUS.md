# NownCard v2 — Production Status

> Current live state, environment details, and action items.
> **Last updated:** 2026-05-06

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
| Push notifications | ⚠️ Non-functional | OneSignal placeholder app ID in `index.html` and Cloud Function config |

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
| `squareWebhook` | HTTPS onRequest | Square payment webhook — applies plans on payment completion | ✅ Deployed |
| `createCheckout` | HTTPS onCall | Creates Square checkout link for plan upgrades | ✅ Deployed |
| `notifyOnMessage` | Firestore onDocumentCreated (`messages/{id}`) | Sends OneSignal push notification to recipient | ⚠️ Deployed but non-functional (placeholder credentials) |

### Runtime
- Node.js 20 (deprecated 2026-10-30) — migrate to Node.js 22 before deadline

---

## Service Worker

- **Cache name:** `nowncard-v2`
- **Strategy:** Cache-first for images, network-first for HTML
- **Important:** Does NOT intercept `.js` or `.css` files — Vite content-hashes them, letting the browser cache handle versioning. This prevents stale build issues.

---

## Recent Deployments

| Date | Commit | Changes |
|------|--------|---------|
| 2026-05-06 | Current | Messaging simplified (no index), back face background image, legacy ownerUid fix, anti-spam removed, documentation overhaul |
| 2026-05-05 | `8040cf1` | Build stabilization, lint fixes, admin fixes, meta tags |
| Prior | Various | See `DEVELOPMENT_LOG.md` |

---

## Action Items

### 🔴 Critical (User-facing)
| # | Item | Owner | Notes |
|---|------|-------|-------|
| 1 | **OneSignal credentials** | You | Replace placeholder `YOUR_ONESIGNAL_APP_ID` in `index.html`. Set `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_KEY` as Firebase function secrets. |
| 2 | **Test messaging end-to-end** | You | Send a message from a public card to your own card. Verify it appears in dashboard. |

### 🟡 Medium (Technical debt)
| # | Item | Notes |
|---|------|-------|
| 3 | **Migrate Cloud Functions to Node.js 22** | Node.js 20 runtime deprecated 2026-10-30. Update `functions/package.json` engine field and redeploy. |
| 4 | **publicCards sync** | No active mirroring logic. Either implement sync or remove fallback queries. |
| 5 | **Chunk size** | Main JS bundle ~890KB. Consider code-splitting routes with `React.lazy()`. |

### 🟢 Low (Polish)
| # | Item | Notes |
|---|------|-------|
| 6 | **Content-Security-Policy headers** | Add CSP to `firebase.json` hosting headers. |
| 7 | **Playwright tests** | PRD mentions e2e tests but none exist. |
| 8 | **prefers-reduced-motion** | Add `@media (prefers-reduced-motion: reduce)` for flip animation. |

---

## Monitoring

- **Firebase Console > Hosting:** Check for 4xx/5xx errors
- **Firebase Console > Functions:** Check function execution logs
- **Firebase Console > Firestore > Usage:** Monitor read/write counts
- **Browser console:** Service worker registration, OneSignal init status
