# NownCard v2 — Feature Checklist

> ⚠️ **SUPERSEDED.** See **`MASTER_SPEC.md`** for the authoritative feature inventory and implementation plan. This checklist is from 2026-05-05.

---

## Authentication
- [ ] Google sign-in
- [ ] Email sign-up
- [ ] Email sign-in
- [ ] Anonymous sign-in
- [ ] Logout
- [ ] Link Google to anonymous account
- [ ] Auth error messages are user-friendly (not raw Firebase codes)
- [ ] Admin UID `EeiBBDTu5jOooHbxyOC98JSlt6r1` always has `isAdmin: true`
- [ ] Admin shield icon appears in Navbar (desktop + mobile)
- [ ] Admin page accessible at `/admin`

## Navigation (Navbar)
- [ ] Logo links to home
- [ ] Desktop nav: Features, Pricing, Rolodex links
- [ ] Desktop nav: Sign In / My Cards button
- [ ] Desktop nav: Admin shield icon (admin only)
- [ ] Mobile hamburger menu button
- [ ] Mobile drawer slides in from right
- [ ] Mobile drawer: Features, Pricing, Rolodex links
- [ ] Mobile drawer: Admin link (admin only)
- [ ] Mobile drawer: Sign In / My Cards / Sign Out buttons
- [ ] **Favorite/Default card button in header** (need to implement)

## Landing Page (`/`)
- [ ] Hero section with tagline
- [ ] CTA buttons: Create Card, Browse Cards, Learn More
- [ ] Demo card preview
- [ ] Features section (NFC, QR, vCard, Custom Design)
- [ ] Audience tags section
- [ ] Pricing section with Free/Pro/Business cards
- [ ] Pro card marked "Most Popular"
- [ ] Pricing cards route to correct payment provider (Stripe or Square)
- [ ] Support/Tip section
- [ ] Footer with NOWN Digital link
- [ ] Auth modal opens on "Create Card" / "Sign In" when logged out

## Auth Modal
- [ ] Sign In / Sign Up toggle
- [ ] Google sign-in button
- [ ] Email + password form
- [ ] Error message displayed below form
- [ ] "Try without an account" anonymous sign-in
- [ ] Form resets when modal opens

## Dashboard (`/dashboard`)
- [ ] Displays user's cards
- [ ] Plan badge (free/pro/business)
- [ ] Card limit indicator (e.g., "2/5")
- [ ] UID copy button for team sharing
- [ ] Create New Card button
- [ ] Demo card button
- [ ] Upgrade button (free plan only)
- [ ] Manage Billing button (Stripe subscribers)
- [ ] Card actions: View, Copy Link, Public/Private toggle, vCard, NFC, Analytics, Edit, Delete
- [ ] Team Cards section (business plan only)
- [ ] Empty state when no cards

## Editor (`/editor` and `/editor/:id`)
- [ ] Profile tab: Name, job, company, contact info, bio, slug
- [ ] Design tab: Theme, accent color, font, images
- [ ] Links tab: Social links, custom links
- [ ] Live card preview (desktop sticky, mobile modal)
- [ ] Slug auto-generation from name
- [ ] Slug uniqueness validation
- [ ] Save button
- [ ] Share modal
- [ ] Team card creation (`isTeamCard` flag)

## Card Viewer (`/card/:slug`)
- [ ] Displays card with theme/font/accent
- [ ] Profile image or initials avatar
- [ ] Contact buttons (Call, Email, Website)
- [ ] Save Contact (vCard download)
- [ ] Share modal
- [ ] Edit button (owner only)
- [ ] Analytics tracking: view events
- [ ] Analytics tracking: save events
- [ ] Device type tracking
- [ ] Referrer tracking

## NFC Page (`/nfc/:slug`)
- [ ] NFC sharing instructions
- [ ] Card URL display
- [ ] Copy URL button
- [ ] Native share button (if supported)

## Analytics (`/analytics/:id`)
- [ ] Views count
- [ ] Saves count
- [ ] Device breakdown
- [ ] Referrer breakdown
- [ ] Hourly activity chart
- [ ] Recent events list
- [ ] Date range filter (7d, 30d, 90d, all)

## Rolodex (`/rolodex`)
- [ ] Grid of public cards
- [ ] Search filter
- [ ] Card avatar, name, job, company
- [ ] View/save counts
- [ ] Link to card viewer

## Admin (`/admin`)
- [ ] Stats: total users, cards, views, saves
- [ ] Table of all cards
- [ ] Admin-only access (redirect non-admin)

## Payments
- [ ] Square: Pro ($19/yr) checkout
- [ ] Square: Business ($39/yr) checkout
- [ ] Square: Success page applies pending upgrade
- [ ] Square: Cancel page
- [ ] Stripe: Pro checkout session
- [ ] Stripe: Business checkout session
- [ ] Stripe: Success page syncs subscription
- [ ] Stripe: Cancel page
- [ ] Stripe: Customer billing portal
- [ ] Provider switching via `VITE_PAYMENT_PROVIDER`

## Success Page (`/success`)
- [ ] Square: verifies state token, applies pending upgrade
- [ ] Stripe: syncs subscription from Firestore
- [ ] Loading states
- [ ] Error state
- [ ] Sign-in required state
- [ ] Link to dashboard

## Cancel Page (`/cancel`)
- [ ] Friendly cancellation message
- [ ] Link to dashboard
- [ ] Link to pricing

## SEO / Meta
- [ ] Page title
- [ ] Meta description
- [ ] OG tags (title, description, image, url, site_name)
- [ ] Twitter card tags
- [ ] Canonical URL
- [ ] robots.txt
- [ ] sitemap.xml
- [ ] Per-card dynamic OG meta tags

## PWA
- [ ] manifest.json
- [ ] Service worker
- [ ] Apple touch icon
- [ ] Theme color

## Firestore Security
- [ ] Users: self-read, self-write
- [ ] Cards: public read, owner-write, team-owner-write
- [ ] Analytics: owner-read, public-write
- [ ] Pending upgrades: owner-access
- [ ] Stripe subscriptions: read-only by owner

## Firestore Indexes
- [ ] `cards`: `slug` + `ownerUid`
- [ ] `cards`: `slug` + `isPublic`
- [ ] `cards`: `isPublic` + `updatedAt` (desc)

---

## Status of Recently Restored Features
- [x] Provider-agnostic payments (Stripe + Square)
- [x] PricingCard component
- [x] LandingPage uses PricingCard
- [x] SuccessPage provider-agnostic sync
- [x] Dashboard plan sync + billing portal
- [x] AnalyticsPage hourly chart + device/referrer breakdown
- [x] CardViewer analytics tracking

## Missing / Need Clarification
- [ ] **Favorite/Default card button in header** — User mentioned this is missing from navbar. Need details:
  - Is this a button to view YOUR default card?
  - Is this a bookmark/favorite system for OTHER people's cards?
  - What icon/text should it have?
  - Where exactly in the navbar should it appear?
- [ ] **Default card auto-redirect** — Should logged-in users be redirected to their default card?
- [ ] **Dynamic OG meta tags per card** — Verify robots.txt/sitemap.xml/per-card OG tags are working
