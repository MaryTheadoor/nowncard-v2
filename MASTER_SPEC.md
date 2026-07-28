# NownCard v2 — Master Specification

> **Purpose:** Single authoritative reference for the rebuild. Combines PRD vision with the known-stable code on `master` (commit `0a439f4`, 2026-05-19).
> **Status:** Rebuilding from this spec. Deviations from live code are intentional.

---

## 1. Project Goals

**NownCard** is a digital business card platform. Users create cards in an editor and share via URL, QR code, NFC tap, or vCard download. Recipients view cards in a 3D flip card viewer — no app required.

### MVP Success Criteria
1. ✅ Landing page loads, demo card renders, auth modal works
2. ✅ User can sign up/sign in (email, Google, anonymous)
3. ✅ User can create, edit, and delete cards in a dashboard
4. ✅ Editor has live card preview that updates in real-time
5. ✅ Public card page renders with 3D flip, QR code, contact links
6. ✅ vCard download works on all platforms
7. ✅ Square payment upgrade flow works end-to-end
8. ✅ Admin panel works for plan management

### Target Users
Service professionals (realtors, designers, consultants, healthcare workers) who need a reliable, professional-looking digital card to share with clients.

---

## 2. Architecture

### Tech Stack
| Layer | Choice |
|-------|--------|
| Framework | React 19 + TypeScript (strict) |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Backend | Firebase (Auth, Firestore, Storage, Hosting, Cloud Functions v2) |
| Payments | Square Checkout Links |
| QR | qrcode.react |
| Icons | lucide-react |
| Toast | sonner |

### Data Model
```
cards/{cardId}         — User-created cards (ownerUid, slug, contacts, media, settings)
users/{uid}            — Auth user profiles (plan, cardCount, isAdmin, fcmToken)
publicCards/{slug}     — Denormalized mirror of public cards (legacy, fading out)
analytics/{cardId}     — View/tap tracking
messages/{messageId}   — Inquiry messages from public cards to owners
pendingUpgrades/{id}   — Square payment tracking
upgrades/{id}          — Completed upgrade history
config/pricing         — Dynamic pricing document
```

### Auth System
- **Provider:** Firebase Auth (email/password, Google OAuth, anonymous)
- **Pattern:** Hook-based (`useAuth.ts`) — NOT context-based on master
- **Admin:** Hardcoded UID `EeiBBDTu5jOooHbxyOC98JSlt6r1`
- **Routes:** Protected pages redirect to `/` if unauthenticated

### Cloud Functions (v2, nodejs22)
| Function | Trigger | Purpose |
|----------|---------|---------|
| `squareWebhook` | HTTPS | Processes Square payment webhooks, auto-activates plans |
| `createCheckout` | Callable | Generates Square checkout link dynamically |
| `getPaymentDetails` | Callable | Retrieves payment/order details |
| `getPaymentHistory` | Callable | User's payment history |
| `notifyOnMessage` | onDocumentCreated | Sends FCM push when a message is created |
| `cleanupPendingUpgrades` | Scheduled | Deletes expired pending upgrades every 6 hours |

### Hosting
- **Primary:** nowncard.com → Firebase Hosting site `nowncard-v2`
- **Fallback:** vcard-studio-314.web.app
- **Firebase project:** `vcard-studio-314`
- **GitHub:** `MaryTheadoor/nowncard-v2` (public repo, default branch `master`)

---

## 3. Page Specifications

### 3.1 LandingPage (`/`)
**Purpose:** Marketing homepage — sell the product, show the demo, convert sign-ups.
**Auth:** Public
**Components:** Navbar, DemoCard, AuthModal, Footer
**Sections:** Hero (tagline + CTAs), Demo card, Pain Points, Features grid (NFC, QR, vCard, Custom Design, Eco), Pricing (Free/Pro/Business), FAQ
**Key behaviors:**
- "Create Your Card" → opens AuthModal if not logged in, navigates to /editor if logged in
- "View Plans" → scrolls to pricing section (hash `#pricing`)
- DemoCard alternates theme (light when site is dark, vice versa)
- Pricing cards trigger Square checkout via Cloud Function

