# Active Todo — NownCard / vcard-studio

> Last updated: 2026-08-06. Source of truth for current state is `.agents/notes/WORKSPACE.md` and `MASTER_SPEC.md`.

---

## 🔴 Verify (blocking release confidence)

- [ ] **Live checkout E2E** — complete a real Pro/Business purchase end-to-end (create checkout → pay → webhook applies → SuccessPage resolves) after the 2026-08-05 security rework. Webhook path verified (HTTP 200 signed test); full purchase not yet exercised.
- [ ] **FCM end-to-end** — send a real inquiry and confirm push notification delivery to a subscribed device.

## 🟡 Backlog / Low Priority

- [ ] **Automated tests** — add a unit/e2e suite (none exist).
- [ ] **App Check** — enable (requires reCAPTCHA) as optional hardening.
- [ ] **Per-label link analytics** — `taps.link` is now aggregated (was `link:<label>`) due to rule `hasOnly`; restore granularity via server-side tracking if desired.
- [ ] **Stale sibling projects** — `nown-card`, `nown-card-kv5yi`, `nown-digital` (see NETWORK-MAP). Confirm no asset migration needed.

## ✅ Resolved (historical — do not re-open without reason)

- [x] Payments live (Square) — dynamic checkout, HMAC webhook, server-verified apply, history.
- [x] Plan/admin privilege escalation closed — server-authoritative (`applyPendingUpgrade`, `bootstrapAdmin`), rules locked.
- [x] Firebase secrets provisioned at v3; env layout documented (secrets vs params, CRLF pitfall).
- [x] Card creation + dashboard auth — working (old "BLOCKED" items obsolete; anonymous auth no longer required).
- [x] robots.txt + sitemap.xml — present in `public/`.
- [x] Custom domain — `nowncard.com` live on `vcard-studio-314` hosting site.
- [x] UI unification — navigation (BackLink, underline tabs), tactile button system (gold/blue/red), landing badges → colored titles.
- [x] Cleanup — dead code removed, editor toggles unified, dynamic FAQ pricing.

---

## Deploy Cheat Sheet

- Staging: `firebase deploy --only hosting:nowncard-v2`
- Production: `firebase deploy --only hosting:vcard-studio-314`
- Functions: `firebase deploy --only functions`
- Rules: `firebase deploy --only firestore:rules,storage`
