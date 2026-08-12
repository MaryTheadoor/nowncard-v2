# NownCard v2 — Session State (resume here)

> **Date:** 2026-08-10 · **Branch:** `master` · **Repo:** github.com/MaryTheadoor/nowncard-v2
> **Live:** https://nowncard.com (prod, hosting site `vcard-studio-314`) · staging https://nowncard-v2.web.app
> **Firebase project:** `vcard-studio-314` · **Stack:** React 19 + Vite 8 + Tailwind v4 + Firebase v12 (Auth/Firestore/Storage/Functions v2) + Square
>
> Read this file first, then `AGENTS.md`, then `.agents/notes/WORKSPACE.md` and `HEALTH_CHECK.md`.

---

## Current state (all committed & pushed)

Everything below is **deployed and verified** unless noted.

### Features shipped (recent)
- **Dynamic share previews** — `/card/:slug` served with server-injected og/twitter meta +
  Person JSON-LD + canonical; dynamic `/sitemap.xml` (all public cards). `cardPage`/`cardOgImage` functions.
- **Card images & QR** — `/card-images/<slug>.png` (1080×1890 portrait w/ contact info,
  optional `?qr=1` QR panel) + `/qr-images/<slug>.png` (standalone QR, url or vCard per `qrMode`).
  Card page "Save Image" opens a dialog (image / image+QR / QR only).
- **Save to Contacts** — iOS opens native contact sheet (with "Download .vcf" backup +
  import dialog); Android/desktop download `.vcf` + import dialog.
- **Appointments v2** — `appointmentSettings` (weekly hours + duration), calendar grid +
  time-slot booking (booked slots disabled via `getBookedSlots` callable), add-to-calendar
  (Google/Outlook/ics) on success.
- **Menu (Business)** — food-truck/venue menu on card page with "view full menu" toggle;
  category images; Editor editor.
- **Lead capture** — `leadFormEnabled` → full contact form (anonymous via `submitLead`
  callable) → lands in Dashboard Inquiries with a Lead badge + FCM notify.
- **Skeuomorphic/material pass** — raised-panel tile texture + recessed form fields.
- **NFC** — program tags from Android Chrome (URL or vCard), owner private-card fallback.
- **Admin console** — loads ALL users/cards on tab open; robust live case-insensitive
  substring search (email/name/uid, slug/company/owner, etc.); admin mutations via
  `adminMutation` callable.
- **Deep-purple dark theme** (`#391681` page bg, navy tiles, brighter gold).

### Reliability/security (done)
- CSP fixed (callables + storage fonts unblocked), analytics `taps` rule fixed,
  appointment double-booking fixed, SSRF allowlist + byte cap on image fetch,
  refund→plan-downgrade webhook, slug registry (atomic uniqueness + backfill),
  bundle split (~23% lighter entry), a11y (ModalShell, labels, contrast), admin callables,
  dead rules/indexes purged, `publicCards` purged, review-edit preserves featured,
  `createDemoCard` respects plan limits, Google sign-in CSP fix.

---

## WALLET — PAUSED (resume here)

**Status:** front-end wallet UI is **hidden** (removed from the card page) until the Google
Wallet backend is configured. Apple Wallet backend is built but **inactive**. Full guide:
`docs/WALLET_INTEGRATION.md`.

### To resume
1. **Google Wallet backend config (needs you — ~15 min, free):**
   - Cloud Console → IAM → Service Accounts → create/select SA → Keys → Add Key → JSON → download.
   - https://pay.developers.google.com/wallet → set up an **issuer account** → get **Issuer ID**
     (this is the correct console; the old `wallet-console.developers.google.com` URL is wrong).
   - Firebase console → Functions → `getWalletPass` → Edit → set env vars:
     `GOOGLE_WALLET_ISSUER_ID` and `GOOGLE_WALLET_SERVICE_ACCOUNT` (the full JSON as a string).
2. **Re-enable the front end:** restore in `src/pages/CardViewerPage.tsx`:
   - the `Wallet` button (opens `WalletModal`), the `WalletModal` import + render, and
     `walletOpen` state. `src/components/WalletModal.tsx` still exists and is unused.
   - The `getWalletPass` callable is deployed and returns `{configured:false}` until creds are set.
3. **Test on an Android device** (passes show "[TEST ONLY]" until publishing access is granted).
4. **Apple Wallet** — still inactive by design (avoids the $99/yr Apple Developer membership
   until beta validation). Backend `getApplePass` (signed `.pkpass`) is built; activate later by
   setting `APPLE_PASS_TYPE_ID`, `APPLE_PASS_TEAM_ID`, `APPLE_PASS_CERT` (base64 `.p12`),
   `APPLE_PASS_CERT_PASSWORD` on that function, then test on iPhone. Polish `icon.png` before shipping.

---

## Manual actions still outstanding (blocking/verification)
- **Google Wallet creds** (above) — the only blocker to wallet.
- **Real Pro/Business purchase E2E** — payments are CSP-unblocked and reachable; do one real
  checkout to confirm plan application (SuccessPage → applyPendingUpgrade).
- **FCM push test** — send a real message/appointment from one device; confirm the owner's
  notification (never E2E-verified).
- **iOS vCard contact-sheet check** — confirm Safari presents the native sheet on a physical iPhone.

---

## Backlog (see HEALTH_CHECK.md for detail)
- **Site-wide theme config** — store CSS-variable overrides in Firestore (`config/theme`) so
  Admin Theme-panel edits apply to all visitors, not just the admin's browser. The panel today
  persists per-browser (localStorage); reading a Firestore config doc on boot (and writing it
  from the panel) makes it site-wide.
- **Security rules hardening** — `messages`/`appointments` create (hasOnly, caps, bind
  sender/recipient to card owner) to stop spam.
- **Plan card-limit server enforcement** (close direct-write bypass).
- **Featured `reviews` email leak** — stop storing reviewer email in public docs.
- **Perf**: defer `firebase/auth` from the entry bundle; memoize the editor; lazy-load Rolodex images.
- **PWA**: `start_url` → `/`; cap sw.js card-nav cache; messaging SW aligned to Firebase v12.
- **A11y**: full form-label pass; appointment calendar `aria-label`s; route-loader `role=status`.
- **Strategic** (from `docs/COMPETITOR_ANALYSIS.md`): NFC tag store, custom domains,
  team admin dashboard, CRM/AI-scanner (later).

---

## Commands
- `npm run dev` · `npm run lint` · `npm run build` (frontend; tsc runs in build)
- `cd functions && npm run build` (functions typecheck)
- Deploy: `npx firebase deploy --only hosting` / `--only functions:NAME` / `--only firestore:rules` / `--only storage`
- Tests note: tests can't run from repo root — run from package dirs.

## Docs
- `AGENTS.md` · `HEALTH_CHECK.md` (audit + backlog) · `docs/COMPETITOR_ANALYSIS.md`
  · `docs/WALLET_INTEGRATION.md` · `.agents/notes/WORKSPACE.md` · `DEVELOPMENT_LOG.md`
