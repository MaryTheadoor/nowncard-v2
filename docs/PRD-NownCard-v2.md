# NownCard v2 — Product Requirements Document

## 1. Philosophy

NownCard is a digital business card platform for service professionals. The core experience must feel **tangible** — like holding a real card, not browsing a website. Every UI element should feel like a physical object: cards have thickness, shadows, texture. The aesthetic is **craft paper** — warm, textured, substantial. Nothing flashy. Nothing breaks.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React 19 + TypeScript | Proven, type-safe, component reusability |
| Build Tool | Vite 6 | Fast HMR, clean output, simple config |
| Styling | Tailwind CSS 3.4 | Utility-first, no CSS conflicts, rapid iteration |
| UI Components | shadcn/ui | Accessible, composable, Tailwind-native |
| Backend | Firebase v12 (modular SDK) | Auth, Firestore, Storage, Hosting — already configured |
| Payments | Square checkout links (v1 parity) | Working today, migrate to Stripe in Phase 2 |
| Testing | Playwright | End-to-end coverage from day one |

**What we do NOT use:**
- No CSS-in-JS (emotion/styled-components) — Tailwind only
- No complex state management — React Context + hooks sufficient
- No heavy animation libraries — CSS transforms only
- No custom build tools — Vite out of the box

---

## 3. Pages & Routes

### Public Pages (no auth required)
| Route | Purpose |
|-------|---------|
| `/` | Landing page — hero, features, pricing, CTA |
| `/card/:slug` | Public card viewer — the physical flip card |
| `/success` | Post-payment success page |
| `/cancel` | Payment cancellation page |

### Authenticated Pages
| Route | Purpose |
|-------|---------|
| `/dashboard` | Card list — create, edit, delete, view analytics |
| `/editor` | Card editor — create new card |
| `/editor/:id` | Card editor — edit existing card |
| `/admin` | Admin panel — user management, plan upgrades |

### Redirects
- Unauthenticated user hitting `/dashboard`, `/editor`, `/admin` → redirect to `/` with auth modal open
- Authenticated user hitting `/` with `?action=create` → redirect to `/editor`

---

## 4. Data Model

### `cards/{cardId}`
```typescript
interface Card {
  id: string;
  ownerUid: string;
  prefix?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  nickname?: string;
  jobTitle?: string;
  department?: string;
  company?: string;
  phones: { type: string; number: string }[];
  emails: { type: string; address: string }[];
  addresses: { type: string; street?: string; city?: string; region?: string; postal?: string; country?: string }[];
  website?: string;
  bio?: string;
  birthday?: string; // YYYY-MM-DD
  socialLinks: { platform: string; url: string }[];
  profileImage?: string; // Firebase Storage URL
  backgroundImage?: string; // Firebase Storage URL
  slug: string; // URL-friendly, unique
  accentColor: string; // hex, default #C9A278
  theme: 'cosmic' | 'light' | 'warm' | 'minimal'; // color theme for card background
  isPublic: boolean;
  viewCount: number;
  saveCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### `users/{uid}`
```typescript
interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  plan: 'free' | 'pro' | 'business';
  planUpdatedAt: Timestamp;
  isAdmin: boolean;
  createdAt: Timestamp;
}
```

### `publicCards/{slug}` (denormalized cache)
Mirror of public cards for fast slug-based lookups. Synced on create/update/delete.

### `analytics/{cardId}`
```typescript
interface Analytics {
  taps: Record<string, number>; // call, email, website, map, save, share, social:platform
  updatedAt: Timestamp;
}
```

### `pendingUpgrades/{id}`
Square payment tracking (v1 parity).

---

## 5. Authentication

**Methods:**
1. Email / Password (sign up + sign in)
2. Google OAuth (popup)
3. Anonymous (for trying the editor before committing)

**Flow:**
- Auth modal on landing page (not a separate page — reduces friction)
- Auth state persisted across sessions
- On sign-up, create `users/{uid}` doc with `plan: 'free'`
- On anonymous sign-in, same treatment. Upgrading to permanent account links cards.

---

## 6. The Card Editor (/editor)

### Layout
Split screen on desktop (>1024px):
- **Left (60%)**: Form fields in scrollable sections
- **Right (40%)**: Sticky live preview of the physical card

Single column on mobile — preview shown as a collapsible panel.

### Form Sections

**1. Name**
- Prefix, First Name, Middle Name, Last Name, Suffix (row of 2–3 fields)
- Nickname (optional)

**2. Work**
- Job Title, Department, Company (row of 2–3 fields)

**3. Contact**
- Phone numbers: array with type dropdown (cell, work, home, fax) + number input. Add/remove rows.
- Emails: array with type dropdown (work, home, personal) + address input. Add/remove rows.
- Website: single URL input
- Addresses: array with structured fields (street, city, region, postal, country). Add/remove rows.

**4. About**
- Bio: textarea, 4 rows
- Birthday: date picker

**5. Photos**
- Profile photo: drag-and-drop upload area with preview. Square crop recommended.
- Background image: drag-and-drop upload area with preview.
- Max 2MB each. Client-side compression to 800px width before upload.

**6. Card URL**
- Slug input with live availability check (debounced 400ms)
- Preview: `nowncard.com/card/{slug}`
- Auto-generate from first+last name if empty
- Validation: lowercase, alphanumeric + hyphens only, min 3 chars

**7. Appearance**
- Color theme: Cosmic Navy, Clean Light, Warm Earth, Minimal
- Accent color: color picker (6 presets + custom hex)

**8. Settings**
- Public toggle switch

### Actions (below form)
- **Save Card** (primary)
- **Copy Link** (copies public URL)
- **View Card** (opens `/card/{slug}` in new tab)
- **Cancel** (returns to dashboard)

### Live Preview
- Renders the exact physical card that visitors will see
- Updates in real-time on every input change
- Uses selected theme and accent color
- Shows placeholder initials if no photo

---

## 7. The Dashboard (/dashboard)

### Header
- Page title: "My Cards"
- "+ New Card" button → `/editor`
- Plan badge (Free / Pro / Business)
- Upgrade button (if Free)

### Card Grid
Each card is a tile showing:
- Avatar or initials
- Full name
- Job title + company
- Slug (`/card/{slug}`)
- Public/private chip
- View count
- Action buttons: Edit, View, Copy Link, Delete (with confirmation)

### Empty State
- Icon + "No cards yet" + "Create your first card" CTA

### Admin Section (sidebar or modal, visible only if `isAdmin`)
- Pending upgrades table
- User search + plan management

---

## 8. The Public Card (/card/:slug)

This is the **most important page**. It must feel perfect.

### Visual Design
- Full-page dark background (`#0a0e1a`)
- Card centered on screen
- Card aspect ratio: 2 : 3.5 (business card proportions)
- Card width: 380px max, 92vw on mobile
- Card material: warm off-white (`#f4f1ec`) with subtle paper texture
- Card shadow: multi-layer drop shadow for depth
- Rounded corners: 20px

