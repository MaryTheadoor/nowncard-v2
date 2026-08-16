# AGENTS.md — NownCard v2

> **Purpose:** Give any new agent instant, complete context on this project — stack, architecture, live state, known issues, and how to work safely.
> **Last updated:** 2026-07-27
>
> ⚠️ **REBUILD IN PROGRESS.** The June 2026 rebuild (`dev` branch) was discarded as unstable. The canonical codebase is now `master` (last stable deploy, 2026-05-19). See **`MASTER_SPEC.md`** for the authoritative reference and implementation plan.

---

## 1. Project Overview

**NownCard** is a digital business card platform. Users create cards in an editor, share them via URL/QR/NFC, and recipients can save contacts as vCards.

- **Live URL:** https://nowncard.com
- **Firebase Project:** `vcard-studio-314`
- **Hosting Sites:** `nowncard-v2` (primary, custom domain) + `vcard-studio-314` (fallback)
- **Repo:** https://github.com/MaryTheadoor/nowncard-v2

---

## 2. Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Framework | React | 19 |
| Build Tool | Vite | 8 |
| Styling | Tailwind CSS | v4 |
| Language | TypeScript | strict |
| Backend | Firebase | v12 (modular SDK) |
| Auth | Firebase Auth | Email/Password, Google OAuth, Anonymous |
| Database | Firestore | Native mode |
| Storage | Firebase Storage | Images only |
| Hosting | Firebase Hosting | Custom domain `nowncard.com` |
| Cloud Functions | Firebase Functions v2 | Node.js 22 runtime |
| Payments | Square | Dynamic checkout via `createCheckout` Cloud Function |
| Push Notifications | FCM | Replaced OneSignal (2026-05-15) |
| QR Codes | `qrcode.react` | SVG |
| Icons | `lucide-react` | — |
| Toast | `sonner` | — |

**What we DON'T use:**
- No CSS-in-JS (Tailwind only)
- No Redux/Zustand (React hooks + Context sufficient)
- No heavy animation libraries (CSS transforms only)

---

## 3. File Structure

```
owncard-v2/
├── public/                    # Static assets
│   ├── sw.js                  # Service worker (cache name: nowncard-v2)
│   ├── manifest.json          # PWA manifest
│   ├── nowncard-logo.png      # Brand logo
│   ├── robots.txt             # SEO
│   └── sitemap.xml            # SEO
├── src/
│   ├── main.tsx               # Entry point
│   ├── App.tsx                # Router + route definitions
│   ├── index.css              # Tailwind directives + CSS variables
│   ├── lib/
│   │   ├── firebase.ts        # Firebase app init (Auth, Firestore, Storage)
│   │   ├── utils.ts           # Helpers: initials, orgLine, slugify, compressImage, etc.
│   │   ├── vcard.ts           # vCard 3.0 generation + download
│   │   ├── vcard-parser.ts    # .vcf file import parser
│   │   ├── demo.ts            # createDemoCard helper
│   │   └── payments.ts        # Square checkout integration
│   ├── components/
│   │   ├── Navbar.tsx         # Global nav (auth-aware, admin link)
│   │   ├── AuthModal.tsx      # Sign in/up modal (email + Google + anonymous)
│   │   ├── ShareModal.tsx     # Copy-link + native share fallback
│   │   ├── LivePagePreview.tsx # Editor preview: LiveCardPreview + mocked page chrome
│   │   ├── LiveCardPreview.tsx# Live preview in editor (front/back, real-time)
│   │   ├── DemoCard.tsx       # Landing page animated demo card
│   │   ├── Footer.tsx         # Site footer
│   │   ├── (no ui/ dir — hand-rolled Tailwind + CSS vars, no shadcn)
│   ├── pages/
│   │   ├── LandingPage.tsx    # Marketing homepage
│   │   ├── DashboardPage.tsx  # Card list + messaging inbox
│   │   ├── EditorPage.tsx     # Create/edit card (split-screen)
│   │   ├── CardViewerPage.tsx # Public card (3D flip, QR, save, share, messaging)
│   │   ├── AnalyticsPage.tsx  # Per-card stats
│   │   ├── RolodexPage.tsx    # Public directory of cards
│   │   ├── NfcPage.tsx        # NFC tag programming
│   │   ├── AdminPage.tsx      # Admin panel (pending upgrades, user mgmt)
│   │   ├── SuccessPage.tsx    # Post-payment confirmation
│   │   ├── CancelPage.tsx     # Payment cancellation
│   │   ├── TermsPage.tsx      # Terms of service
│   │   ├── PrivacyPage.tsx    # Privacy policy
│   │   ├── ContactPage.tsx    # Contact form
│   │   └── NotFoundPage.tsx   # 404
│   ├── hooks/
│   │   ├── useFCM.ts         # Push notification subscription (FCM)
│   │   ├── useCardTheme.ts   # Computes card face styles from card config
│   └── types/
│       └── index.ts           # TypeScript interfaces (Card, Message, UserData, etc.)
├── functions/
│   ├── src/index.ts           # Cloud Functions v2 (Square webhook, createCheckout, notifyOnMessage)
│   ├── package.json           # Functions deps
│   └── tsconfig.json          # Functions TS config
├── firebase.json              # Hosting rewrites + functions config
├── firestore.rules            # Security rules
├── firestore.indexes.json     # Composite indexes
├── storage.rules              # Storage security rules
├── index.html                 # HTML entry (OneSignal SDK loaded via CDN)
├── vite.config.ts             # Vite config (React plugin, path aliases)
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── package.json
├── AGENTS.md                  # ← This file
├── README.md                  # Human-facing project overview
├── MASTER_AUDIT.md            # Feature inventory + audit findings
├── DEPLOY_AUDIT.md            # Deployment change log
├── FEATURE_CHECKLIST.md       # Feature completion tracking
├── SQUARE_INTEGRATION.md      # Square payment setup
└── docs/
    ├── PRD-NownCard-v2.md     # Product Requirements Document
    ├── DEPLOYMENT_GUIDE.md    # Legacy deployment guide
    ├── FIREBASE_SETUP.md      # Legacy Firebase setup
    ├── CUSTOM_DOMAIN_SETUP.md # Domain configuration
    ├── FEATURES.md            # Feature descriptions
    └── ROADMAP.md             # Future plans
```

