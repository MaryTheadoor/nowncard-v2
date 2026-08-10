# NownCard v2 — Development Log

> Chronological record of all significant changes, fixes, and deployments.

---

## 2026-08-07 — Admin console: full user/card lists + robust search

- Users and Cards tabs previously only loaded rows after a server-side prefix query
  (and the tabs weren't even populated on open). Now they **load all rows on tab open**
  (paginated batches of 200, capped at 2000) and search is a **live, client-side,
  case-insensitive substring** filter.
- Users search matches email, displayName, uid, and plan (and "admin"); cards search
  matches slug, first/last name, company, job title, owner uid, and public/private.
- Added a "X of Y loaded" count and loading states; removed the now-obsolete Search
  button, Enter-to-search, and Load More (all rows are loaded).
- `useAuth` now stores `displayName` on the user doc so admin can search users by name.
- AdminUser table adds a Name column.

---

## 2026-08-07 — Reliability/UX bug batch + copy accuracy pass

### Reliability/UX fixes (`49672c2`)
- Hoisted `CardRow` out of `DashboardPage` render (stable identity) — card list no longer
  remounts on every keystroke/tab switch.
- `LiveCardPreview` back face now honors `backBgPosition/Zoom/Rotation` (editor controls
  have a live effect).
- Admin card search: Load More hidden + no duplicate appends while a slug search is active.
- Dashboard surfaces `applyPendingUpgrades` errors (toast) instead of swallowing them.
- Legacy single-string `address` field now included in vCard export, card-image contact
  rows, and Person JSON-LD.
- Review edits no longer un-feature: rules allow self-update to keep `featured` as-is.
- `createDemoCard` respects the plan card limit.

### Copy accuracy pass (verified against plan gating)
- **Inaccuracies fixed**: "Custom colors & backgrounds" (Pro) and "Business name layout"
  (Business) were presented as exclusive, but colors/backgrounds and the business layout
  toggle are available on every plan. Replaced Pro's bullet with "Link list (link-in-bio)"
  (genuinely Pro+) and Business's with "Online menu for your venue" (genuinely Business).
- **Gaps filled**: added feature cards for **Appointment Booking**, **Rich Link Previews**,
  and **Online Menu** (Business); Free plan now lists "Custom colors & themes" and
  "Appointment booking". FAQ on branding/customization reworded to be plan-accurate.
- **Verified accurate**: card limits (1/5/∞), "10 curated fonts" (GOOGLE_FONTS = 10),
  no-branding = Pro+, team cards/custom font/menu = Business, NFC copy (Android-Chrome
  writing), recipient-facing meta copy.

---

## 2026-08-07 — Menu input layout fix + QR on saved image + standalone QR download

- **Menu input bug**: the item/category text inputs combined `w-full` (from the shared
  input class) with `flex-1`, making the field stretch/overflow the row. Split the input
  classes: row inputs now use `flex-1 min-w-0`, price `w-20`, description `w-full`.
- **Menu data processing**: on save, empty optional fields (price/description) are now
  dropped from items so stored docs stay clean; empty category names still fall back to
  "Menu" (items are never dropped).
- **QR on saved card image**: `/card-images/<slug>.png?qr=1` renders the portrait card
  with a white QR panel (content respects `card.qrMode` — card URL or vCard). The card
  page has an "Include QR code on image" checkbox that toggles this.
- **Standalone QR download**: new `/qr-images/<slug>.png` endpoint returns a clean
  512×512 QR PNG (url or vCard per qrMode). Card page has a "Download QR code" link.
- Added `qrcode` (+types) to functions; ported a compact vCard generator to `preview.ts`
  so the vcard-mode QR matches the card page's vCard export.
- Hosting rewrite `/qr-images/**` → `cardogimage`.

### Verified
- lint + typecheck clean; standalone QR 512×512 PNG; card image with `?qr=1` larger than
  plain (QR included); card page shows the checkbox + Download QR; toggling renames the
  download to `-qr.png`; no errors.

---

## 2026-08-07 — Menu fixes: save bug, description field, category images, bigger uploads

Debugged the menu feature after feedback:

- **Save bug**: `handleSave` dropped a whole category (and its items) when the category
  **name was empty**, silently losing work. Now every category with ≥1 named item is kept
  (empty name falls back to "Menu"). Items are never dropped for a missing category name.
- **Missing description input**: added an optional per-item description field in
  `MenuEditor` (the type/card page already supported it).
- **Category images (new)**: `MenuCategory.image`; the editor has an "add photo" control
  per category (uploads to `users/{uid}/cards/{prefix}/menu-{i}.jpg`, compressed 800px).
  The card page and editor live-preview render a small thumbnail next to the category name.
- **Image upload limit**: the client rejected source files >5MB **before** compressing, so
  typical phone photos (6–12MB) were refused even though the stored file would be tiny.
  Raised the source ceiling to **25MB** (still compressed client-side to ~1200px/85%) and
  bumped the storage rules cap for card images to 8MB.

### Verified
- lint + typecheck clean; card-page regression clean (no errors).

---

## 2026-08-07 — Menu feature (Business plan) for food trucks / small venues

- **Data model**: `Card.menu?: MenuCategory[]` where `MenuCategory = { name, items: MenuItem[] }`
  and `MenuItem = { name, description?, price? }`.
- **Editor** (`EditorPage` + new `MenuEditor` component): Business-plan-only section
  (locked "— Business" badge for other plans) to add categories and items (name/price/
  optional description). Empty categories/items filtered on save.
- **Card page** (`CardViewerPage`): a compact "Menu" section rendered below the card the
  same way featured links appear — shows the first few items, with a
  "View full menu (N items) / Show less" toggle when there are more. Mirrored as a
  non-interactive mock in the editor's `LivePagePreview`.
- Menu display is presence-based (shows whenever a card has items); the *editor* is the
  business-gated surface.

### Verified
- lint + typecheck clean; card page regression clean (no errors; no menu section when a
  card has no menu data). Live rendering needs a business-account card with menu items.

---

## 2026-08-07 — NFC analysis + copy alignment

Analyzed the deployed NFC functionality against the site copy.

**Reality:**
- `NfcPage` writes NDEF records via Web NFC (`NDEFReader`) — **Android Chrome 89+ only**
  (iOS/desktop can't write from a browser). Two modes: **Card URL** (universal — every
  NFC phone, iPhone included, opens it on tap) and **vCard** (best-effort — iOS won't
  reliably auto-import a vCard from an NFC mime record, and Android handling varies).
- Reading/tapping a programmed URL tag works on any NFC-enabled phone.
- Dashboard links to `/nfc/:slug`; the page is auth-gated.

**Fixed:**
- **Private-card bug**: `NfcPage` only loaded `isPublic == true` cards, so an owner
  couldn't program a tag for their own private card. Added an owner fallback
  (`slug + ownerUid` query, uses the existing composite index).
- **Copy alignment**:
  - NfcPage: URL mode note now says "any NFC phone (iPhone or Android)"; vCard mode now
    warns some phones (esp. iPhone) won't auto-import and recommends Card URL mode; added
    an "Android Chrome 89+ required" hint on the write screen.
  - Landing "NFC Ready" feature card: clarifies tapping is universal and programming
    happens from Android Chrome.
  - Landing FAQ: added the Android-Chrome writer requirement.
- Meta/og copy ("Share via link, QR code, or NFC tap") is recipient-facing and accurate —
  left unchanged.

**Known limitation (unchanged):** `QrPosterPage` still only loads public cards (no owner
fallback) — tracked in HEALTH_CHECK.md backlog.

---

## 2026-08-07 — Health-check remediation (items 1–7 of HEALTH_CHECK.md)

Systematically addressed the health-check backlog in priority order. All deployed.

1. **SSRF** — `loadProfileImage` fetch allowlisted to Firebase Storage / Google avatars
   + 8MB cap; slug decoding wrapped in try/catch.
2. **Refunds** — webhook handles `refund.created/updated`: COMPLETED + full-amount →
   downgrade plan to free (only if still on that plan), audit-logged to `refunds`.
3. **Bundle** — LandingPage lazy-loaded; entry 740KB→574KB raw (228→175KB gzip, ~23%).
4. **Slug registry** — `slugs/{slug}` claimed atomically in the editor-save transaction;
   backfilled 12 existing cards (one-shot function, then removed); deletes free the slug.
5. **A11y** — `ModalShell` (dialog semantics, focus trap, Escape, focus restore) on 4 modals;
   form labels; WCAG-AA contrast (`.btn-secondary`, `--ink-faint`); nav drawer inert/aria.
6. **Admin callables** — `adminMutation` re-checks isAdmin server-side; AdminPage writes
   route through it.
7. **Dead code/rules** — removed `cards/{id}/analytics` + `customers/*` rule blocks;
   deleted unused `cards(updatedAt)` indexes; purged `publicCards` (5 docs).

Automated E2E checks pass (callables reachable, messaging SW + notifyOn* deployed).
Manual remaining: a real purchase and a real FCM push (user action items).

---

## 2026-08-07 — Site-wide health check + critical fixes (see HEALTH_CHECK.md)

Ran a four-agent read-only audit (security, code quality, data model/rules, performance/a11y)
with live verification. Found and fixed four live bugs (payments, fonts, analytics, appointments)
plus ~9 more. Summary:

- **CSP blocked callable Cloud Functions** (payments/admin dead) + **Storage fonts**. Fixed
  `connect-src` (added `*.cloudfunctions.net`, `*.run.app`) and `font-src`
  (firebasestorage.googleapis.com) in `firebase.json`. Verified callables now reach the server.
- **Analytics tap tracking silently broken** — rules used dotted `taps.*` allowlist keys that
  never match top-level `keys()`. Fixed to allow top-level `taps` map (with value checks).
  Verified live: taps write 200 (was 403).
- **Appointment double-booking** — anonymous visitors couldn't read booked slots (rules
  auth-gated). Added public `getBookedSlots` callable; modal now uses it. Verified live.
