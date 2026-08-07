# NownCard v2 — Working Memory

> React 19 + Vite + Tailwind v4 + Firebase v12 + Square (payments)
> Live: https://nowncard.com (custom domain → `vcard-studio-314` hosting site in project `vcard-studio-314`)
> Staging: https://nowncard-v2.web.app
> Repo: https://github.com/MaryTheadoor/nowncard-v2 (branch `master`)

---

## Last Session

**Date:** 2026-08-06
**Agent focus:** Security hardening, UI unification, cleanup round, documentation refresh, share previews

### What Got Done
1. **Save-to-Contacts + Save Image** (new):
   - Storage bucket CORS enabled (via `ensureStorageCors()` in `preview.ts`, idempotent
     on cold start) — **fixes "Save Image"**, which silently failed because html2canvas
     couldn't read Firebase Storage photos (no CORS header → tainted canvas →
     `toDataURL()` SecurityError). Verified `Access-Control-Allow-Origin: *` live.
   - `saveToContacts()` (`src/lib/vcard.ts`): Android Chrome-family → `intent://`
     `android.intent.action.INSERT` contact editor pre-filled (1 tap to Save);
     iOS → opens vCard in new tab (native contact sheet); desktop → `.vcf` download.
   - `CardViewerPage`: both save buttons use the smart flow; mobile-only
     "Download .vcf" fallback link; Save Image has Generating… state + error toast.
    - **Research:** Contact Picker API is read-only (can't write contacts), so
      intent/`vCard` is the practical minimum-tap path per platform.
0. **Dynamic share previews** (new) — card pages now render real link previews:
   - `cardPage` Cloud Function serves `/card/:slug` with per-card `og:*`/`twitter:*` meta
     injected into `index.html` (crawlers don't run JS, so JS-set meta was invisible to them).
   - `cardOgImage` Cloud Function renders a branded 1200×630 thumbnail at
     `/og-images/<slug>.png` (satori + @resvg/resvg-js + @fontsource/inter): accent color,
     profile photo (or initials), name, job/company, bio blurb, NownCard mark. Cached 1h,
     cache-busted by `updatedAt`.
   - Hosting rewrites: `/card/**` → `cardpage`, `/og-images/**` → `cardogimage`.
2. **Security rework** (`1d3c5ae`) — server-authoritative plan/admin:
   - Plan activation moved to a server callable `applyPendingUpgrade` (only applies when the HMAC-verified webhook set `paymentCompleted: true`). Removed the exploitable client-side transaction in `src/lib/payments.ts`.
   - Admin elevation via `bootstrapAdmin` callable checking a server-side allowlist (`ADMIN_UIDS` in `functions/src/index.ts`). Client can no longer self-grant `isAdmin` or `plan`.
   - Locked Firestore rules: `users` create blocks `isAdmin`/`plan`, self-update blocks sensitive fields, self-delete admin-only; `pendingUpgrades` create blocked; `upgrades` admin-only writes; analytics `hasAny` → `hasOnly`.
   - Webhook now verifies paid amount ≥ configured price before applying.
   - Added CSP + Permissions-Policy headers, `sw.js`/`firebase-messaging-sw.js` → `no-cache`.
   - Blocked SVG uploads in `storage.rules` (script risk).
   - FCM push only sent when card owner matches recipient (anti-spam).
   - **CSP fix** (`b9c4b9a`): added `apis.google.com`/gstatic to `script-src`, authDomain to `frame-src` — unblocked Google sign-in popup.
3. **Medium patch round** (`bb325a8`) — editor hex color sync, favorite refresh via `refreshUserData()`, origin-relative QR poster URL, surfaced silent load failures (Admin stats, Rolodex, payment details).
4. **Cleanup round** (`c2883d1`) — removed dead code (`CardPreview.tsx`, `captureElementAsJPEG`, `signInAnon`, `normalizeCardContacts`, `UserData`/`Plan` types, dead CSS). Unified editor segmented toggles onto the `btn` system (`btn-selected`). FAQ pricing now reads from dynamic `config/pricing`.

### Build Status
- `npm run build` ✅
- `npm run lint` ✅ (0 errors, 0 warnings)
- Dev server: `npm run dev` → http://localhost:5173

### Deployed (2026-08-06)
- Functions + Firestore rules + Storage rules → project `vcard-studio-314`
- Hosting → `nowncard-v2.web.app` AND `vcard-studio-314.web.app` (staging + prod, same dist)
- Verified: CSP/Permissions headers live, `sw.js` no-cache live, webhook signed test → HTTP 200

---

## Architecture Snapshot (Current)

### Frontend (`src/`)
- Vite SPA, lazy-loaded routes (`src/App.tsx`): Dashboard, Editor, CardViewer, Success, Cancel, Admin, Nfc, Analytics, Rolodex, Terms, Privacy, NotFound, QrPoster, Contact.
- Auth: `src/hooks/useAuth.tsx` (AuthProvider context) + `useTheme` + `useFCM`.
- Shared UI: `Navbar`, `Footer`, `BackLink`, `AuthModal`, `ShareModal`, `AppointmentModal`, `DemoCard`, `LiveCardPreview`, `LivePagePreview`, `CardIcons`.
- **Button system** (`src/index.css`): `btn btn-primary` (gold), `btn btn-secondary` (blue), `btn-danger`, sizes `btn-xs`→`btn-xl`, `btn-selected` toggle state. All app buttons use this.
- Payments client: `src/lib/payments.ts` (calls `createCheckout`, `applyPendingUpgrade`, `getPaymentHistory`, `getPaymentDetails` callables).

### Backend (`functions/`)
- Node 22, Firebase Functions v2. Entry: `functions/src/index.ts` (+ `src/preview.ts`).
- Callables: `createCheckout`, `applyPendingUpgrade`, `bootstrapAdmin`, `getPaymentHistory`, `getPaymentDetails`.
- Triggers: `squareWebhook` (HMAC-verified), `notifyOnMessage`, `notifyOnAppointment`, `cleanupPendingUpgrades` (6h schedule).
- **Preview functions** (HTTP, `src/preview.ts`): `cardPage` (`/card/**` — index.html + injected og/twitter meta), `cardOgImage` (`/og-images/<slug>.png` — satori+resvg branded 1200×630 PNG). Cloud Run services `cardpage` / `cardogimage`, us-central1.
- Secrets: `SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY` (v3, set via Node stdin — PowerShell pipe corrupts with CRLF).
- Params (non-secret) in `functions/.env`: `SQUARE_ENVIRONMENT`, `SQUARE_LOCATION_ID`, `SQUARE_WEBHOOK_URL` (pinned to `https://squarewebhook-bms24k7cqa-uc.a.run.app`).
- **Important:** secrets must NOT be in `functions/.env` (Cloud Run rejects overlap). Emulator secrets in gitignored `functions/.env.local`.

### Firebase
- Project: `vcard-studio-314` (Firebase CLI logged in as `mary.theadoor.doctor@gmail.com`).
- Hosting sites: `nowncard-v2` (staging) + `vcard-studio-314` (prod, custom domain nowncard.com).
- Square webhook URL: `https://squarewebhook-bms24k7cqa-uc.a.run.app` (no trailing slash).
- App Check: disabled. FCM: configured, `notifyOnMessage` deployed, end-to-end delivery unverified.

---

## Feature Status (Actual — matches code)

### Editor (/editor, /editor/:id)
- [x] Name fields (prefix, first, middle, last, suffix, nickname)
- [x] Work fields (job title, department, company)
- [x] Contact arrays (phones, emails, websites, addresses)
- [x] Bio, birthday, anniversary (hidden-dates toggle)
- [x] Profile + background photo upload (client-side compression, 800px/85%/5MB)
- [x] Slug auto-generation + debounced availability check (400ms)
- [x] Public toggle, team-card toggle (business), name layout (personal/business)
- [x] Appearance: accent/card-bg/page-bg/text hex inputs + presets + background positioner
- [x] Typography: Google Fonts (pro+), custom font upload (business), font-size scale
- [x] Live preview (`LivePagePreview`), persistent bottom action bar (Cancel/Copy/View/Save)
- [x] Hex color states sync correctly when loading an existing card

### Dashboard (/dashboard)
- [x] Personal + team card lists, search, plan badge
- [x] Card actions: View, Copy, vCard, NFC, Poster, Analytics, Edit, Make Public/Private, Delete
- [x] Heart/star favorites (write + refresh `userData`)
- [x] Tabs: My Cards / Inquiries / Appointments / Feedback / Billing
- [x] Inquiries inbox (mark read, delete), appointments (confirm/cancel/delete), reviews (star rating), billing (Square payment history)
- [x] Demo card creation, notifications (FCM) opt-in

### Public Card (/card/:slug)
- [x] Load by slug (cards + publicCards fallback), view-count increment
- [x] 3D flip, front/back faces, QR, vCard export, save image
- [x] Owner "Edit Card" button, appointment booking (if enabled), inquiry messaging
- [x] Featured links (link tree), theme/font rendering
- [x] Analytics tracking (views, taps, time-on-page, device, referrer)

### Share Previews (link unfurling)
- [x] `/card/:slug` served with server-injected `og:*`/`twitter:*` meta (works in WhatsApp, iMessage, Facebook, LinkedIn, Discord, Slack, X — no JS required)
- [x] Generated 1200×630 branded thumbnail at `/og-images/<slug>.png` (accent color, profile photo or initials, name, job/company, bio, NownCard mark)
- [x] `og:image` cache-busted by `updatedAt`; fallback to homepage meta for unknown/private slugs

### Other Pages
- [x] Analytics (/analytics/:id), NFC (/nfc/:slug), QR Poster (/poster/:slug), Rolodex (/rolodex)
- [x] Admin (/admin) — stats, pricing, pending upgrades, upgrades, users, cards, reviews
- [x] Success/Cancel (Square redirect), Terms, Privacy, Contact, 404

### Payments (Square)
- [x] Dynamic checkout via `createCheckout` (server-side pricing, redirect allowlist, pending dedupe)
- [x] Webhook applies plan atomically + idempotently, verifies HMAC + amount
- [x] `applyPendingUpgrade` callable for SuccessPage/Dashboard (server-verified)
- [x] Payment history (Billing tab) + admin payment details
- [x] Admin manual approve/reject (server writes, rules admin-only)

---

## Known Issues / Debt

- [ ] **FCM end-to-end delivery unverified** — `notifyOnMessage` deployed; send a real message + confirm notification on a device.
- [ ] **Android intent save = primary phone/email only** — `INSERT` intent supports single values; multi-field import needs the `.vcf` download.
- [ ] **iOS vCard contact sheet needs device check** — should confirm Safari presents the native sheet (vs plain download) on a physical iPhone.
- [ ] **OG preview renderer is a branded tile** — does NOT use the card's background photo; only accent color + profile pic. Could be upgraded to use the card's real bg.
- [ ] **OG previews only regenerate on new `?v=`** — after editing a card, existing previews in messaging apps refresh on re-scrape only.
- [ ] **Live checkout E2E unverified after security rework** — do a real Pro/Business purchase to confirm the success-page apply path.
- [ ] **No automated tests** — no unit/e2e suite (manual verification only).
- [ ] **App Check disabled** — optional hardening (would require reCAPTCHA).
- [ ] **`vcard-studio-TODO.md` / old docs were stale** — rewritten 2026-08-06; keep updated.
- [ ] **Analytics tap `link:` labels aggregated** (security change) — per-label link tracking removed intentionally.
- [ ] **`sw.js`/messaging-sw no-cache** — deploy-after-clean-cache best practice (bump CACHE_NAME if needed).

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (http://localhost:5173) |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | ESLint check |
| `firebase deploy --only hosting:nowncard-v2` | Deploy staging |
| `firebase deploy --only hosting:vcard-studio-314` | Deploy production |
| `firebase deploy --only functions` | Deploy Cloud Functions |
| `firebase deploy --only firestore:rules,storage` | Deploy rules |
| `cd functions && npm run build` | Build functions |
| `firebase functions:secrets:access <NAME>` | Read a secret |