### 3.2 DashboardPage (`/dashboard`)
**Purpose:** Card management hub + message inbox
**Auth:** Required
**Components:** Navbar (with message badge), Footer
**Sections:**
- Plan badge + upgrade CTA (free users)
- Card list with actions: View, Copy Link, Public/Private, vCard, NFC, Poster, Analytics, Edit, Delete
- Team cards section (Business plan only)
- Real-time messaging inbox with read/unread
- FCM push notification enablement
- Demo card creation for new users
**Data:** Firestore queries by ownerUid + legacy ownerId, onSnapshot for messages

### 3.3 EditorPage (`/editor`, `/editor/:id`)
**Purpose:** Card creation and editing with live preview
**Auth:** Required
**Components:** Navbar, LiveCardPreview, ShareModal, BackgroundPositioner
**Tabs:** Info (name, bio, contacts, socials, payments, settings) | Visuals (background images, typography, theme, colors, name layout)
**Key features:**
- Slug auto-generation from name with live uniqueness check
- Image upload (profile + background + back background) with client-side compression (800px)
- Background position/zoom/rotation via BackgroundPositioner
- Custom font upload + Google Fonts selector
- Color pickers with hex input
- Section layout toggles (front/back positioning for bio, contacts, socials, payments)
- Appointment settings (date/time defaults, gated to Pro/Business)
- Team card creation (Business plan)
- vCard import (file upload + phone contact picker)
- QR mode toggle (URL vs vCard)

### 3.4 CardViewerPage (`/card/:slug`)
**Purpose:** Public digital business card with 3D flip
**Auth:** Public
**Components:** Navbar (can be hidden per card), Footer, AuthModal, ShareModal
**Front face:** Background image, profile photo/initials, name, org line, bio, contact links, social pills, payment badges, "Tap to flip" hint
**Back face:** Background image, name, QR code, NownCard logo, contact info (if positioned to back)
**Actions:** Edit Card (owner only), Save to Contacts (vCard download), Show QR/Flip, Share, Send Inquiry (messaging), Save Appointment (if enabled)
**Tracking:** View count increment, time-on-page, tap events (flip, save, share, message), device/referrer
**Meta:** Dynamic OG/Twitter tags per card, custom title

### 3.5 QrPosterPage (`/poster/:slug`)
**Purpose:** Printable 8.5"×11" QR code poster
**Auth:** Public
**Features:** Large QR code, card owner name, org line, print button, download QR as PNG image

### 3.6 RolodexPage (`/rolodex`)
**Purpose:** Public directory of all public cards
**Auth:** Public
**Features:** Search by name/company, industry filter, sort (A-Z, popular, recent)

### 3.7 AnalyticsPage (`/analytics/:id`)
**Purpose:** Per-card view/tap analytics
**Auth:** Required (card owner)
**Features:** View count, save count, hourly activity chart, device/referrer breakdown, date range filter

### 3.8 NfcPage (`/nfc/:slug`)
**Purpose:** Web NFC API tag programming
**Auth:** Required
**Features:** NFC support detection, write URL or vCard payload to physical tag

### 3.9 AdminPage (`/admin`)
**Purpose:** Internal admin panel
**Auth:** Admin only
**Tabs:** Overview (user/card/upgrade counts), Pricing (editable plan prices), Pending (approve/reject upgrades), Upgrades (payment history), Users (search by email, plan assignment), Cards (search by slug, public/private toggle)

### 3.10 Static Pages
**`/terms`** — Terms of Service | **`/privacy`** — Privacy Policy | **`/contact`** — Contact/Support | **`/success`** — Post-payment activation | **`/cancel`** — Payment cancellation | **`*`** — 404 page

---

## 4. Component Inventory

| Component | File | Used By |
|-----------|------|---------|
| Navbar | `src/components/Navbar.tsx` | All pages |
| AuthModal | `src/components/AuthModal.tsx` | Landing, Rolodex, CardViewer |
| Footer | `src/components/Footer.tsx` | All pages |
| DemoCard | `src/components/DemoCard.tsx` | LandingPage |
| CardPreview | `src/components/CardPreview.tsx` | EditorPage (sidebar) |
| LiveCardPreview | `src/components/LiveCardPreview.tsx` | EditorPage (modal preview) |
| ShareModal | `src/components/ShareModal.tsx` | CardViewer, Editor |
| BackgroundPositioner | `src/components/BackgroundPositioner.tsx` | EditorPage |
| CardIcons | `src/components/CardIcons.tsx` | CardViewer, CardPreview, LiveCardPreview, DemoCard |
| ErrorBoundary | `src/components/ErrorBoundary.tsx` | App.tsx |
| PageLoader | `src/components/PageLoader.tsx` | App.tsx (Suspense fallback) |
| SearchInput | `src/components/SearchInput.tsx` | DashboardPage, RolodexPage |

