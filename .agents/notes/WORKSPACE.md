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
0. **Vertical card image + SEO/AI optimization**:
   - New `/card-images/<slug>.png` — **1080×1890 portrait** card image (photo/initials,
     name, job/company, bio, contact chips phone/email/web/address + socials). "Save
     Image" now downloads this (was the landscape OG preview).
   - SEO: per-card canonical, **Person JSON-LD** (name/jobTitle/worksFor/telephone/email/
     sameAs/address), og:image:alt + twitter:image:alt, **dynamic sitemap.xml** (static
     routes + all public card slugs; static file removed since Hosting serves files ahead
     of rewrites), semantic `<h1>` for the card name (rendered by SPA), Rolodex now reads
     `?search=` (validates the SearchAction schema).
0. **Save refinements + Save Image fix + Appointment booking v2**:
   - Android save: replaced unreliable `intent://` with `.vcf` download + **import
     dialog** (`ImportVCardModal`). iOS: "Download .vcf" is now a visible backup button.
   - Save Image: html2canvas can't parse Tailwind v4 `oklab()` colors → CardViewer now
     downloads the OG preview (`/og-images/<slug>.png`); QR poster uses `html-to-image`
     (html2canvas removed from deps).
   - **Appointment v2**: `Card.appointmentSettings` (`durationMinutes` + `weeklyHours`)
     with an Editor availability editor; `AppointmentModal` is now a month calendar grid
     → day → time slots (past/overlapping slots disabled from existing bookings); success
     screen offers Add to Google Calendar / Outlook / Download .ics.
   - Appointment docs store `durationMinutes`. `notifyOnAppointment` unchanged.
1. **Save-to-Contacts + Save Image** (prior round):
   - Storage bucket CORS enabled (via `ensureStorageCors()` in `preview.ts`, idempotent
     on cold start) — fixed the tainted-canvas SecurityError from missing CORS.
   - `saveToContacts()` (`src/lib/vcard.ts`): platform-smart save.
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

### Appointments (booking)
- [x] Editor: enable + meeting length + weekly availability editor (day toggles + start/end times)
- [x] Visitor UI: month calendar grid → day → time slots (past/overlapping slots disabled from existing bookings)
- [x] Post-booking: Add to Google Calendar / Outlook / Download .ics (Apple) — respects `durationMinutes`
- [x] Owner: Dashboard Appointments tab (confirm/cancel/delete) + FCM `notifyOnAppointment`
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

### SEO / AI-search
- [x] Per-card canonical, meta description, og/twitter (incl. image alt)
- [x] Person JSON-LD per card (name, jobTitle, worksFor, telephone, email, sameAs, address, image)
- [x] Dynamic `/sitemap.xml` — static routes + all public card slugs (function-served, 1h cache)
- [x] Semantic H1 on card pages (SPA-rendered name); single H1 on all other pages
- [x] Homepage: title/description, WebSite + Organization JSON-LD, robots.txt, canonical

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

> Full audit + backlog: **`HEALTH_CHECK.md`**. Competitive analysis: **`docs/COMPETITOR_ANALYSIS.md`** (2026-08-09).
> Health-check remediation items 1–7 completed 2026-08-07 (SSRF, refunds, bundle, slug registry, a11y, admin callables, dead-code purge).

### Strategic / competitive backlog (from competitor analysis)
- [ ] **Apple/Google Wallet Passes** — #1 feature gap; every major competitor has it.
- [ ] **Lead capture forms** — visitor form that emails the card owner (DBC core value prop).
- [ ] **Custom domains** (`card.yourdomain.com`) for Pro/Business.
- [ ] **NFC tag store** — sell pre-programmed tags (we already write tags from Android Chrome).
- [ ] **Team admin dashboard** — centralized team management for Business.
- [ ] **CRM integrations** + **AI business-card scanner** + **SOC 2** — later/enterprise.

### Technical debt

- [ ] **Plan card-limit client-only** — rules/callable enforcement or documented risk.
- [ ] **`reviews` leak reviewer email** to anonymous (featured docs) — stop storing email or split fields.
- [ ] **`messages` sender/recipient not rule-bound** — spoofable inbox spam.
- [ ] **Appointments unauthenticated spam** — `hasAll` not `hasOnly`; add caps/rate-limit.
- [ ] **`CardRow` remounts in Dashboard** on every keystroke (defined inside render).
- [ ] **LiveCardPreview ignores `backBg*` controls** — editor back-background tuning has no live effect.
- [ ] **Appointment overlap uses wall-clock across timezones** — convert to UTC instants.
- [ ] **FCM end-to-end delivery unverified** — send a real message + confirm on a device.
- [ ] **Live checkout E2E** — real Pro/Business purchase now that CSP callable block is fixed.
- [ ] **iOS vCard contact sheet needs device check** — Safari native sheet vs plain download.
- [ ] **Appointment availability is visitor-local time** — no owner-timezone model yet.
- [ ] **No Google Calendar API (OAuth) sync** — deferred phase; visitors get Add-to-Calendar links.
- [ ] **No automated tests**; **App Check disabled**.

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