---

## 4. Routes

| Route | Auth | Page |
|-------|------|------|
| `/` | Public | LandingPage |
| `/card/:slug` | Public | CardViewerPage |
| `/poster/:slug` | Public | QrPosterPage (printable poster) |
| `/rolodex` | Public | RolodexPage |
| `/terms` | Public | TermsPage |
| `/privacy` | Public | PrivacyPage |
| `/contact` | Public | ContactPage |
| `/dashboard` | Required | DashboardPage |
| `/editor` | Required | EditorPage (create) |
| `/editor/:id` | Required | EditorPage (edit) |
| `/analytics/:id` | Required | AnalyticsPage |
| `/nfc/:slug` | Required | NfcPage |
| `/admin` | Admin only | AdminPage |
| `/success` | Public | SuccessPage |
| `/cancel` | Public | CancelPage |
| `*` | Public | NotFoundPage |

---

## 5. Data Model

### `cards/{cardId}`
```ts
interface Card {
  id: string;
  ownerUid: string;           // Firebase Auth UID
  ownerId?: string;           // LEGACY — same as ownerUid, may exist on old cards
  slug: string;               // URL-friendly unique identifier
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
  phone?: string;             // legacy single field
  emails?: Email[];
  email?: string;             // legacy single field
  addresses?: Address[];
  address?: string;           // legacy single field
  websites?: Website[];
  website?: string;           // legacy single field
  socialLinks?: SocialLink[] | Record<string, string>;
  birthday?: string;
  anniversary?: string;
  bio?: string;
  profileImage?: string;      // Firebase Storage URL
  backgroundImage?: string;   // Firebase Storage URL
  bgOpacity?: number;         // 0–1 overlay opacity
  bgPosition?: string;
  bgSize?: string;
  accentColor?: string;       // hex, default #e8a628
  cardTheme?: 'light' | 'dark';
  cardBgColor?: string;
  pageBgColor?: string;
  textColor?: string;         // Overrides all card text
  fontFamily?: string;        // Google Font name or 'CustomFont'
  fontSizeScale?: number;
  customFontUrl?: string;
  nameLayout?: 'personal' | 'business';
  profileShape?: 'circle' | 'rounded' | 'square';
  profileSize?: 'small' | 'medium' | 'large';
  isTeamCard?: boolean;
  teamOwnerUid?: string;
  teamOwnerId?: string;       // legacy
  isPublic: boolean;
  hideNavbar?: boolean;
  qrMode?: 'url' | 'vcard';
  viewCount?: number;
  saveCount?: number;
  createdAt?: unknown;        // Firestore Timestamp
  updatedAt?: unknown;        // Firestore Timestamp
}
```

### `users/{uid}`
```ts
interface UserData {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  plan?: 'free' | 'pro' | 'business';
  cardCount?: number;
  isAdmin?: boolean;
  createdAt?: unknown;
  oneSignalPlayerId?: string; // Push notifications
}
```

### `messages/{messageId}`
```ts
interface Message {
  id: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  recipientUid: string;       // MUST be owner's auth UID (NOT card doc ID)
  cardId: string;
  cardSlug: string;
  content: string;
  createdAt: unknown;
  read: boolean;
}
```

