# NownCard v2 — Master Feature & Audit Document
*Generated: 2026-05-05*

---

## Architecture Overview

- **Frontend:** React 19 + Vite 8 + Tailwind CSS v4 + TypeScript (strict)
- **Backend:** Firebase (Auth, Firestore, Storage, Hosting)
- **Payments:** Square Checkout Links (client-side redirect)
- **QR Codes:** `qrcode.react` (SVG + Canvas)
- **Bundle:** ~336KB main + ~420KB Firebase vendor (code-split by route)

---

## Pages & Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `LandingPage` | Marketing homepage, pricing, interactive demo card |
| `/dashboard` | `DashboardPage` | Card management hub (personal + team cards) |
| `/editor` | `EditorPage` | Create new card |
| `/editor/:id` | `EditorPage` | Edit existing card |
| `/card/:slug` | `CardViewerPage` | Public digital business card (3D flip, save, share, QR) |
| `/poster/:slug` | `QrPosterPage` | Printable 8.5"×11" QR lobby poster |
| `/nfc/:slug` | `NfcPage` | Program physical NFC tags (URL or vCard) |
| `/analytics/:id` | `AnalyticsPage` | Per-card analytics (views, saves, time on page) |
| `/rolodex` | `RolodexPage` | Public directory of all public cards |
| `/admin` | `AdminPage` | Internal admin (approve upgrades, manage users) |
| `/success` | `SuccessPage` | Post-payment plan activation |
| `/cancel` | `CancelPage` | Payment cancellation cleanup |
| `*` | `NotFoundPage` | 404 page |

---

## Feature Inventory

### Authentication
- Email/password sign-in & sign-up
- Google OAuth sign-in & account linking
- Anonymous authentication (Firebase REST API)
- Auth state persisted via Firebase Auth
- Admin role system (`users/{uid}.isAdmin`)

### Card Editor
- **Basic Info:** Prefix, first/middle/last name, suffix, nickname, job title, department, company, bio
- **Contact:** Multiple phones, emails, websites, addresses (with type labels)
- **Social Links:** LinkedIn, X/Twitter, GitHub, Instagram, YouTube, Facebook, TikTok, custom website
- **Images:** Profile photo, background photo, custom logo (Business plan)
- **Design:** Light/dark theme, custom background color, accent color, font family (Google Fonts + custom upload), font size scaling, font color
- **Layout:** Personal vs business name layout, profile shape (circle/rounded/square), profile size (small/medium/large)
- **Background Image Opacity:** 0-100% slider
- **Slug:** Auto-generated from name, uniqueness checked, manual "Regen" button
- **Settings:** Public/private toggle, team card toggle, hide navbar toggle
- **Contact Import:** "Use my profile" (Firebase Auth), "Import from phone" (Contact Picker API), "Upload .vcf" (vCard parser)
- **Live Preview:** Front/back toggle with real-time theming

### Card Viewer (Public)
- 3D CSS flip animation (front ↔ back)
- Dynamic OpenGraph/Twitter meta tags
- Contact links: Call, email, website, address (maps), social profiles
- **Save to Contacts:** Web Share API with vCard file → auto-download .vcf → fallback toast
- Native share via `navigator.share`
- QR code on back face
- Analytics tracking: views, saves, flips, taps, time-on-page
- Custom font rendering (Google Fonts + uploaded fonts)
- Conditional navbar (can be hidden per card)

### Dashboard
- Personal cards list with plan usage badge
- Team cards list (for Business plan team owners)
- Card actions: View, Copy link, Toggle Public/Private, Download vCard, NFC, Poster, Analytics, Edit, Delete
- Plan limit enforcement (Free=1, Pro=5, Business=∞ personal cards)
- Demo card creation
- Upgrade CTA for free users

### Contact Book (Rolodex)
- Public directory of all public cards
- Client-side search by name, company, slug
- Alphabetical sorting

### Analytics
- Views, saves, flips, time-on-page
- Engagement breakdown bar chart
- Device & referrer display (last visitor only)

### NFC
- Web NFC API support detection
- Write URL or vCard payload to physical NFC tags
- Error handling for NFC failures

### QR Poster
- 8.5"×11" printable poster with large QR code
- Business vs personal layout
- Print via `window.print()`
- Download QR code as PNG (800px canvas)

### Admin
- Bootstrap admin activation (hardcoded UID)
- Pending upgrades table
- Approve/reject plan upgrades
- User search by email
- Direct plan assignment (free/pro/business)

### Payments
- Square checkout links (Pro $19/yr, Business $39/yr)
- Pending upgrade tracking in Firestore
- Success/cancel landing pages with plan activation

---

## Data Model

### Card (Firestore `cards` collection)
```ts
interface Card {
  id: string;
  ownerUid: string;
  ownerId?: string;        // legacy
  slug: string;
  prefix?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
  nickname?: string;
  jobTitle?: string;
  department?: string;
  company?: string;
  phones?: Phone[];
  phone?: string;          // legacy
  emails?: Email[];
  email?: string;          // legacy
  addresses?: Address[];
  address?: string;        // legacy
  website?: string;        // legacy
  websites?: Website[];
  socialLinks?: SocialLink[] | Record<string, string>;
  birthday?: string;
  anniversary?: string;
  bio?: string;
  profileImage?: string;
  profileShape?: 'circle' | 'rounded' | 'square';
  profileSize?: 'small' | 'medium' | 'large';
  backgroundImage?: string;
  bgImageOpacity?: number;
  accentColor?: string;
  cardTheme?: 'light' | 'dark';
  cardBgColor?: string;
  fontFamily?: string;
  fontSizeScale?: number;
  customFontUrl?: string;
  fontColor?: string;
  logoImage?: string;
  hideNavbar?: boolean;
  nameLayout?: 'personal' | 'business';
  isTeamCard?: boolean;
  teamOwnerUid?: string;
  teamOwnerId?: string;    // legacy
  isPublic: boolean;
  viewCount?: number;
  saveCount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}
```

