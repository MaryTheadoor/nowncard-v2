# NownCard Comprehensive Feature Set

Compiled from all three codebases: `vcard-studio-314`, `nown-card`, `nowncardpro`.

---

## Core Data Model

### Name
- [x] First Name
- [x] Middle Name
- [x] Last Name
- [ ] Prefix (Dr., Mr., Ms., etc.) — *missing in editor*
- [ ] Suffix (Jr., III, etc.) — *missing in editor*
- [ ] Nickname — *missing in editor*

### Work
- [x] Job Title
- [x] Company
- [ ] Department — *missing*
- [ ] Role — *missing*

### Contact
- [x] Primary Phone
- [x] Multiple extra phones with type labels
- [x] Primary Email
- [x] Multiple extra emails with type labels
- [x] Website
- [x] Address (single textarea) — *should upgrade to structured fields*
- [ ] Structured Address (street, city, region, postal, country) — *missing*
- [ ] Birthday — *missing*
- [ ] Anniversary — *missing*

### About
- [x] Bio / Tagline

### Photos
- [x] Profile Photo upload
- [x] Background Image upload
- [ ] Client-side image compression — *missing*

### Social & Links
- [x] Fixed social links (LinkedIn, Twitter, GitHub, Instagram)
- [x] Unlimited custom links with labels
- [ ] Social links as array with platform dropdown (12+ platforms) — *missing*

### Appearance
- [x] Theme selector (Cosmic, Light, Warm, Minimal)
- [x] Accent Color picker
- [ ] Card theme selector (Material vs Physical) — *new*

### Settings
- [x] Custom slug
- [x] Public/Private toggle
- [ ] Slug availability check — *missing*

---

## Editor / Dashboard

- [x] Live preview
- [x] Create / Edit / Delete cards
- [x] Image upload to Firebase Storage
- [ ] Copy public link — *missing*
- [ ] View public card in new tab — *missing*
- [ ] Card list / dashboard view — *partial (basic grid)*
- [ ] Plan-based creation limits enforced — *partial*

---

## Public Card Page

- [x] Material theme (tile-based, modern)
- [x] Physical theme (skeuomorphic 2×3.5 flip card)
- [x] Background image support
- [x] vCard export
- [x] QR code
- [x] Native Share API + clipboard fallback
- [ ] Analytics tracking (views, taps) — *missing*
- [ ] Tap-to-call, tap-to-email, tap-to-map — *partial*

---

## Themes

- [x] Cosmic Navy (dark)
- [x] Clean Light
- [x] Warm Earth
- [x] Minimal
- [x] Physical / Skeuomorphic card

---

## Auth

- [x] Email/Password
- [x] Google Sign-In
- [x] Anonymous auth
- [x] Auth state persistence
- [x] Protected routes
- [x] Admin gate

---

## Sharing

- [x] Public URL (`/card/{slug}`)
- [x] QR Code
- [x] vCard (.vcf)
- [x] Native Share API
- [x] Clipboard copy
- [ ] NFC-ready marketing — *claimed but not implemented*

---

## Pricing & Payments

- [x] Free / Pro / Business tiers
- [x] Square payment links
- [x] Pending upgrade system
- [x] Success/cancel pages
- [ ] Stripe checkout — *only in nowncardpro*
- [ ] Annual billing — *only in nowncardpro*
- [ ] Customer portal — *only in nowncardpro*
- [ ] Idempotent plan application — *only in nowncardpro*

---

## Analytics

- [x] publicViews subcollection (timestamp + userAgent)
- [ ] View count increment — *missing*
- [ ] Tap tracking (call, email, website, map, social, save, share) — *missing*
- [ ] Analytics dashboard — *missing*

---

## Admin

- [x] Pending upgrades list
- [x] User search
- [x] Plan assignment

---

## PWA

- [x] manifest.json
- [x] Service worker (kill switch only) — *needs caching strategy*
- [ ] Offline support — *missing*
- [ ] Install prompts — *missing*

---

## High-Priority Gaps to Fill

1. **Editor fields**: Prefix, Suffix, Nickname, Birthday, Department
2. **Structured address** in editor (street, city, region, postal, country)
3. **Image compression** before upload
4. **Copy link** button in editor
5. **Analytics** (view count + tap tracking)
6. **Social links array format** in editor with platform dropdown
7. **Card theme selector** in editor (Material vs Physical)
8. **PWA service worker** with actual caching