### Other Collections
- `publicCards/{slug}` — denormalized cache of public cards (legacy, may not be actively maintained)
- `analytics/{cardId}` — tap/view tracking
- `pendingUpgrades/{id}` — Square payment tracking
- `upgrades/{id}` — Completed upgrade log

---

## 6. Critical Architecture Patterns

### Text Color Override
`card.textColor` is applied universally via inline `textColorStyle` override across ALL card rendering components:
- `LiveCardPreview`
- `CardPreview`
- `CardViewerPage`
- `DemoCard`

Every text element uses `style={{ ...textColorStyle, ... }}` so the user's chosen text color applies to name, org, bio, links, socials, QR label, buttons, and hints.

### Card Face Z-Index
Both front and back faces wrap content in:
```tsx
<div className="relative z-10 flex-1 flex flex-col ...">
```
This ensures background overlays don't paint on top of interactive elements (QR, buttons).

### Background Image
If `card.backgroundImage` is set:
1. `absolute inset-0` div with the image
2. `absolute inset-0` div with `tc.overlayBg` at `bgOpacity` opacity
3. Content in `relative z-10` wrapper

Both front AND back faces render the background image (this was a bug fix — back face was missing it in `CardViewerPage`).

### Messaging Architecture
- Messages stored in `messages` collection
- Firestore rules require `senderUid == request.auth.uid`
- Dashboard subscribes via `where('recipientUid', '==', user.uid)` — **client-side sort** (no composite index needed)
- `recipientUid` MUST be the card owner's auth UID (`ownerUid` or legacy `ownerId`) — NEVER the Firestore doc ID (`card.id`)

### Owner UID Fallbacks
Legacy cards may have `ownerId` instead of `ownerUid`. Code must check BOTH:
```ts
const owner = card.ownerUid || (card as unknown as Record<string, unknown>).ownerId;
```
This applies to:
- CardViewerPage messaging (recipientUid)
- Dashboard queries (queries both fields)
- EditorPage ownership check

---

## 7. Build & Deploy Commands

```bash
# Development
npm run dev          # localhost:5173

# Build & lint
npm run build        # Production build → dist/
npm run lint         # ESLint check

# Deploy
firebase deploy --only hosting           # Frontend only
firebase deploy --only functions         # Cloud Functions only
firebase deploy                          # Everything

# Functions build (must do before function deploy)
cd functions && npm install && npm run build && cd ..
```

### Deploy Workflow (staging → production)

Both hosting sites serve the same `dist`, so the only difference is deploy order:

- **Staging:** `firebase deploy --only hosting:nowncard-v2` → verify at https://nowncard-v2.web.app
- **Production:** `firebase deploy --only hosting:vcard-studio-314` → https://nowncard.com

**Convention:** for anything beyond a trivial change, deploy to **staging first**, manually
verify there, then promote to production. This keeps untested builds off the live site —
especially important as the user base grows.

---

## 8. Known Issues & Active Decisions

### Known Issues & Active Decisions
| Issue | Status | Details |
|-------|--------|---------|
| Auth hook duplicates listeners | 🟡 Planned fix | `useAuth.ts` subscribes per-call; Phase 1 of MASTER_SPEC migrates to context-based AuthProvider |
| No automated tests | 🟢 Low | vitest.config.ts exists, no test script in package.json; Phase 5 |

### Recently Fixed (deployed)
| Issue | Fix |
|-------|-----|
| Messaging black hole | `recipientUid` now strictly uses `card.ownerUid` (with `ownerId` fallback) |
| Department invisible | Added `department` to `orgLine()` in `utils.ts` |
| No hex color editing | Added `#RRGGBB` text inputs next to all color pickers |
| Dashboard messages error | Removed `orderBy` from query — client-side sort avoids composite index requirement |
| Background image on back face | Added to `CardViewerPage` back face (was only on front) |
| Anti-spam blocking sends | Removed anti-spam query entirely (was requiring composite index) |
| Service worker stale cache | Bumped cache name to `nowncard-v2`, stopped intercepting `.js`/`.css` |
| Navbar auth on static pages | Static pages now pass full auth props to Navbar |
| Sign Out everywhere | Desktop nav + all pages have working Sign Out |

### Legacy Data Migration Notes
- `ownerId` → `ownerUid`: EditorPage now ensures `ownerUid` is written on every save (both create and update)
- `teamOwnerId` → `teamOwnerUid`: Same pattern
- Cards without `ownerUid` will get it populated next time they're edited

---

## 9. Environment & Secrets

### Client-side (not secret, compiled into build)
Firebase config is in `src/lib/firebase.ts` (hardcoded — not using `.env` for simplicity).

### Cloud Function Secrets (set via Firebase CLI)
```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY
```