- Editor save crash on `undefined` inside arrays (stripUndefined now recurses); slug
  save-time block; legacy `ownerUid` convergence; `cancelPendingUpgrades` no longer deletes
  paid pendings; `createCheckout` dedupe only deletes >10-min-old pendings; Google redirect
  errors surfaced; FCM SW registered at a narrow scope (SW collision fix); card-flip
  keyboard trap fixed; removed zombie `publicCards` write + rules.
- Full report (all findings, fixes, and remaining items): **`HEALTH_CHECK.md`**.

### Verified
- Lint + frontend/functions typecheck clean.
- Live: callable request now 401 (server reachable, not CSP-blocked), analytics `taps` write
  200, `getBookedSlots` 200, appointment modal renders 16 slots with no errors, save-contact
  vCard download intact.

---

## 2026-08-07 — Fix card-image render error for cards with social links

- `/card-images/<slug>.png` failed with 500 for cards that had social links
  (e.g. `marynown`, `cleanwindows`, `linda-westman`): satori threw
  `Expected <div> to have explicit "display: flex" ... if it has more than one child node`.
- Root cause: the social-chip `<div>` wrapped a single nested `<div>` (the styled
  text) without an explicit `display`, which satori rejects. Contact chips already
  had `display: flex`.
- Fix: added `display: flex; align-items: center; justify-content: center` to the
  social chip in `renderCardImage`.
