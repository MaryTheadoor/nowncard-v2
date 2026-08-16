# NownCard v2 — Site-Wide Health Check & Audit

> **Date:** 2026-08-07
> **Method:** Four parallel read-only analysis agents (security, code quality & bugs, data-model/rules coverage, performance & accessibility) + live verification (CSP header probes, Firestore REST rule probes, headless Chrome).
> **Status legend:** ✅ FIXED & DEPLOYED · 🟡 REMAINING (recommended) · ⚪ VERIFIED HEALTHY

---

## Executive Summary

The codebase is in good shape: the security core is strong (server-authoritative plan/admin, HMAC-verified webhook, idempotent payment transaction, field-level rule validation), every collection has rules, all composite indexes exist, and legacy `ownerId`/`ownerId` dual-field fallbacks are applied consistently.

The health check surfaced **four live bugs** (three Critical/one High) plus ~10 more real defects, all of which have been **fixed and deployed**. The remaining items are hardening/cleanup/performance — nothing leaves a critical remote risk today.

---

## 1. Issues Found — Fixed This Session (deployed)

| # | Sev | Issue | Where | Fix |
|---|-----|-------|-------|-----|
| 1 | 🔴 Critical | **CSP `connect-src` blocked every callable Cloud Function** (`*.cloudfunctions.net`, `*.run.app` not allowed) → `createCheckout`, `applyPendingUpgrade`, `getPaymentHistory`, `getPaymentDetails`, `bootstrapAdmin` all dead on the hosted site. Verified live: browser fetch to the callables host threw `Failed to fetch` (CSP). | `firebase.json` | Added `https://*.cloudfunctions.net https://*.run.app` to `connect-src`. Re-verified: callables now reach the server (401 "Sign in required" instead of network block). |
| 2 | 🔴 Critical | **CSP `font-src` blocked Business-plan custom fonts** served from Firebase Storage → paid font upload rendered as fallback font. | `firebase.json` | Added `https://firebasestorage.googleapis.com https://storage.googleapis.com` to `font-src`. |
| 3 | 🔴 Critical | **Analytics rules silently denied ALL tap tracking.** The allowlist used dotted keys (`'taps.flip'`, `'taps.save'`, …) but rules `keys()` returns only top-level keys, so the `taps` map never matched → every `track()` write 403'd. Legacy analytics docs containing `taps` also rejected `timeOnPage` updates. Verified live: `taps` write = 403. | `firestore.rules` | Allowlist now contains top-level `'taps'` with value checks (`is map`, size ≤ 25, `device`/`referrer` `is string`). Re-verified: `taps` write = 200. |
| 4 | 🟠 High | **Appointment double-booking.** The booking modal queried `appointments` by `cardId`, but rules only allow owner/requester/admin reads → anonymous visitors got 403, `existing` stayed `[]`, every slot looked free. Verified live: anonymous appointments query = 403. | `src/components/AppointmentModal.tsx`, `functions/src/index.ts`, `firestore.rules` | New public callable `getBookedSlots(cardId)` returns only `{requestedDate, requestedTime, durationMinutes}` (no PII). Modal uses the callable. Re-verified: returns 200, slots render, no errors. |
| 5 | 🟠 High | **Saving a card threw "Unsupported field value: undefined"** after Contact-Picker / vCard import — `stripUndefined` skipped array items, leaving `undefined` inside address/contact objects. | `src/pages/EditorPage.tsx` | `stripUndefined` now recurses into array elements. |
| 6 | 🟠 High | **`publicCards` zombie collection** — written on every "Save Contact" but never read; rule block allowed unauthenticated arbitrary `saveCount`/`viewCount` writes. | `src/pages/CardViewerPage.tsx`, `firestore.rules` | Removed the client write and the rule block (defaults to deny-all). Recommend purging the collection in the console. |
| 7 | 🟡 Med | **`cancelPendingUpgrades` deleted paid-but-unapplied upgrades** (`paymentCompleted: true` docs) via the Cancel page race. | `src/lib/payments.ts` | Now only deletes pendings where `paymentCompleted !== true`. |
| 8 | 🟡 Med | **`createCheckout` dedupe could delete an in-flight checkout** → arriving webhook would find no pending doc (money taken, no plan). | `functions/src/index.ts` | Dedupe now only deletes unpaid pendings older than 10 minutes. |
| 9 | 🟡 Med | **Slug uniqueness only partially enforced** (save-time check only covered own cards). | `src/pages/EditorPage.tsx` | Save now also blocks when the debounced availability check already flagged `slugStatus === 'taken'`. Full enforcement still needs a slug registry (see remaining). |
| 10 | 🟡 Med | **Legacy `ownerUid` never written on update** — `ownerId`-only cards never migrated (contradicted AGENTS.md). | `src/pages/EditorPage.tsx` | On update, if the card lacks `ownerUid` and the editor matches legacy `ownerId`, write `ownerUid`. |
| 11 | 🟡 Med | **Service worker scope collision** — `/sw.js` (PWA caching) and `/firebase-messaging-sw.js` both registered at scope `/` → they ping-pong and uninstall each other (offline caching and push both break). | `src/lib/messaging.ts` | FCM SW now registered at the narrow standard scope `/firebase-cloud-messaging-push-scope`. |
| 12 | 🟡 Med | **Card-flip keyboard trap** — Enter/Space on the flip container bubbled from nested Save/Share/link controls, flipping the card and swallowing the control's activation. | `src/pages/CardViewerPage.tsx` | Keydown handler now only flips when `e.target === e.currentTarget`. |
| 13 | 🔵 Low | **Google redirect sign-in errors swallowed** (e.g. `account-exists-with-different-credential` left the user silently unsigned-in after the redirect round-trip). | `src/hooks/useAuth.tsx` | `getRedirectResult` errors now flow through `handleError` (+ added the credential-conflict message). |