### Front Face
- Background image (if set) at 30% opacity with gradient overlay
- Profile photo: circular, 72px, subtle border shadow
- Name: large bold sans-serif, dark charcoal
- Organization: job title · department · company
- Bio: small, muted
- Divider: subtle horizontal rule
- Contact rows: icon + text, each tappable
  - Phone → `tel:`
  - Email → `mailto:`
  - Website → external link
  - Address → Google Maps
- Social pills: lowercase rounded buttons with platform name
- Hint text: "Tap to flip · QR on back"

### Back Face
- Same card material
- NownCard logo (small, top)
- Name
- "Scan to save" subtitle
- QR code (white background, 150px)
- Save button + Share button
- Hint text: "Tap to flip back"

### Flip Animation
- 3D CSS transform with `perspective: 1200px`
- Duration: 0.8s
- Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` (slight overshoot for physical feel)
- `backface-visibility: hidden`
- Trigger: tap/click anywhere on card

### Mobile Sticky Bar
- Fixed bottom bar with "Save to contacts" button
- Light background, dark text, high contrast
- Hidden on desktop (≥768px)

### Footer
- "Built with NownCard" link back to home

### Meta
- `<title>`: "{Full Name} — NownCard"
- Open Graph tags for sharing
- Favicon: real logo

---

## 9. The Landing Page (/)

### Sections (top to bottom)

**1. Header**
- Logo + brand name (left)
- Nav: Features, Pricing, Dashboard (right)
- Auth button: "Sign In" or user avatar if authenticated
- Mobile: hamburger menu

**2. Hero**
- Badge: "Your card. Your brand. Anywhere."
- Headline: "Digital Business Cards That Work Everywhere"
- Subhead: "Create a beautiful digital card in seconds. Share via NFC, QR code, link, or vCard. No app required for recipients."
- CTA: "Create Your Card" (primary) + "Learn More" (scrolls to features)
- Demo card preview (static, animated subtly)

**3. Features**
- 4 feature cards in a grid:
  - NFC Ready
  - QR Code
  - vCard Export
  - Custom Design

**4. Audience**
- Tag cloud of target professions

**5. Pricing**
- 3 tiers: Free ($0), Pro ($19 one-time), Business ($49 one-time)
- "Most Popular" badge on Pro
- Feature checklist per tier
- CTA buttons

**6. Footer**
- Copyright

### Auth Modal
- Overlay modal (not a separate page)
- Google Sign-In button
- Email/password form
- Toggle between Sign In / Sign Up
- Error states inline

---

## 10. Payments & Plans

### Tiers
| Tier | Price | Cards | Social | Themes | Notes |
|------|-------|-------|--------|--------|-------|
| Free | $0 | 1 | 3 | Cosmic only | Footer branding |
| Pro | $19 | 5 | Unlimited | All + custom accent | No branding |
| Business | $49 | 25 | Unlimited | All + team dashboard | Team management |

### Payment Flow (v1 parity)
1. User clicks "Upgrade"
2. Create `pendingUpgrades` doc
3. Redirect to Square payment link
4. Return to `/success` or `/cancel`
5. Success page calls `applyPendingUpgrade()` and shows confirmation

**Future (Phase 2):** Replace with Stripe Checkout + webhook automation.

---

## 11. Styling Principles

### Color System
```
--space: #0a0e1a        (page background)
--tile: #171f33          (elevated surfaces)
--ink: #f8f9fc           (primary text)
--ink-muted: #94a3b8     (secondary text)
--ink-faint: #64748b     (tertiary text)
--line: #243044          (borders)
--accent: #c9a278        (gold/tan)
--accent-hover: #d4b08a
--success: #5eead4
--danger: #f87171
```

### Card-Specific Colors
```
card-bg: #f4f1ec        (warm off-white)
card-text: #2a2520       (warm charcoal)
card-muted: #6b6256      (warm gray)
card-faint: #9a9186      (light warm gray)
```

### Typography
- Font: Manrope (Google Fonts) — weights 400, 500, 600, 700, 800
- Headings: tight letter-spacing (-0.03em), bold
- Body: comfortable line-height (1.6)
- Card text: slightly tighter (1.4)

### Spacing
- Base unit: 4px
- Sections: 24px–32px gaps
- Card padding: 28px
- Border radius: 12px (buttons), 20px (cards), 999px (pills)

### Shadows
```css
/* Elevated surface */
box-shadow: 0 8px 32px rgba(0,0,0,0.35);