### Other Collections
- `users` — plan, isAdmin, cardCount, email, createdAt, lastLogin
- `publicCards` — denormalized cache of public cards (legacy/mirror)
- `analytics` — timeOnPage, taps, device, referrer, updatedAt
- `pendingUpgrades` — uid, plan, price, used, createdAt, usedAt

---

## Security Rules Summary

- `users` — own doc only (read/write), admin can read all
- `cards` — owner or team owner can CRUD; public cards readable by anyone
- `publicCards` — readable by anyone; admin write only
- `analytics` — **wide open write** (`allow write: if true;`) ⚠️
- `pendingUpgrades` — admin only

---

## Audit Findings

### Critical Bugs (fix now)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | `useAuth.loading` becomes `false` before Firestore `userData` fetch completes | `useAuth.ts` | Plan-gated UI flickers; free users briefly see pro features |
| 2 | Anonymous sign-in loading state leaks (stays `true` on success) | `AuthModal.tsx` | Button stays disabled after successful anon sign-in |
| 3 | Google button always says "Sign in" even when linking accounts | `AuthModal.tsx` | Confusing UX for authenticated users linking Google |
| 4 | `saveCount` only increments for `cards`, not `publicCards` | `CardViewerPage.tsx` | Public directory cards don't track saves |
| 5 | Analytics overwrites `device`/`referrer` (only last visitor stored) | `CardViewerPage.tsx` | Analytics shows only last visitor's device, not distribution |
| 6 | vCard output doesn't escape semicolons/commas in names/addresses | `vcard.ts` | Names/addresses with special chars break vCard parsing |
| 7 | Image upload silently fails if slug not set | `EditorPage.tsx` | User uploads photo before naming card → nothing happens, no error |
| 8 | `no-print` / `print-only` utilities set hard `display` values | `index.css` | May conflict with Tailwind classes in print mode |
| 9 | `DemoCard` Share button has no `onClick` | `DemoCard.tsx` | Dead button in action bar |
| 10 | `ShareModal` "Copied" state persists across re-opens | `ShareModal.tsx` | Reopen modal within 2s → still shows "Copied" |
| 11 | `Navbar` accepts `onSignOut` but has no sign-out UI | `Navbar.tsx` | Users can't sign out from navigation |
| 12 | `SuccessPage`/`CancelPage` use raw `onAuthStateChanged` instead of `useAuth` | `SuccessPage.tsx`, `CancelPage.tsx` | Inconsistent auth pattern |
| 13 | `RolodexPage` has commented-out import | `RolodexPage.tsx` | Dead code |
| 14 | `firebase.ts` App Check debug token set to `true` (should be string) | `firebase.ts` | App Check debug mode non-functional |
| 15 | `firebase.ts` no init error handling | `firebase.ts` | App crashes on import if Firebase fails |

### Medium Priority (polish)

| # | Issue | Location |
|---|-------|----------|
| 16 | `getCardLimit` called inline in JSX repeatedly | `DashboardPage.tsx` |
| 17 | `AdminPage` no confirmation dialogs on approve/plan change | `AdminPage.tsx` |
| 18 | `useAuth` Firestore errors silently swallowed | `useAuth.ts` |
| 19 | `ShareModal` SMS href uses non-standard `?&body=` format | `ShareModal.tsx` |
| 20 | `CardPreview` back face QR is non-scannable placeholder | `CardPreview.tsx` |
| 21 | `CardPreview` contact links are non-interactive `<span>` | `CardPreview.tsx` |
| 22 | `EditorPage` race condition on plan limit check | `EditorPage.tsx` |
| 23 | `compressImage` lacks EXIF orientation handling | `utils.ts` |
| 24 | `compressImage` no max-height constraint | `utils.ts` |
| 25 | `escHtml` doesn't escape single quotes | `utils.ts` |
| 26 | Missing `prefers-reduced-motion` support | `index.css` |
| 27 | SEO meta tags are client-side only (no SSR/prerender) | `CardViewerPage.tsx` |

### Low Priority / Future

| # | Issue | Location |
|---|-------|----------|
| 28 | No testing framework | `package.json` |
| 29 | No `firestore.indexes.json` configured | Project root |
| 30 | No Content-Security-Policy headers | `firebase.json` |
| 31 | `publicCards` collection synchronization logic missing | Architecture |
| 32 | vCard 3.0 (consider 4.0) | `vcard.ts` |
| 33 | No PWA/service worker config | `vite.config.ts` |
| 34 | Hardcoded bootstrap admin UID | `AdminPage.tsx` |

---

## Recent Changes (this session)

1. **Custom hex code input** — Pro/Business users can type exact hex values next to color picker
2. **Background image opacity slider** — Replaced hardcoded gradient overlays with 0-100% opacity control
3. **QR Lobby Poster** — `/poster/:slug` printable 8.5"×11" poster with QR download
4. **Admin pending upgrades fix** — Removed composite index dependency, client-side sort
5. **Contrast fixes** — Back face buttons theme-aware, muted text darkened for readability
6. **CardPreview lint fix** — Eliminated "components created during render" warning
7. **DemoCard rewrite** — Full 3D flip, real QR code, vCard download, action bar