---

## 2. Remaining Issues — Recommended Next

### Security & integrity 🟡

- **SSRF in OG/card-image renderer** — `loadProfileImage` (`functions/src/preview.ts`) fetches `card.profileImage`, a user-controlled URL, server-side with no host allowlist and no byte cap. **Fix:** only fetch from `firebasestorage.googleapis.com` / `storage.googleapis.com`, and cap bytes read.
- **No refund/chargeback handling** — the webhook only handles `payment.created/updated`; a refund after payment leaves the paid plan active forever. **Fix:** handle `refund.created/updated` (and `dispute.created`) → downgrade `users/{uid}.plan`.
- **Slug uniqueness not transactionally enforced** — two users can both save the same slug; `CardViewerPage` returns an arbitrary match. **Fix:** `slugs/{slug}` registry doc claimed in a transaction with owner-only rules.
- **Plan card-limit is client-enforced only** — direct SDK writes can create unlimited cards (demo card path bypasses the limit too). **Fix:** enforce in rules/callable or accept as documented risk.
- **Unbounded unauthenticated counter writes** — anyone can set `viewCount`/`saveCount` on any card to any number. **Fix:** bound in rules, move counters server-side, or accept (Dashboard/Analytics numbers are untrusted).
- **Featured reviews leak reviewer email** — `reviews` docs (incl. `email`) are world-readable once `featured == true`. **Fix:** stop storing `email` in `reviews` or split public/private fields.
- **`messages` sender identity spoofable + recipient unverified** — `senderName`/`senderEmail` aren't bound to the auth token; `recipientUid` can be any uid → inbox spam. **Fix:** `hasOnly`, `senderEmail == request.auth.token.email`, bind `recipientUid` to the card owner.
- **`appointments` create uses `hasAll` + no auth** — bots can flood a card owner's inbox + push notifications. **Fix:** `hasOnly` + size caps + App Check / per-card rate limit.
- **Redirect allowlist accepts any `*.web.app`** — pin to the two hosting sites + localhost.
- **`decodeURIComponent` can throw** in `parseImageSlug`/`parseCardSlug` (`/card/%`) → unhandled 500. **Fix:** wrap in try/catch.
- **Admin mutations are direct client writes** (rules-gated) — defense-in-depth would route them through callables that re-check `isAdmin`.
- **Secrets/config hygiene** — Square secrets live in the repo-root `.env` (gitignored but risky); `functions/.env` params overlap `defineString` params and can silently override console-set values.
- **Host-header trust** in meta/canonical generation (low risk behind Firebase Hosting; harden if desired).
- **`img-src https:` is broad** (low risk; tighten to Storage origins).

### Reliability & bugs 🟡

