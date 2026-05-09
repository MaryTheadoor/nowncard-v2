# NownCard v2 — Development Log

> Chronological record of all significant changes, fixes, and deployments.

---

## 2026-05-06 — Messaging Fix, Simplification, Documentation

### Problems Reported
1. Dashboard showing "Failed to load messages" error
2. Background image only on front face of live card (preview had both sides)
3. Messaging implementation too complex (anti-spam queries requiring composite indexes)
4. "Cannot send message — card owner not found" on legacy cards

### Changes Made

**Dashboard messaging simplified**
- Removed `orderBy('createdAt', 'desc')` from messages query
- Sort messages client-side after snapshot arrives
- Eliminates composite index dependency — works immediately on fresh deploys
- File: `src/pages/DashboardPage.tsx`

**CardViewerPage back face background image**
- Added `backgroundImage` + overlay divs to back face, matching front face and LiveCardPreview
- File: `src/pages/CardViewerPage.tsx`

**Anti-spam removed**
- Removed the 5-minute anti-spam `getDocs` query from send flow
- It required a composite index `(senderUid, recipientUid, createdAt DESC)` that was causing send failures
- Firestore rules already require `senderUid == request.auth.uid` for basic protection
- File: `src/pages/CardViewerPage.tsx`

**Legacy card owner UID fix**
- `CardViewerPage` now falls back to `ownerId` if `ownerUid` is missing
- `EditorPage` now writes `ownerUid: user.uid` on EVERY save (both create and update paths)
- Previously, updating an existing card stripped `ownerUid` from the update data
- Files: `src/pages/CardViewerPage.tsx`, `src/pages/EditorPage.tsx`

**Documentation created**
- `AGENTS.md` — comprehensive agent onboarding guide
- `README.md` — replaced Vite template with real project README
- `DEVELOPMENT_LOG.md` — this file
- `PRODUCTION_STATUS.md` — live status tracking

### Deployed
- Hosting deploy to `nowncard-v2` and `vcard-studio-314` sites

---

## 2026-05-05 — Build Stabilization, UI Polish, Deployment

### Changes Made
- Fixed 22 ESLint errors across 7 files
- Fixed 3 TypeScript build errors
- Committed all uncommitted WIP as commit `8040cf1`
- Verified live deployment at `nowncard.com`
- Created `.agents/notes/WORKSPACE.md`

---

## Prior Sessions (Pre-2026-05-05)

Key milestones from git history:

| Commit | Description |
|--------|-------------|
| `7be9ba3` | Initial scaffold: React 19, Vite, Tailwind v4, Firebase v12 |
| `e651d30` | Square payment flow: success/cancel pages, pending upgrades |
| `ea2ddd9` | Route fix: `/card/:slug` for public cards |
| `cb9d68a` | Admin page, demo card helper, dashboard polish |
| `75138ed` | UI debug fixes: admin query, z-index, auth modal, shadows |
| `cd015af` | Editor slug uniqueness check (global on edit) |
| `6997bce` | HTML title encoding fix |
| `8040cf1` | Analytics, NFC, Rolodex, ShareModal, PWA, team cards, theming, fonts |
| `783f1cc` | Rename `ownerId` → `ownerUid` to match PRD schema |
| `ca68a03` | Live CardPreview component, split-screen editor layout |
| `32c5582` | CardViewer tap-to-flip, back face translateZ, social pills, mobile sticky bar |
| `1325197` | Editor slug auto-generation, live availability check (400ms debounce) |
| `f0b637b` | Client-side image compression (800px max, 85% quality, 5MB limit) |
| `3a4b294` | robots.txt, sitemap.xml, per-card dynamic Open Graph meta tags |
| `a2129fb` | Dashboard queries both `ownerUid` and `ownerId` for backward compat |
| `e89d6f5` | Consolidate pre-beta changes |
| `b1ad4ef` | Consolidate docs, agent notes, and assets |
| `9f3cc9b` | Fix lint: setState-in-effect and fast-refresh errors |
| `f6cdd00` | Landing page: interactive demo card, reordered features |
| `e2198ae` | Rolodex: rebuild directory as searchable contacts database |
| `0732f25` | Dashboard + editor: search, auto-populate, interactive preview, hidden dates |
| `3a1ccef` | CardViewer uses pageBgColor, og:url points to nowncard.com |

---

## Known Regression Risks

1. **Legacy `ownerId` cards** — Any card created before the `ownerUid` field was added will have `ownerId` instead. Code must check both fields. Editor now ensures `ownerUid` is written on every save.
2. **publicCards collection** — May be stale/out of sync. CardViewer falls back to it if `cards` collection lookup fails. No active mirroring logic exists.
3. **OneSignal** — Placeholder app ID means push notifications are non-functional until real credentials are provided.
