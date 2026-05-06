# NownCard Architecture Roadmap

## Current State (Beta — v1)
**Stack:** Static HTML/JS, Firebase Hosting, Firestore, Firebase Auth, Firebase Storage, Square payment links

### What works today
- Landing page with pricing tiers
- Firebase Auth (email/password, Google, anonymous)
- Card editor with live preview
- Profile/background photo upload to Firebase Storage
- Public card page — skeuomorphic physical card with 3D flip, QR on back, vCard export
- Firestore data model: `cards`, `publicCards`, `users`, `pendingUpgrades`, `upgrades`, `analytics`
- Square payment links for Pro ($19) and Business ($49)
- Admin panel for manual plan approval
- Analytics: view count + tap tracking
- Responsive design (mobile + desktop)

### Known limitations of current stack
- No build step — everything is hand-written HTML/CSS/JS
- No component reuse — shared UI duplicated across pages
- CSS is brittle — global styles can conflict
- No TypeScript — runtime errors possible
- No hot reload in dev — Python static server only
- Image uploads are uncompressed — wastes Storage bandwidth
- Social links use fixed object keys — not extensible to 12+ platforms
- Payments are manual Square links — no webhook automation

---

## Phase 2: Production Foundation (MVP+ — 2–4 weeks)
**Goal:** Solidify the codebase for growth without losing existing data or URLs.

### 2a. Dev Environment Upgrade
- **Vite** as build tool (fast HMR, tree-shaking, asset optimization)
- **Vanilla JS + JSDoc** OR **TypeScript** (recommend TS for long-term maintenance)
- Component-based architecture using **web components** or **Lit** (lightweight, no framework lock-in)
- **Tailwind CSS** for styling (utility-first, prevents CSS conflicts)
- Shared component library: Button, Input, CardPreview, Modal, Toast

### 2b. Data Model Hardening
- Migrate `socialLinks` from fixed object to **array format** `[{platform, url}]`
- Add `addresses` array with structured fields (street, city, region, postal, country)
- Backward-compat layer in card reader to support old format indefinitely
- Add `createdAt`, `updatedAt` server timestamps to all collections

### 2c. Image Pipeline
- Client-side image compression before upload (browser-image-compression or canvas resize)
- Generate multiple sizes (thumbnail, full) on upload
- WebP conversion for bandwidth savings

### 2d. Card Page Polish
- Open Graph meta tags per card (`og:image`, `og:title`, `og:description`)
- Better 404 state with CTA to create a card
- Print stylesheet so the card prints like a real business card
- PWA: proper service worker with cache-first strategy for offline card viewing

### 2e. Auth & Onboarding
- Magic link auth (passwordless email sign-in)
- Onboarding flow for first-time users
- Password reset

---

## Phase 3: Monetization Automation (1–2 weeks)
**Goal:** Replace manual Square approvals with automated payments.

### 3a. Payment Integration
- **Stripe Checkout** for Pro/Business upgrades (already built in `nowncardpro`)
- Stripe Customer Portal for cancellations and plan changes
- Webhook endpoint (Firebase Cloud Function or FastAPI backend) to auto-apply plans
- Annual billing with renewal reminders

### 3b. Plan Enforcement
- Server-side plan limits (Firebase Cloud Function or Firestore rules function)
- Social link limits enforced in editor UI
- Theme/brand removal for paid tiers

### 3c. One-Time Add-ons
- Extra card pack ($5)
- Custom domain ($10/year)
- NFC card physical order integration

---

## Phase 4: Growth Features (2–4 weeks)
**Goal:** Features that drive user acquisition and retention.

### 4a. Analytics Dashboard
- Card-level: views, saves, shares, taps by type
- Aggregate: total views across all cards, top performing card
- Time-series charts (daily/weekly/monthly)
- Export to CSV

### 4b. Team / Business Tier
- Team invites via email
- Shared team dashboard
- Admin controls (who can edit which cards)
- Team analytics

### 4c. Lead Capture
- Optional "Contact Me" form tile on public card
- Leads stored in Firestore subcollection
- Email notifications to card owner
- Export leads to CSV

### 4d. SEO & Sharing
- Custom Open Graph images per card (server-side rendering or Cloud Function)
- Short URLs (`nowncard.com/{slug}`)
- QR codes with branding/color
- NFC tag programming instructions

---

## Phase 5: Scale & Platform (1–3 months)
**Goal:** Enterprise-ready infrastructure.

### 5a. Backend API
- FastAPI or Cloud Functions for business logic
- REST API for card CRUD, analytics, webhooks
- Rate limiting and API keys for Business tier
- Idempotent operations for payment handling

### 5b. White-Label / Agency
- Custom domains with SSL (Firebase Hosting multi-site or Cloudflare)
- Remove "Built with NownCard" branding
- Custom CSS injection
- Agency dashboard for managing client cards

### 5c. Infrastructure
- CDN for card images (Cloudflare or Firebase CDN)
- Database indexing for analytics queries
- Automated backups (Firestore export to Cloud Storage)
- Monitoring and alerting (Firebase Performance, Sentry)

### 5d. Mobile App
- Capacitor or React Native wrapper around the web app
- Native share sheet integration
- Push notifications for lead capture
- Offline card editing

---

## Migration Path

The key constraint: **existing card URLs must never break.**

```
v1 (now)        →  v2 (Vite build)    →  v3 (Stripe auto)   →  v4 (teams)      →  v5 (platform)
static HTML     →  compiled SPA        →  + backend API       →  + team features  →  + white-label
Square manual   →  Stripe auto         →  add-ons            →  enterprise       →  agency
Firestore only  →  Firestore + Cache   →  + analytics        →  + leads          →  + API access
```

Each phase is deployable independently. No big-bang rewrite. Data migrates forward with backward-compat readers.

---

## Recommended Next Step (This Week)

If you want to start onboarding beta users today, the current v1 is **good enough**. The critical path for beta success is:

1. ✅ Payments work (Square links)
2. ✅ Cards save and load (Firestore)
3. ✅ Auth works (Firebase)
4. ✅ Public card looks professional (deployed)
5. **TODO:** Enable anonymous auth in Firebase Console so unauthenticated users can test the editor
6. **TODO:** Create 3–5 example cards for your own brand to show prospects
7. **TODO:** Set up a simple waitlist or email capture on the landing page

Then start collecting feedback from beta users. Their input will tell you whether Phase 2 should prioritize the analytics dashboard, team features, or mobile app.