- **`CardRow` defined inside `DashboardPage`** — a new component identity every render → the whole card list remounts on each keystroke/tab switch. Hoist to module scope.
- **Appointment overlap compares wall-clock times across timezones** — a PST booking misaligns for an EST viewer. Convert to UTC instants before comparing.
- **`LiveCardPreview` ignores `backBgPosition`/`backBgZoom`/`backBgRotation`** — the editor's back-background controls have no live effect (real card page handles them correctly).
- **Admin "Approve" is three non-atomic writes** — use a batch or the existing `applyPaidUpgradeTx`.
- **Admin card search "Load More" duplicates rows** when a search is active.
- **Dashboard `applyPendingUpgrades().catch(() => {})` swallows errors** — no signal if a paid-but-unapplied upgrade can't apply.
- **`createDemoCard` bypasses plan card limits.**
- **Font uploads rejected on browsers reporting `application/octet-stream`** — pass explicit `contentType` on upload.
- **`timeOnPage` analytics written on `beforeunload` without `await`** — mostly lost; use `sendBeacon` or drop.
- **`QrPosterPage` save-image has no try/catch / busy state.**
- **`navigator.clipboard.writeText` without `.catch`.**
- **`onSnapshot` errors silently look like "no data".**
- **SuccessPage says "All Set!" even if the webhook is merely slow** after 6 polls.
- **`BackgroundPositioner` gesture rotation isn't persisted** (only the slider is).
- **`LandingPage` `querySelector(window.location.hash)` can throw** on a malformed hash → white screen. Wrap in try/catch.
- **Rolodex "Recently Updated" sort is actually alphabetical** (`updatedAt` isn't selected).
- **`NfcPage` / `QrPosterPage` can't load the owner's private card** (query forces `isPublic == true`). — **Both fixed** (NfcPage 2026-08-07, QrPosterPage 2026-08-16; owner fallback added).
- **`messages` push body reads `undefined: "…"`** when `senderName` is absent.

### Data model & rules 🟡

- **`publicCards` collection should be purged** (now deny-all after rule removal).
- **`cards` update rule doesn't freeze ownership fields** — an owner can reassign `ownerUid`/`ownerId` to a victim's UID. Add `!affectedKeys().hasAny([...])`.
- **Legacy `address` string field** is shown on the card page but dropped from vCard / card image / JSON-LD. Add the fallback or migrate the field.
- **Dead rule blocks:** `cards/{cardId}/analytics/{eventId}` subcollection and `customers/*` (Stripe-extension leftovers) — remove.
- **`cardCount` is a phantom field** — read in several places, never written (admin user table shows `0`).
- **Unused indexes:** `cards(isPublic, updatedAt desc)` and `cards(ownerUid, updatedAt desc)`.
- **Editing a featured review silently un-features it** (payload always `featured: false`; rules forbid `featured: true` on self-update).

### Performance 🟡

- **~740 KB raw / ~228 KB gzip JS on first paint for every page, including anonymous card viewers** — Firebase (`auth`/`firestore`/`functions`) is in the critical path via `AuthProvider` + eager `LandingPage`. **Highest-leverage fix:** dynamic-import `firebase/auth` inside `AuthProvider`, lazy-load `LandingPage`, consider `manualChunks`.
- **`qrcode.react` in the main chunk** via the landing `DemoCard` — lazy-load the demo.
- **`lib/payments.ts` (firebase/functions) loads on first paint** — dynamic-import in the upgrade click handler.
- **Editor re-renders the full form + live preview + QR on every keystroke** — memoize / `useDeferredValue`.
- **No `loading="lazy"` on images; Rolodex loads up to 300 profile photos** — add lazy + paginate.
- **SW cache grows unboundedly** (every visited card navigation cached forever) — cap or skip card navigations.
- **`firebase-messaging-sw.js` pins Firebase v11 compat via CDN while the app is on v12** — align versions.
- **Sourcemaps deployed publicly** (`vite.config.ts: sourcemap: true`) — switch to `'hidden'`.
- **PWA `start_url` is `/dashboard`** → anonymous installs land on a redirect.

### Accessibility 🟡

- **No modal has `role="dialog"` / focus trap / Escape handling** (`AuthModal`, `ShareModal`, `AppointmentModal`, `ImportVCardModal`).
- **No form input has an associated label** (`htmlFor`/`aria-label` missing app-wide).
- **Contrast failures:** `--ink-faint` ≈ 2.7:1 on tile; `.btn-secondary` white-on-blue ≈ 3.3:1 (both below WCAG AA 4.5:1 for small text).
- **Mobile nav drawer is focusable while hidden**; hamburger lacks `aria-expanded`.
- **Icon-only close buttons lack `aria-label`.**
- **Appointment calendar day buttons are number-only** (no full-date `aria-label` / `aria-pressed`).
- **Route `PageLoader` has no `role="status"`.**

### Hygiene / cleanup ⚪

- Money formatting duplicated 3× (`fmtMoney`, `fmtCents`, `formatCents`); `initials` and inline icon SVGs duplicated across pages.
- `useTheme.tsx` vs `useThemeContext.ts` naming split.
- `src/lib/payments.ts` `createSquareCheckout` still sends a client `price` the server ignores.
- **AGENTS.md drift:** OneSignal references (FCM replaced it), "orderBy removed from dashboard query" (index now exists), "ownerUid written on every save" (now actually fixed), "useAuth duplicates listeners" (now context-based).

---

## 3. Verified Healthy ⚪

- **Privilege escalation is locked down:** clients cannot self-grant `plan`/`isAdmin` (rules block create/update/delete paths); `bootstrapAdmin` uses a server-side UID allowlist; plan activation is server-authoritative via `applyPaidUpgradeTx` with HMAC-verified webhook + server-side price check.
- **Every code-referenced collection has a rule block** (`users`, `cards`, `analytics`, `pendingUpgrades`, `config`, `upgrades`, `reviews`, `messages`, `appointments`).
- **All composite-index queries are covered** by `firestore.indexes.json` — no "requires an index" runtime failures.
- **`storage.rules` are solid:** SVG blocked everywhere, 6 MB cap, uid-scoped writes, public read limited to card images/fonts.
- **Webhook signature verification** uses `timingSafeEqual` over `url + rawBody`.
- **JSON-LD/meta injection** in `preview.ts` is properly escaped (`</` → `\u003c`, `escapeHtml` on attributes).
- **Route-level code splitting, hashed asset caching, SW `no-cache` headers, modular (tree-shaken) Firebase imports, `prefers-reduced-motion`, `.btn:focus-visible`, heavy libs isolated to lazy chunks** — all confirmed.
- **Lint clean, frontend + functions typecheck clean.**

---

## 4. Recommended Next Steps (priority order)

> **Progress 2026-08-07:** items 1–7 below are **implemented and deployed** (commits
> `e5e5207` → `d7a5502`). Item 8's automated checks pass; the manual E2E steps are
> listed as user actions.

1. ✅ **SSRF allowlist + byte cap** on `loadProfileImage` — fetch restricted to
   `firebasestorage.googleapis.com` / `storage.googleapis.com` / `googleusercontent.com`,
   capped at 8 MB; slug path parsing wrapped in try/catch.
2. ✅ **Refund/chargeback → plan downgrade** — webhook now handles
   `refund.created/updated` (COMPLETED, full-amount) and downgrades the plan;
   audit-logged to `refunds`.
3. ✅ **Bundle split** — LandingPage lazy-loaded; entry cut from ~740KB raw/228KB gzip
   to 574KB/175KB (~23%) for anonymous card viewers.
4. ✅ **Slug registry transaction** — `slugs/{slug}` claimed atomically in the editor
   save transaction; backfilled all 12 existing cards; Dashboard/Admin deletes free the slug.
5. ✅ **A11y** — `ModalShell` (role=dialog, focus trap, Escape, focus restore) on all four
   modals; form labels on Auth/Appointment modals; WCAG-AA contrast (`.btn-secondary`,
   `--ink-faint`); mobile nav drawer `inert`/`aria-expanded`.
6. ✅ **Admin mutations → callables** — `adminMutation` re-checks isAdmin server-side;
   AdminPage writes route through it (reads stay client-side).
7. ✅ **Dead code/rules/indexes** — removed `cards/{id}/analytics` + `customers/*` rule
   blocks; deleted unused `cards(updatedAt)` indexes; purged `publicCards` (5 docs).
8. 🔄 **Purchase + FCM E2E** — automated checks pass (all callables reachable, messaging
   SW + notifyOn* deployed). Remaining is manual (see below).

### User action items (manual E2E)
- **Real purchase test** — complete a Pro/Business checkout end-to-end (pay → success →
  plan applied). The CSP callable block is fixed and verified reachable, but a real
  purchase is the only way to confirm the full flow.
- **FCM push test** — send a real message/appointment from one device and confirm the
  notification arrives on the owner's device (push delivery was never E2E-verified).

## 5. Remaining backlog (not yet addressed)

- Plan card-limit enforcement is client-only (rules/callable, or documented risk).
- `reviews` leak reviewer email to anonymous visitors when featured.
- `messages` sender/recipient not rule-bound to the auth token / card owner (inbox spam).
- `appointments` create uses `hasAll` + no auth (unauthenticated spam → owner push spam).
- `CardRow` defined inside `DashboardPage` — remounts the list on every keystroke.
- `LiveCardPreview` ignores `backBgPosition/Zoom/Rotation` (editor back-bg tuning has no live effect).
- Appointment overlap compares wall-clock across timezones.
- Admin "Load More" duplicates rows while a slug search is active.
- Dashboard swallows `applyPendingUpgrades` errors; `createDemoCard` bypasses plan limits.
- Legacy `address` string field missing from vCard / card image / JSON-LD.
- `cardCount` phantom field; editing a featured review un-features it (QrPosterPage private-card loading fixed 2026-08-16).
- Deeper perf: firebase/auth still in the entry (dynamic-import); editor re-render on keystroke; Rolodex loads 300 photos w/o lazy/pagination.
- PWA: sw.js caches card navigations forever; manifest `start_url` is `/dashboard`; messaging SW pins Firebase v11.
- A11y: full form-label pass across Editor/Dashboard; appointment calendar day `aria-label`s; route-loader `role=status`.
- App Check disabled; no automated tests.

## 3. Verified Healthy ⚪
