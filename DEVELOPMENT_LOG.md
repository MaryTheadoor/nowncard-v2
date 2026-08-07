# NownCard v2 — Development Log

> Chronological record of all significant changes, fixes, and deployments.

---

## 2026-08-06 — Save-to-Contacts refinements, Save Image fix, Appointment booking v2

### Save to Contacts (device feedback round)
- **Android**: the `intent://` INSERT approach was unreliable on devices (unresolved
  intent fell back to the card URL, or triggered a file-save prompt). Replaced with a
  reliable `.vcf` download **plus** an instructional dialog (new `ImportVCardModal`)
  telling the user to open the downloaded file to import it into Contacts.
- **iOS**: "Download .vcf" is now a visible secondary button (backup option), which
  downloads + shows the same import dialog. Primary "Save to Contacts" still opens the
  vCard in a new tab (native contact sheet).
- `saveToContacts()` now returns `'ios' | 'download-import'` so callers know when to
  show the dialog.

### Save Image (still failing)
- Root cause: **not CORS anymore** — `html2canvas` can't parse Tailwind v4's
  `oklab()`/`oklch()` color functions ("Attempting to parse an unsupported color
  function 'oklab'"). html2canvas is effectively unmaintained.
- **Fix**: CardViewer "Save Image" now downloads the server-generated preview
  (`/og-images/<slug>.png`) — reliable, matches the link preview. `html-to-image`
  replaced html2canvas for the QR poster export (handles modern CSS); html2canvas
  removed from deps. Verified both headlessly.

### Appointment booking v2 (`AppointmentModal` + Editor + types)
- **Availability model** (`Card.appointmentSettings`): `durationMinutes` + `weeklyHours`
  (per-day start/end). Editor now has a weekly availability editor (day toggles +
  start/end times) and a meeting-length selector. Defaults Mon–Fri 9–5, 30 min.
- **Booking UI**: month calendar grid (available vs unavailable days, past dates
  disabled) → select a day → time-slot buttons (disabled for past/overlapping slots,
  based on existing pending/confirmed appointments for that card).
- **Post-booking**: success screen with Add to Google Calendar, Add to Outlook (new
  `outlookCalendarUrl`), and Download .ics (Apple). ICS/Google/Outlook links honor
  `durationMinutes`.
- Appointment docs now store `durationMinutes`. Existing fields unchanged
  (Dashboard + `notifyOnAppointment` work as before).

### Verified (headless Chrome vs deployed site)
- Save Image downloads the preview PNG; poster export works via html-to-image.
- Android: `.vcf` downloads + import dialog shows; iOS: `.vcf` backup button shows +
  downloads + dialog.
- Appointment modal on a live card (`allhair`): calendar grid renders, 18 available
  days, 16 time slots on a selected day, no errors.

---

## 2026-08-06 — Save-to-Contacts flow + Save Image fix

### Analysis
- **Save to Contacts** downloaded a `.vcf` that the user had to import manually
  (open file → add contact → save). Researched web platform capabilities:
  - W3C **Contact Picker API** (`navigator.contacts`) is read-only (selects the
    user's contacts, can't write) and is not Baseline — not usable for saving.
  - **Android** has no "add to contacts" web API, but Chrome-family browsers
    support `intent://` URLs: `android.intent.action.INSERT` with MIME
    `vnd.android.cursor.dir/contact` and extras `name`/`phone`/`email`/`company`/
    `job_title`/`notes` opens the native contact editor pre-filled → user taps
    Save (1 tap).
  - **iOS** has no write API either; best available is opening the vCard so
    Safari presents its native contact sheet (or downloads the `.vcf`).
- **Save Image** failed silently. Root cause confirmed live: Firebase Storage
  images returned **no CORS header**, so `html2canvas` couldn't read their pixels
  → `canvas.toDataURL()` threw a SecurityError (unhandled). Google-avatar images
  (`lh3.googleusercontent.com`) do send CORS, hence the intermittent behavior.

### Changes
- **Storage CORS** (`functions/src/preview.ts`): idempotent `ensureStorageCors()`
  on module load sets `Access-Control-Allow-Origin: *` (GET/HEAD) on the
  `vcard-studio-314.firebasestorage.app` bucket via `@google-cloud/storage`.
  Verified live — storage images now return `Access-Control-Allow-Origin: *`.
- **`src/lib/vcard.ts`**: added `saveToContacts()` — platform-smart save:
  Android (non-Firefox) → `intent://` contact INSERT with first phone/email +
  company + job title + bio note; iOS → opens vCard in a new tab (native contact
  sheet); everything else → `.vcf` download. `openAndroidContactEditor()` helper.
- **`src/pages/CardViewerPage.tsx`**: both save buttons use `saveToContacts()`
  (still increment saveCount). Added a mobile-only "Download .vcf" fallback link.
  `handleSaveImage` now has `savingImage` state (Generating…), try/catch + toast
  on failure, and no longer swallows errors.
- **`src/lib/image-export.ts`**: append anchor to DOM before click (iOS Safari
  requirement), `imageTimeout`, disabled logging.

### Verified (headless Chrome vs deployed site)
- Desktop: "Save to Contacts" downloads a valid `amir-drissi.vcf`; fallback link
  hidden.
- Android UA: `intent://` INSERT URL fires; fallback link visible.
- iOS UA: vCard opens in a new tab; fallback link visible.
- Storage bucket now sends `Access-Control-Allow-Origin: *`.

### Notes
- Android intent opens the contact editor with the **primary** phone/email only
  (the `INSERT` intent supports single values). Multiple numbers/addresses still
  come through via the `.vcf` download.
- iOS Safari behavior (contact sheet vs download) should be confirmed on a
  physical iPhone.

---

## 2026-08-06 — Dynamic Card Share Previews (OG images + meta injection)

### Problem
Link previews for `/card/:slug` always showed the static NownCard logo. The app set
`og:*` tags via JS in `CardViewerPage`, but crawlers (WhatsApp, iMessage, Facebook,
LinkedIn, Discord, Slack) don't run JS — they only read the raw HTML served by
`index.html`.

### Changes
- **`functions/src/preview.ts` (new)**:
  - `cardOgImage` — GET `/og-images/<slug>.png` renders a branded 1200×630 PNG via
    `satori` + `@resvg/resvg-js` (Inter font via `@fontsource/inter`): card accent color,
    profile photo (or initials fallback), name, job · department · company, 2-line bio,
    NownCard brand mark. Card lookup is public-only. Cache `max-age=3600`.
  - `cardPage` — GET `/card/<slug>` serves `index.html` (fetched from hosting, 60s TTL)
    with per-card `og:title`/`og:description`/`og:image`/`og:url`/`twitter:*` injected.
    `og:image` is cache-busted by `updatedAt`. Uses `x-forwarded-host` so the preview
    URLs point at the requesting host (nowncard.com vs staging).
- **`firebase.json`** — hosting rewrites (both sites, before the `**` catch-all):
  `/card/**` → `cardpage`, `/og-images/**` → `cardogimage` (us-central1).
- **`src/pages/CardViewerPage.tsx`** — JS-set `og:image` now uses the generated
  `/og-images/<slug>.png` URL for JS-capable crawlers.
- **`functions` deps** — added `satori`, `@resvg/resvg-js`, `@fontsource/inter`, `react`.

### Verified
- `https://nowncard.com/card/<slug>` raw HTML has correct per-card og/twitter tags
  (1200×630, correct host, `?v=` cache-buster).
- `https://nowncard.com/og-images/<slug>.png` returns `image/png` (145–170KB).
- Nonexistent card falls back to homepage meta. Staging uses its own host.

### Deployed
- Functions (`cardPage`, `cardOgImage`), hosting (both sites). Pushed to `master`.

### Note
Existing cached previews (Facebook/WhatsApp/LinkedIn) won't refresh until re-scraped:
use FB Sharing Debugger, LinkedIn Post Inspector, or `?slack-bot=1`. Also note the
renderer is a clean branded tile — it does NOT use the card's background photo yet.

---

## 2026-08-06 — Live Debugging Round (User-Reported Issues)

### Problems Reported
1. Card back background photo not fully featured (no positioning/zoom/rotation controls), rendering incorrectly
2. Removing back background image didn't persist on save (image came back after refresh)
3. Google sign-in failing in new browser instances (popup blocked)

### Changes Made (`79f7d63`)
- **Back background controls** (`src/types/index.ts`, `src/pages/CardViewerPage.tsx`, `src/pages/EditorPage.tsx`):
  - Added `backBgPosition`, `backBgZoom`, `backBgRotation` to `Card` type — independent fields for back face
  - `CardViewerPage` back face now uses `card.backBgPosition` / `card.backBgZoom` / `card.backBgRotation` instead of sharing the front's `bgPosition`/`bgRotation`
  - `EditorPage` back background section now has full `BackgroundPositioner` + size selector controls matching the front background
- **Image removal persistence** (`src/pages/EditorPage.tsx`):
  - Save logic now uses Firestore `deleteField()` for fields explicitly set to `undefined` (via Remove button)
  - Previously `stripUndefined` removed them from the payload, so `updateDoc` merge kept the old Firestore value
- **Google sign-in redirect fallback** (`src/hooks/useAuth.tsx`):
  - `signInGoogle` now tries `signInWithPopup` first, falls back to `signInWithRedirect` when popup is blocked (`auth/popup-blocked`, `auth/popup-closed-by-user`, `auth/cancelled-popup-request`)
  - Added `getRedirectResult` call on `AuthProvider` mount to capture redirect completions

### Verified
- `npm run lint` — zero warnings
- `npm run build` — successful (tsc + vite)
- Manual review of all 4 changed files

### Deployed
- Git push to `origin/master`
- Firebase Hosting to `nowncard-v2.web.app` + `vcard-studio-314.web.app` (also `nowncard.com`)

---

## 2026-08-06 — Cleanup Round + Documentation Refresh

### Changes Made
- **Dead code removal** (`c2883d1`): deleted `CardPreview.tsx`, `captureElementAsJPEG`, `signInAnon`, `normalizeCardContacts`, `UserData`/`Plan` types, unused CSS (`.btn-ghost`, `.shadow-card`, `.backface-hidden`).
- **Editor toggles unified**: name layout / preset / QR / font-size toggles now use `btn btn-secondary` + `btn-selected` (were flat `bg-accent` segmented controls).
- **Dynamic FAQ pricing**: Landing FAQ (list + JSON-LD) now reads from `config/pricing` via `useMemo` instead of hardcoded $19/$39.
- **Local `.env` cleanup**: removed unused `VITE_STRIPE_*` + `VITE_PAYMENT_PROVIDER` vars (gitignored file).
- **Documentation refresh**: rewrote `.agents/notes/WORKSPACE.md`, `.agents/notes/vcard-studio-TODO.md`, refreshed `PRODUCTION_STATUS.md` (security status, functions table, deployments, action items), appended this log entry.

### Deployed
- Hosting to `nowncard-v2.web.app` + `vcard-studio-314.web.app` (staging + prod).

---

## 2026-08-06 — Medium Patch Round (from audit)

### Changes Made (`bb325a8`)
- **Editor hex sync**: hex color inputs now load the existing card's actual colors instead of defaults.
- **Favorites refresh**: added `refreshUserData()` to auth context; heart/star favorite changes (and favorite-slot clearing on delete) update `userData` immediately — Navbar no longer stale until reload.
- **QR poster origin-relative**: `/poster/:slug` uses `window.location.origin` instead of hardcoded `nowncard.com`.
- **Surfaced silent failures**: Admin stats show an error line instead of all-zeros; `loadPaymentDetail` toasts; Rolodex shows an error state + retry instead of a misleading empty directory.

---

## 2026-08-05 — Security Rework: Server-Authoritative Plan/Admin

### Problems Fixed (critical)
1. **Free plan-upgrade bypass** — clients could create `pendingUpgrades` with `paymentCompleted: true` and self-apply via a client-side transaction.
2. **Admin self-grant** — delete + recreate user doc with `isAdmin: true`.
3. **Self-plan write** — users could set `users.plan` directly.
4. **Fabricated purchase history** — clients could write `upgrades` docs.

### Changes Made (`1d3c5ae`)
- **`firestore.rules`**: `users` create blocks `isAdmin`/`plan`, self-update blocks `isAdmin`/`plan`/`planUpdatedAt`/`activeCheckout`, self-delete admin-only; `pendingUpgrades` create blocked (`if false`); `upgrades` admin-only writes; analytics `hasAny` → `hasOnly`.
- **`functions/src/index.ts`**:
  - New `applyPendingUpgrade` callable — applies only when the HMAC-verified webhook set `paymentCompleted: true` (idempotent via shared `applyPaidUpgradeTx`).
  - New `bootstrapAdmin` callable — checks server-side `ADMIN_UIDS` allowlist, sets `isAdmin` + `plan: business`.
  - Webhook now verifies paid amount ≥ configured price before applying.
  - `createCheckout`: redirect URL allowlist (`nowncard.com`, `.web.app`, `localhost`) + dedupe of unpaid pending docs.
  - FCM push guards — only push when message/appointment card owner matches recipient.
- **Client**: `payments.ts` routes apply through the callable; `useAuth.tsx` no longer writes `isAdmin` on create; `AdminPage` bootstrap via callable; `SuccessPage` polls briefly for webhook.
- **`storage.rules`**: SVG uploads blocked.
- **`firebase.json`**: CSP + Permissions-Policy headers; `sw.js`/`firebase-messaging-sw.js` → `no-cache`.

### Verified
- Functions + rules + storage deployed; all 9 functions live.
- Headers confirmed via HTTP on nowncard.com.
- Signed webhook test → HTTP 200 (HMAC + amount check path).

### Deployed
- Functions, Firestore rules, Storage rules, and hosting to staging + prod.

---

## 2026-08-05 — UI Styling Updates

### Changes Made
- `3765312` — restored blue `btn-secondary` (tactile blue gradient), colored landing section titles (removed eyebrow badges).
- `06c3466` — unified ~90 ad-hoc buttons onto the tactile `btn` system (gold primary, blue secondary, red danger).
- `38f0af5` — navigation unification: shared `BackLink`, Admin tab bar → underline style, editor top "Back to Dashboard" link, Dashboard h1 → "Dashboard".

---

## 2026-05-06 — Messaging Fix, Simplification, Documentation

### Problems Reported
1. Dashboard showing "Failed to load messages" error
2. Background image only on front face of live card (preview had both sides)
3. Messaging implementation too complex (anti-spam queries requiring composite indexes)
4. "Cannot send message — card owner not found" on legacy cards

### Changes Made

**Dashboard messaging simplified**
- Removed `orderBy('createdAt', 'desc')` from messages query
- Sort messages client-side after snapshot arrives
- Eliminates composite index dependency — works immediately on fresh deploys
- File: `src/pages/DashboardPage.tsx`

**CardViewerPage back face background image**
- Added `backgroundImage` + overlay divs to back face, matching front face and LiveCardPreview
- File: `src/pages/CardViewerPage.tsx`

**Anti-spam removed**
- Removed the 5-minute anti-spam `getDocs` query from send flow
- It required a composite index `(senderUid, recipientUid, createdAt DESC)` that was causing send failures
- Firestore rules already require `senderUid == request.auth.uid` for basic protection
- File: `src/pages/CardViewerPage.tsx`

**Legacy card owner UID fix**
- `CardViewerPage` now falls back to `ownerId` if `ownerUid` is missing
- `EditorPage` now writes `ownerUid: user.uid` on EVERY save (both create and update paths)
- Previously, updating an existing card stripped `ownerUid` from the update data
- Files: `src/pages/CardViewerPage.tsx`, `src/pages/EditorPage.tsx`

**Documentation created**
- `AGENTS.md` — comprehensive agent onboarding guide
- `README.md` — replaced Vite template with real project README
- `DEVELOPMENT_LOG.md` — this file
- `PRODUCTION_STATUS.md` — live status tracking

### Deployed
- Hosting deploy to `nowncard-v2` and `vcard-studio-314` sites

---

## 2026-05-05 — Build Stabilization, UI Polish, Deployment

### Changes Made
- Fixed 22 ESLint errors across 7 files
- Fixed 3 TypeScript build errors
- Committed all uncommitted WIP as commit `8040cf1`
- Verified live deployment at `nowncard.com`
- Created `.agents/notes/WORKSPACE.md`

---

## Prior Sessions (Pre-2026-05-05)

Key milestones from git history:

| Commit | Description |
|--------|-------------|
| `7be9ba3` | Initial scaffold: React 19, Vite, Tailwind v4, Firebase v12 |
| `e651d30` | Square payment flow: success/cancel pages, pending upgrades |
| `ea2ddd9` | Route fix: `/card/:slug` for public cards |
| `cb9d68a` | Admin page, demo card helper, dashboard polish |
| `75138ed` | UI debug fixes: admin query, z-index, auth modal, shadows |
| `cd015af` | Editor slug uniqueness check (global on edit) |
| `6997bce` | HTML title encoding fix |
| `8040cf1` | Analytics, NFC, Rolodex, ShareModal, PWA, team cards, theming, fonts |
| `783f1cc` | Rename `ownerId` → `ownerUid` to match PRD schema |
| `ca68a03` | Live CardPreview component, split-screen editor layout |
| `32c5582` | CardViewer tap-to-flip, back face translateZ, social pills, mobile sticky bar |
| `1325197` | Editor slug auto-generation, live availability check (400ms debounce) |
| `f0b637b` | Client-side image compression (800px max, 85% quality, 5MB limit) |
| `3a4b294` | robots.txt, sitemap.xml, per-card dynamic Open Graph meta tags |
| `a2129fb` | Dashboard queries both `ownerUid` and `ownerId` for backward compat |
| `e89d6f5` | Consolidate pre-beta changes |
| `b1ad4ef` | Consolidate docs, agent notes, and assets |
| `9f3cc9b` | Fix lint: setState-in-effect and fast-refresh errors |
| `f6cdd00` | Landing page: interactive demo card, reordered features |
| `e2198ae` | Rolodex: rebuild directory as searchable contacts database |
| `0732f25` | Dashboard + editor: search, auto-populate, interactive preview, hidden dates |
| `3a1ccef` | CardViewer uses pageBgColor, og:url points to nowncard.com |

---

## Known Regression Risks

1. **Legacy `ownerId` cards** — Any card created before the `ownerUid` field was added will have `ownerId` instead. Code must check both fields. Editor now ensures `ownerUid` is written on every save.
2. **publicCards collection** — May be stale/out of sync. CardViewer falls back to it if `cards` collection lookup fails. No active mirroring logic exists.
3. **FCM (Firebase Cloud Messaging)** — Configured with real keys and `notifyOnMessage` deployed, but end-to-end delivery to a device is not yet verified.
