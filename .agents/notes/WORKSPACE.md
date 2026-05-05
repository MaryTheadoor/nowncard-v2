# NownCard v2 — Working Memory

> React 19 + Vite + Tailwind v4 + Firebase v12
> Live: https://nowncard.com (custom domain → nowncard-v2 hosting site in vcard-studio-314 project)

---

## Last Session

**Date:** 2026-05-05
**Agent focus:** Codebase cleanup, lint fixes, build stabilization, deployment reconnaissance

### What Got Done
1. Fixed 22 ESLint errors across 7 files (setState in effects, unused vars, empty catches, Date.now in render)
2. Fixed 3 TypeScript build errors (unused variables)
3. Committed all uncommitted WIP as `8040cf1`
4. Verified live deployment: `nowncard.com` and `nowncard-v2.web.app` serve identical React bundles
5. Mapped Firebase account: project `vcard-studio-314`, hosting site `nowncard-v2`
6. Created this WORKSPACE.md

### Build Status
- `npm run build` ✅
- `npm run lint` ✅ (0 errors, 0 warnings)
- Dev server: `npm run dev` → http://localhost:5173

---

## Feature Audit (React Codebase — Actual State)

### Editor (/editor, /editor/:id)
- [x] Name: Prefix, First, Middle, Last, Suffix, Nickname
- [x] Work: Job Title, Department, Company
- [x] Contact: Phones (array, typed), Emails (array, typed), Websites (array, typed)
- [x] Addresses: Structured (street, city, state, zip, country) — array, typed
- [x] About: Bio textarea, Birthday date, Anniversary date
- [x] Photos: Profile + Background upload to Firebase Storage
- [x] Slug: Custom input with auto-slugify
- [x] Settings: Public toggle, Team card toggle (business plan), Name layout (personal/business)
- [x] Appearance: Accent color picker, Card bg color picker, Light/Dark preset buttons
- [x] Typography: Google Fonts dropdown (pro+), Custom font upload (business), Size scale slider
- [x] Live preview of font changes
- [x] Plan limits enforced on save (free=1, pro=5, business=unlimited)
- [x] Slug uniqueness check scoped to user

### Dashboard (/dashboard)
- [x] Personal cards list
- [x] Team cards list (where user is teamOwnerId)
- [x] Plan badge display
- [x] Card actions: Edit, View, Copy Link, Delete, vCard Download
- [x] Demo card creation (Wand2 button)
- [x] Create new card / Create team card buttons
- [x] Empty state

### Public Card (/card/:slug)
- [x] Load by slug from `cards` + `publicCards` collections
- [x] View count increment
- [x] 3D flip animation (CSS rotateY)
- [x] Front: Profile photo, name/org/bio, contact links, social pills
- [x] Back: Logo, name, QR code
- [x] Theme support: custom bg color, dark/light presets
- [x] Dynamic font loading (Google Fonts + custom)
- [x] Tap tracking: flip, call, email, website, map, save, share, social:*
- [x] Time-on-page tracking (beforeunload)
- [x] Mobile sticky action bar (Save, QR toggle, Share)
- [x] Desktop action bar (Save, QR toggle, Share)
- [x] ShareModal fallback when native share unavailable
- [x] AuthModal for sign-in prompts

### Analytics (/analytics/:id)
- [x] Card-level analytics page (views, taps, device, referrer)
- [x] Reads from `analytics/{cardId}` collection

### NFC (/nfc/:slug)
- [x] Web NFC tag programming page
- [x] URL mode and vCard mode
- [x] Device support detection
- [x] Preview of what will be written

### Rolodex (/rolodex)
- [x] Public card directory
- [x] Search by name/company
- [x] Filter by company

### Admin (/admin)
- [x] Admin gate (isAdmin field or bootstrap UID)
- [x] Pending upgrades table
- [x] User search by email
- [x] Plan assignment buttons

### Landing (/)
- [x] Hero with demo card
- [x] Features grid
- [x] Audience tags
- [x] Pricing tiers (Free/Pro/Business) with Square links
- [x] Support/tip section
- [x] Auth-aware CTAs

### Auth
- [x] Email/password sign up + sign in
- [x] Google OAuth popup
- [x] Anonymous sign in
- [x] Auth state persistence
- [x] Auth modal (signin/signup toggle)
- [x] Protected route redirects

### Payments
- [x] Square payment links integration
- [x] Pending upgrades creation
- [x] Success/cancel pages
- [x] Plan badge display

### PWA
- [x] manifest.json
- [x] Service worker (basic)
- [x] Icons (192, 512, apple-touch-icon)

---

## Known Issues / Debt

- [ ] **No Git remote** — repo is local-only, not connected to GitHub
- [ ] **Chunk size warning** — main JS bundle ~798KB, should consider code-splitting
- [ ] **No SEO files** — robots.txt, sitemap.xml missing
- [ ] **Service worker is minimal** — no real caching strategy
- [ ] **Anonymous auth disabled in Firebase Console** — blocks unauthenticated editor access
- [ ] **Custom domain verification** — `nowncard.com` works but not confirmed in Firebase Console CLI
- [ ] **No Playwright tests** — PRD mentions e2e tests but none exist in this repo
- [ ] **Social links use free-text platform input** — no dropdown of preset platforms
- [ ] **No client-side image compression** — uploads raw files to Storage
- [ ] **Plan enforcement is client-side only** — Firestore rules don't enforce card limits