### FCM Client Config
Handled automatically via Firebase Messaging (project-scoped). VAPID key is hardcoded in `src/lib/messaging.ts`. Service worker is `public/firebase-messaging-sw.js`.

---

## 10. Coding Conventions

- **Tailwind only** — no inline CSS except for dynamic values (colors, fonts, sizes)
- **Design system — "Warm Paper & Brass"** (2026-08 redesign). Single source of truth: `src/index.css` (`:root`/`.dark` CSS vars mapped via `@theme`; `tailwind.config.js` was DELETED — never recreate it; Tailwind v4 reads the CSS `@theme` block only).
  - Palette: warm paper `--space`/`--tile`, ink, brass `--accent` (fills only), dark bronze `--accent-text` (text/icon foregrounds — **never `text-accent` for text**), aubergine `--secondary`, `--tile-gold`, `--tile-violet` (replaced `tile-blue`).
  - Texture/elevation: `--grain-coarse`/`--grain-fine` SVG data-URIs (alpha ≤6-9%), `--shadow-tile`, `--focus-ring`; `.bg-tile` = raised card-stock, inputs = recessed via global inset shadows.
  - Chamfer utilities `.chamfer-sm`/`.chamfer-md` are `clip-path` — accent use only (solid tiles/badges); clip-path trims borders and shadows, so never combine with `shadow-*` or rely on borders at the notches.
  - Contrast is verified AA: every token pair in `src/index.css` was computed ≥4.5:1 (text) / ≥3:1 (UI). Before changing any token value, re-check with the WCAG luminance formula.
- **TypeScript strict** — no `any` without comment justification
- **Firebase modular SDK** — v12 tree-shakable imports
- **Toast errors** — use `sonner` toast for user-facing errors, `console.error` for dev details
- **Legacy field support** — always check both `ownerUid` and `ownerId` when reading cards
- **No card.id as recipientUid** — messaging MUST use auth UID, never Firestore doc ID

---

## 11. How to Onboard as a New Agent

1. **Read this file** (AGENTS.md) — you are here
2. **Read `MASTER_SPEC.md`** — authoritative reference: architecture, page specs, implementation plan
3. **Check `PRODUCTION_STATUS.md`** — current live state and recent deployments
4. **Run `npm run build`** — verify the codebase compiles
5. **Run `npm run dev`** — verify local dev server works
6. **Read the relevant page/component** before making changes

---

## 12. Contact & Ownership

- **GitHub:** https://github.com/MaryTheadoor/nowncard-v2
- **Firebase Console:** https://console.firebase.google.com/project/vcard-studio-314
- **Custom Domain:** `nowncard.com` → `nowncard-v2.web.app`

---

## 13. Critical Implementation Notes (from session retro)

### Edit Safety
- **Lint after every single edit.** Never batch changes without verifying.
- **Commit after every successful edit.** One broken edit can destroy hundreds of lines with no checkpoint.
- **Use `git checkout <commit> -- <file>`** to restore individual files from known-good commits.
- **EditorPage.tsx section order:** Auto-Fill → Basic Info → Settings → Typography → Contact → Addresses → Social Links → Payment Links → Images. Settings and Typography are BETWEEN Info sections — not grouped together.

### Shared State
- **useCardTheme hook** (`src/hooks/useCardTheme.ts`) is the SINGLE source for card theme computation (`tc` object, bgOpacity, bgSizeStyle, profile sizing). All 3 card renderers (DemoCard, LiveCardPreview, CardViewerPage — LivePagePreview delegates to LiveCardPreview) MUST use it. Never inline `tc` or derived variables. Card color values here must stay in sync with the `--card-*` vars in `src/index.css`.
- **DemoCard `forceLight` prop** bypasses cardTheme but bgOpacity must be destructured from useCardTheme, not read inline.
- **Card action pills in DashboardPage** (`px-3 py-1.5 bg-tile-soft border border-line rounded-lg text-xs`) are intentionally NOT migrated to `.btn-*` classes — they're a compact pattern.

### Background Image System
- **BackgroundPositioner API:** `react-easy-crop` `onCropComplete(croppedArea, croppedAreaPixels)`. First arg has 0-100 percentages. Second arg is pixels. Use `croppedArea.x/y` for CSS `background-position`.
- **bgZoom mapping:** Stored as percentage (100=normal). CSS needs `${bgZoom}% auto`. Never use `${bgZoom}%` alone.
- **backBackgroundImage field exists** on Card type. EditorPage handleUpload accepts `'backBackgroundImage'`. Back faces use `card.backBackgroundImage || card.backgroundImage`.

### Firebase
- **Firebase Secrets + .env conflict:** When using `defineSecret('SQUARE_ACCESS_TOKEN')`, remove that variable from `functions/.env` or deploy fails with "overlaps non secret environment variable".