- Verified: all 10 public cards now render the portrait (0 failures), the in-browser
  Save Image download works on a previously-failing card, and the 1200×630 OG
  previews are unaffected.

---

## 2026-08-06 — Vertical card image + SEO / AI-search optimization

### Vertical card image ("Save Image")
- New endpoint `/card-images/<slug>.png` — a **1080×1890 portrait** card rendered with
  satori+resvg: profile photo (or initials), name, job/company, bio, and contact chips
  (phone, email, website, address) + socials, in the dark premium brand style.
  CardViewer "Save Image" now downloads this instead of the landscape OG preview.
- `cardOgImage` serves both `/og-images/` (1200×630) and `/card-images/` (portrait);
  hosting rewrite `/card-images/**` → `cardogimage`. Verified 1080×1890 PNG.

### SEO / AI-search optimization
- **Per-card canonical** — `cardPage` now rewrites `<link rel="canonical">` to the card
  URL (was pointing every card at the homepage).
- **Person JSON-LD** — injected per card: name/givenName/familyName, jobTitle,
  worksFor (company), url, image (profile photo), telephone, email, description,
  sameAs (socials), address. `</` escaped for safe embedding.
- **`og:image:alt` / `twitter:image:alt`** added (homepage + per card).
- **Dynamic `/sitemap.xml`** — `cardPage` serves a sitemap built from static routes +
  every public card slug (admin SDK query, 1h cache). Static `public/sitemap.xml` removed
  (Firebase Hosting serves static files ahead of rewrites); hosting rewrite
  `/sitemap.xml` → `cardpage`. Verified: 13 card URLs.
- **Semantic H1 on card pages** — the person's name/company is now an `<h1>` in
  `CardViewerPage` (Google renders JS, so it indexes). Verified exactly one rendered H1.
- **Rolodex `?search=` support** — `RolodexPage` seeds its search box from the URL
  param, making the existing `SearchAction` JSON-LD valid.
- Homepage already had: title, meta description, og/twitter, canonical, robots,
  WebSite + Organization JSON-LD. All pages have a single H1 (verified).

### Verified (headless + HTTP)
- `/card-images/amir-drissi.png` → 1080×1890 PNG.
- `/sitemap.xml` → 13 card entries, `max-age=3600`.
- Card page HTML: correct canonical, Person JSON-LD, og:image:alt.
- Rendered DOM: exactly one H1 ("Amir Drissi"); Save Image downloads the portrait.

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
