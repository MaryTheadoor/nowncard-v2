# NownCard v2 — Deployment Audit Log

## Baseline: Commit `a2129fb`
**Status:** Last known working auth. All src/ files reverted to this commit.
**Date:** 2026-05-05

### Known Issues at Baseline
1. `useAuth.ts` does not include `isAdmin` in `userData` when reading existing users (line 30)
2. `Navbar.tsx` does not accept/pass `isAdmin` prop
3. `Navbar.tsx` does not render admin link

### Changes Applied on Top of Baseline

#### 1. Fix: Admin flag in useAuth.ts
**File:** `src/hooks/useAuth.ts`
**Change:** Added `isAdmin: data.isAdmin || false` to `setUserData()` when reading existing user doc.
**Rationale:** Admin users were not being recognized because `userData` only returned `{ plan, cardCount }`.
**Auth risk:** None — this is a read-only change to the data object returned by the hook.

#### 2. Fix: Admin support in Navbar
**File:** `src/components/Navbar.tsx`
**Change:** Added `isAdmin?: boolean` prop. Desktop nav shows shield icon linking to `/admin`. Mobile drawer shows "Admin" link.
**Rationale:** Admin page existed but was unreachable from UI.
**Auth risk:** None — pure UI change, no auth logic modified.

#### 3. Fix: User-friendly auth error messages
**File:** `src/hooks/useAuth.ts`
**Change:** `handleError()` now maps Firebase error codes to readable messages. Error state cleared on auth state change.
**Rationale:** Raw Firebase error messages confuse users.
**Auth risk:** None — error formatting only.

#### 4. Config: Firestore rules updated
**File:** `firestore.rules`
**Change:** Added `isOwner()` and `isTeamOwner()` helper functions supporting both `ownerId`/`ownerUid` and `teamOwnerId`/`teamOwnerUid`. Added Stripe Extension paths.
**Rationale:** Support both legacy and new field names. Allow Stripe Extension to write subscription data.
**Auth risk:** None — rules don't affect Firebase Auth.

#### 5. Config: Firestore indexes
**File:** `firestore.indexes.json` (new)
**Change:** Composite indexes for `slug+ownerUid`, `slug+isPublic`, `isPublic+updatedAt`.
**Rationale:** Required for Rolodex queries and slug lookups.
**Auth risk:** None.

#### 6. Config: SEO meta tags
**File:** `index.html`
**Change:** Added `og:url`, `og:site_name`, `canonical` link. Updated `og:image` to `nowncard-v2.web.app`.
**Rationale:** SEO best practices.
**Auth risk:** None.

#### 7. Config: Package dependencies
**File:** `package.json`
**Change:** Added `stripe` (dev), `square` (prod), `dotenv` (dev).
**Rationale:** Payment provider SDKs.
**Auth risk:** None — dependencies don't affect Firebase Auth.

#### 8. New file: Stripe payments module
**File:** `src/lib/stripe-payments.ts` (new, untracked)
**Change:** Stripe checkout session creation, plan sync, portal session creation via Firebase Extension.
**Rationale:** Stripe payment integration.
**Auth risk:** LOW — imports `firebase/firestore` but does not touch auth. Not imported by auth-related files.

#### 9. New file: PricingCard component
**File:** `src/components/PricingCard.tsx` (new, untracked)
**Change:** Reusable pricing card with Stripe/Square checkout.
**Rationale:** Cleaner pricing UI.
**Auth risk:** LOW — dynamically imports `firebase/auth` for currentUser. Not loaded unless PricingCard renders.

---

## Testing Checklist

### Auth (MUST PASS before any feature additions)
- [ ] Google sign-in works
- [ ] Email sign-up works
- [ ] Email sign-in works
- [ ] Anonymous sign-in works
- [ ] Logout works
- [ ] Admin flag shows for admin user
- [ ] No `auth/internal-error`

### Features
- [ ] Landing page loads
- [ ] Pricing section renders
- [ ] Dashboard loads cards
- [ ] Editor loads
- [ ] Card viewer loads
- [ ] NFC page loads
- [ ] Analytics page loads
- [ ] Rolodex loads public cards
- [ ] Admin page loads (admin only)

---

## Changes Applied in This Session

### Batch 1: Auth Fixes + Admin Hardcode
- `useAuth.ts`: Hardcoded admin UID `EeiBBDTu5jOooHbxyOC98JSlt6r1`, user-friendly errors, clear error on auth state change
- `Navbar.tsx`: Restored hamburger menu, added admin shield icon + mobile admin link
- `LandingPage.tsx` + `DashboardPage.tsx`: Pass `isAdmin` prop to Navbar

### Batch 2: UI Feature Restoration
- `src/types/index.ts`: Added `AnalyticsEvent`, expanded `Card` interface with `theme`, `font`, `layout`, `socials`, `customLinks`, `ownerId`, `teamOwnerId`, `plan`
- `src/lib/utils.ts`: Added `getDeviceType()`, `getReferrerSource()`, `generateSlug()`
- `src/lib/payments.ts`: Provider-agnostic (Stripe vs Square), `startCheckout()`, `syncUserPlan()`, `getUserPlan()`, `createPortalSession()` export
- `src/lib/stripe-payments.ts`: Stripe checkout sessions, plan sync, billing portal (unchanged from before)
- `src/components/PricingCard.tsx`: Reusable pricing card with Stripe/Square checkout
- `src/pages/LandingPage.tsx`: Uses PricingCard components, added Security section
- `src/pages/SuccessPage.tsx`: Provider-agnostic plan sync via `syncUserPlan()`
- `src/pages/DashboardPage.tsx`: Plan sync on load, "Manage Billing" button for Stripe subscribers
- `src/pages/AnalyticsPage.tsx`: Hourly activity chart, device/referrer breakdowns, date range filter, KPI cards
- `src/pages/CardViewerPage.tsx`: Analytics tracking (view/save events with device + referrer)

---

## Pending / Need Clarification
- [ ] **Favorite/Default card button in header** — User mentioned this is missing from navbar. Need details on expected behavior.
- [ ] **Editor design options** — themes, fonts, layouts (some code exists at a2129fb but may need updates)
- [ ] **Dynamic OG meta tags per card** — exists at a2129fb via robots.txt/sitemap, verify working