### Hooks
| Hook | File | Purpose |
|------|------|---------|
| useAuth | `src/hooks/useAuth.ts` | Firebase Auth state + user data from Firestore |
| useFCM | `src/hooks/useFCM.ts` | FCM push notification subscription |
| useCardTheme | `src/hooks/useCardTheme.ts` | Computes card face styles from card config |
| useCardFont | `src/hooks/useCardFont.ts` | Dynamically loads Google Fonts + custom fonts |

### Libraries
| Module | File | Purpose |
|--------|------|---------|
| firebase | `src/lib/firebase.ts` | Firebase app init, auth, firestore, storage |
| utils | `src/lib/utils.ts` | Helpers: initials, orgLine, slugify, compressImage, GOOGLE_FONTS, PLAT, PAYMENT_PLAT, etc. |
| vcard | `src/lib/vcard.ts` | vCard 3.0 generation + download |
| vcard-parser | `src/lib/vcard-parser.ts` | .vcf file import |
| payments | `src/lib/payments.ts` | Square checkout integration, pricing config |
| messaging | `src/lib/messaging.ts` | FCM client: getToken, onMessage |
| image-export | `src/lib/image-export.ts` | Card-to-PNG export (html-to-image) |
| demo | `src/lib/demo.ts` | createDemoCard helper |

---

## 5. Key Data Flow

### Auth Flow
```
useAuth() calls onAuthStateChanged
  → If user: fires getDoc(users/{uid})
    → If new: creates user doc with plan='free', isAdmin check
    → If existing: reads plan, cardCount, isAdmin, defaultCardSlug
  → If no user: sets userData=null, loading=false
```

### Card Creation Flow
```
EditorPage
  → User fills fields, uploads media to Firebase Storage
  → Save: setDoc(cards/{id}) with ownerUid, slug, all fields + serverTimestamp
  → Redirect to dashboard
```

### Public Card Flow
```
CardViewerPage
  → query(cards, where('slug','==',slug), where('isPublic','==',true))
  → If found: render 3D flip card with CardIcons, QR, actions
  → If not: show "Card Not Found" with CTA to create a card
```

### Payment Flow
```
Landing/Dashboard → createCheckout() cloud function → Square checkout URL
  → User pays on Square → Square sends webhook → squareWebhook() function
  → Verifies HMAC signature → Matches orderId → Updates user plan → Deletes pending
```

### Message Flow
```
CardViewerPage send inquiry → addDoc(messages/{id}) with senderUid, recipientUid
  → Firestore trigger: notifyOnMessage() → FCM push to recipient
  → Dashboard: onSnapshot(messages, where('recipientUid','==',uid))
```

---

## 6. Current Code State (master, 0a439f4)

### Build Status: ✅ Clean
- `tsc -b`: 0 errors
- `eslint`: 0 errors, 0 warnings
- `npm run build`: passes

### What Works (verified from code audit)
| Feature | Status | Source |
|---------|--------|--------|
| 3D card flip | ✅ | CSS transforms in index.css |
| vCard export | ✅ | `lib/vcard.ts` |
| Square payments | ✅ | Cloud Functions deployed |
| Webhook auto-activation | ✅ | `squareWebhook` function |
| Admin panel | ✅ | 6 tabs in AdminPage |
| Messaging | ✅ | Firestore + FCM |
| QR Poster | ✅ | QrPosterPage |
| Analytics tracking | ✅ | CardViewerPage |
| Image upload + compression | ✅ | EditorPage + `compressImage()` |
| Background positioning | ✅ | BackgroundPositioner |
| Custom fonts | ✅ | useCardFont |
| FCM push notifications | ✅ | useFCM + messaging.ts + SW |
| Appointment booking | ✅ | CardViewerPage modal + .ics gen |
| Rolodex directory | ✅ | RolodexPage |
| NFC programming | ✅ | NfcPage (Web NFC API) |
| SEO + OG meta | ✅ | index.html + CardViewerPage dynamic |
| PWA manifest | ✅ | manifest.json + sw.js |

