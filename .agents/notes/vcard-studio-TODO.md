# Active Todo — NownCard / vcard-studio

## P0 — Main Functionality Verification
- [x] View a public card via `/card/{slug}` — ✅ Fixed (was 20-30s hang, now ~800ms)
- [x] Verify Firestore rules allow correct public read — ✅ publicCards readable by anyone
- [ ] **BLOCKED: Create a card as an authenticated user** — Anonymous auth disabled in Firebase Console
- [ ] **BLOCKED: Access dashboard (`app.html`)** — Redirects to `/` because auth fails
- [x] Card flip interaction on mobile + desktop — ✅ Fixed mobile flip (added button, fixed transform)
- [x] vCard download from public card page — ✅ Works (button visible on back face)
- [x] Share / QR code display — ✅ Works (QR renders, share button works)
- [ ] Upgrade flow (Stripe/Square links)
- [ ] Verify Firebase Auth works (Google + email/password)

## P1 — Test Data & Stability
- [ ] Seed a real test card in Firestore (`test-slug-12345` or similar)
- [ ] Create `robots.txt`
- [ ] Create `sitemap.xml`
- [ ] Add reCAPTCHA + enable App Check (optional, security)

## P2 — Branding & Assets
- [ ] Locate real icon in other Firebase bucket
- [ ] Replace placeholder favicon.svg with real brand asset
- [ ] Evaluate if `nown-card` or `nown-digital` assets should be migrated

## P3 — Domain & Deployment
- [ ] Verify custom domain setup in Firebase Console
- [ ] If domain exists on another project, decide migration plan
- [ ] Map ideal URL structure (e.g., `nowncard.com`, `app.nowncard.com`, etc.)

## P4 — Documentation
- [ ] Keep `WORKSPACE.md` updated per session
- [ ] Keep `NETWORK-MAP.md` updated as projects change