---

## Session Log

### 2026-05-05 — Build Stabilization
- Reconstructed project context from filesystem (no chat history available)
- Fixed 22 lint errors + 3 TS errors
- Committed WIP
- Verified live deployment at nowncard.com

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server (http://localhost:5173) |
| `npm run build` | Production build → `dist/` |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build locally |
| `firebase deploy --only hosting` | Deploy to Firebase |


---

## Feature Audit Results (2026-05-05)

### Critical Issues

| # | Issue | Impact | File |
|---|-------|--------|------|
| 1 | **Editor has NO live card preview** | Users can't see their card while editing. PRD requires 60/40 split-screen with sticky physical card preview. | `EditorPage.tsx` |
| 2 | **Dashboard queries `ownerId` / `teamOwnerId`** — PRD schema uses `ownerUid`. Cards created via PRD schema won't load. | Data model mismatch breaks card loading | `DashboardPage.tsx`, `EditorPage.tsx` |
| 3 | **CardViewer back face loses `translateZ(3px)`** | Inline `transform: rotateY(180deg)` overrides CSS class, causing z-fighting/flicker during flip | `CardViewerPage.tsx` |
| 4 | **No tap-to-flip on card** | PRD: "Trigger: tap/click anywhere on card". Only buttons flip it. | `CardViewerPage.tsx` |
| 5 | **Background image overlay too opaque** | Gradient is 90%+ opaque, making uploaded backgrounds invisible. PRD: 30% opacity. | `CardViewerPage.tsx` |

### Major Missing Features

| Feature | PRD Section | Status |
|---------|-------------|--------|
| Live preview in editor | §6 | ❌ Not implemented |
| Split-screen layout (>1024px) | §6 | ❌ Single column only |
| Drag-and-drop image uploads | §6 | ❌ Standard file inputs |
| Client-side image compression | §6 | ❌ Raw uploads |
| Slug auto-generation from name | §6 | ❌ Empty by default |
| Slug live availability check (400ms debounce) | §6 | ❌ Only checked on save |
| Slug validation (lowercase, alnum + hyphens, min 3) | §6 | ❌ No client-side validation |
| Four named themes (Cosmic Navy, Clean Light, Warm Earth, Minimal) | §6 | ❌ Only Light/Dark |
| Accent color presets (6 + custom) | §6 | ❌ Raw HTML5 color picker only |
| Copy Link / View Card / Cancel buttons below form | §6 | ❌ Only Save/View in header |
| Admin section in dashboard | §7 | ❌ Missing entirely |
| Per-card dynamic Open Graph meta tags | §8 | ❌ Static generic tags only |
| Save + Share buttons on card back face | §8 | ❌ Only QR code |
| Tap-to-flip | §8 | ❌ Button-only flip |
| Hint text ("Tap to flip · QR on back") | §8 | ❌ Missing |
| Mobile sticky bar: light bg, dark text | §8 | ❌ Dark translucent bar |
| Print stylesheet | §8 | ❌ Missing |
| `robots.txt` / `sitemap.xml` | — | ❌ Missing |

### Design Deviations

| Element | PRD Spec | Actual | Severity |
|---------|----------|--------|----------|
| Card width mobile | `92vw` | `100vw - 40px` (from padding) | Minor |
| Card material | Paper texture | Flat solid color | Minor |
| Profile photo | 72px | 88px | Minor |
| Front face padding | 28px | 24px sides, 20px bottom | Minor |
| Social pills | Lowercase, `border-radius: 999px` | Uppercase, `rounded-md` (~6px) | Moderate |
| Mobile sticky bar label | "Save to contacts" | "Save" | Minor |
| Footer on mobile | Visible | Hidden behind sticky bar | Moderate |

### Extra Features (Not in PRD)

These exist and are good, just not in the original spec:
- Typography panel: Google Fonts, custom font upload, size scale
- Name layout toggle (Personal vs Business)
- Card background color picker (free-form hex)
- Anniversary date field
- Team card system
- NFC programming page
- Analytics dashboard page
- Rolodex public directory
- ShareModal component

---

## Recommended Priority Order

1. **Fix `ownerId` → `ownerUid` schema mismatch** (or migrate DB) — without this, cards won't load correctly
2. **Add live card preview to editor** — this is the core UX gap; users are flying blind
3. **Fix CardViewer flip bugs** (translateZ, tap-to-flip, back face buttons)
4. **Fix background image visibility** (reduce overlay opacity)
5. **Add slug auto-generation + validation**
6. **Add image compression** (keeps Storage costs down)
7. **Add per-card Open Graph meta tags**
8. **Add robots.txt + sitemap.xml**
9. **Reconnect repo to GitHub** (currently local-only)