### Known Gaps (verified against code)
| Gap | Severity | Detail |
|-----|----------|--------|
| Auth is hook-based, not context | 🟡 Medium | Each page has its own `onAuthStateChanged` listener — duplicate Firebase reads |
| Navbar receives auth as props | 🟡 Medium | Pages pass `userEmail`, `isAdmin`, `onSignOut`, `defaultCardSlug` to Navbar |
| 32 empty catch blocks | 🟡 Low | Silent error swallowing |
| Card rendering duplicated | 🟡 Low | Contacts/socials rendered inline in DemoCard, CardViewerPage, LiveCardPreview, CardPreview |
| Hardcoded admin UID in 2 files | 🟢 Low | `useAuth.ts` `ADMIN_UIDS` set + AdminPage bootstrap |
| `FEATURE_CHECKLIST.md` outdated | 🟢 Low | From May 5, doesn't reflect May 18 state |
| `PRODUCTION_STATUS.md` stale | 🟢 Low | Still references OneSignal (replaced by FCM), Node 20 (now 22) |
| No automated tests | 🟢 Low | vitest.config.ts exists but no test script in package.json |
| Missing CSP/HSTS security headers | 🟢 Low | firebase.json headers only set X-Content-Type-Options + X-Frame-Options |
| EditorPage unlabeled inputs (WCAG) | 🟢 Low | ~30 form inputs without aria-labels |

---

## 7. Implementation Plan (Rebuild from Clean Foundation)

### Phase 0: Cleanup (this session)
1. [ ] Drop stash on master (or apply selectively)
2. [ ] Archive stale branches: `feat/editor-completion`, `work-in-progress`, `dev`
3. [ ] Update .gitignore for `.firebase/hosting.*.cache`
4. [ ] Update stale docs (PRODUCTION_STATUS.md, AGENTS.md)

### Phase 1: Auth Consolidation (ctx)
1. [ ] Convert `useAuth.ts` (hook) → `useAuth.tsx` (AuthProvider + context)
2. [ ] Update App.tsx to wrap with `<AuthProvider>`
3. [ ] Update Navbar to read auth from context (drop props)
4. [ ] Update all pages to use new Navbar API
5. [ ] Deploy + smoke test auth flow

### Phase 2: Card Rendering Unification (CardFace)
1. [ ] Create `CardFace.tsx` — shared card content renderer
2. [ ] Update DemoCard, CardPreview, LiveCardPreview to use CardFace
3. [ ] Update CardViewerPage to use CardFace
4. [ ] Ensure back-face content parity (contacts, socials, payments)
5. [ ] Deploy + smoke test all card views

### Phase 3: Page Improvements
1. [ ] EditorPage: tab reorganization + section layout controls
2. [ ] DashboardPage: unmount guard + deleteField fix
3. [ ] LandingPage: CTA button color standardization
4. [ ] CardViewerPage: side-by-side desktop layout + appointment modal
5. [ ] Deploy + smoke test each page

### Phase 4: Visual Polish
1. [ ] Button system consolidation (`.glass-button-*`)
2. [ ] Background animation/starfield
3. [ ] Accent color standardization
4. [ ] Mobile responsive audit
5. [ ] Deploy + visual QA

### Phase 5: Hardening
1. [ ] Add CSP/HSTS headers
2. [ ] Add ARIA labels to editor inputs
3. [ ] Add `console.error` to silent catch blocks
4. [ ] Remove dead exports (audit with tsc)
5. [ ] Add test script to package.json
6. [ ] Final deploy + smoke test

---

## 8. Coding Conventions (from AGENTS.md)
- **Tailwind only** — no inline CSS except for dynamic values
- **TypeScript strict** — no `any` without justification
- **Firebase modular SDK** — v12 tree-shakable imports
- **Toast errors** — use `sonner` for user-facing errors, `console.error` for dev details
- **Legacy field support** — always check both `ownerUid` and `ownerId`
- **No card.id as recipientUid** — messaging MUST use auth UID

---

## 9. Deployment Commands

```bash
# Build
npm run build

# Deploy hosting (both sites)
firebase deploy --only hosting

# Deploy functions
cd functions && npm run build && cd ..
firebase deploy --only functions

# Deploy rules + indexes
firebase deploy --only firestore:rules,firestore:indexes

# Full deploy
firebase deploy
```

---

*Last updated: 2026-07-27 — rebuilt from master `0a439f4` after June 12 rebuild was discarded.*