/* Card physical depth */
box-shadow: 
  0 1px 0 rgba(255,255,255,0.15) inset,
  0 24px 60px rgba(0,0,0,0.5),
  0 4px 12px rgba(0,0,0,0.3);
```

### Animations
- All transitions: `0.2s ease` unless specified
- Card flip: `0.8s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Button active: `transform: scale(0.97)`
- Hover lifts: `transform: translateY(-2px)`

---

## 12. File Structure (New Repo)

```
owncard-v2/
├── public/
│   ├── nowncard-logo.png
│   ├── icon-192.svg
│   ├── icon-512.svg
│   ├── manifest.json
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                 # Tailwind directives + CSS variables
│   ├── lib/
│   │   ├── firebase.ts           # Firebase app init, auth, db, storage
│   │   ├── utils.ts              # helpers (esc, slugify, etc.)
│   │   └── vcard.ts              # vCard 3.0 generation
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (auto-installed)
│   │   ├── Navbar.tsx
│   │   ├── AuthModal.tsx
│   │   ├── ToastProvider.tsx
│   │   └── ...
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── CardViewerPage.tsx    # The public flip card
│   │   ├── DashboardPage.tsx
│   │   ├── EditorPage.tsx
│   │   ├── AdminPage.tsx
│   │   ├── SuccessPage.tsx
│   │   └── CancelPage.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCard.ts
│   │   ├── useCards.ts
│   │   └── useAnalytics.ts
│   └── types/
│       └── index.ts              # All TypeScript interfaces
├── tests/
│   └── e2e/
│       ├── smoke.spec.ts
│       └── card.spec.ts
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── README.md
```

---

## 13. Testing Strategy

From day one, every critical path has a Playwright test:

1. **Landing page loads** — no JS errors
2. **Auth flow** — sign up, sign in, sign out
3. **Card creation** — fill editor, save, verify in dashboard
4. **Public card** — load by slug, verify all fields render
5. **Card flip** — click triggers rotation, back face visible
6. **vCard download** — button triggers file download
7. **Payment flow** — upgrade button creates pending doc, redirects
8. **Mobile responsive** — screenshot comparison at 390×844

---

## 14. Deployment

1. Build: `npm run build` → outputs to `dist/`
2. Deploy: `firebase deploy --only hosting`
3. Custom domain: `nowncard.com` (already configured)
4. Firestore rules deployed separately

---

## 15. Migration from v1

**Zero-downtime, zero URL breakage:**

1. Build v2 in parallel repo
2. Point `nowncard.com` DNS to new Firebase Hosting site (or same project, different hosting site)
3. Copy Firestore data forward (cards, users already in same Firebase project)
4. Archive v1 repo but keep deployed as fallback
5. Switch domain to v2

Existing card URLs (`/card/{slug}`) use the same Firestore data — they work immediately.

---

## 16. Open Questions

1. **Anonymous auth** — should it be enabled for beta? (Recommended: yes, for conversion)
2. **Pro pricing** — one-time or annual? (Current: one-time via Square)
3. **Custom domains** — Phase 2 feature, or MVP?
4. **NFC physical cards** — integration with a print vendor, or manual?
5. **Team invites** — email link or manual admin assignment?
