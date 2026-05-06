# Network Map — NownCard Ecosystem

> Firebase account: `mary.theadoor.doctor@gmail.com`
> Current active project: `vcard-studio-314`

---

## Primary Application

### vcard-studio-314 (CURRENT)
| Attribute | Value |
|-----------|-------|
| Project ID | `vcard-studio-314` |
| Project Number | `58487120224` |
| Live URL | https://vcard-studio-314.web.app |
| Hosting Site | `vcard-studio-314` |
| App ID | `1:58487120224:web:f53e2cda0f276fd237fe05` |
| Platform | WEB |
| Custom Domain | ❌ Not configured (or not visible via CLI) |
| Firestore | ✅ Rules compile, indexes defined |
| Storage | ✅ Rules compile |
| Auth | Email/Password + Google |
| App Check | ❌ Disabled |

**Routes/Rewrites:**
- `/` → `index.html` (landing)
- `/card/**` → `card.html` (public card viewer)
- `/app.html` → `app.html` (dashboard / card editor)
- `/debug` → `debug.html` (diagnostics)
- `/admin` → `admin.html`
- `/success` → `success.html`
- `/cancel` → `cancel.html`

---

## Sibling Projects (Same Firebase Account)

### nown-card (POLISHED ALTERNATE IMPLEMENTATION)
| Attribute | Value |
|-----------|-------|
| Project ID | `nown-card` |
| Project Number | `719245905430` |
| Live URL | https://nown-card.web.app |
| App ID | `1:719245905430:web:f0a09bae2c534d9bf1af37` |
| Notes | **Complete single-page app** with inline editor, live preview, QR codes, theme toggle, real brand icon. References `nowncard.com` as intended domain. Demo card: "Mary Theadoor - Window Washing Pro". Pricing: Free, Pro ($19/year), Business ($49/year). This may be the "real" production app the user is referring to. **URGENT: Need user clarification on whether to migrate assets/copy from here or if `vcard-studio-314` is the intended future codebase.** |

### nown-card-kv5yi
| Attribute | Value |
|-----------|-------|
| Project ID | `nown-card-kv5yi` |
| Project Number | `214478590647` |
| Live URL | https://nown-card-kv5yi.web.app |
| App ID | `1:214478590647:web:e6128a877a9167e3753332` |
| Notes | Second NownCard variant. Could be dev/staging. |

### nown-digital
| Attribute | Value |
|-----------|-------|
| Project ID | `nown-digital` |
| Project Number | `307545878905` |
| Live URLs | https://nown-digital.web.app, https://nown-digital-site.web.app |
| App IDs | `1:307545878905:web:329fb90c06ff484c4affa8`, `1:307545878905:web:90989b90ebf77e824affa8` |
| Notes | Two hosting sites. May be the parent brand / agency site. |

### Other Projects (Lower Priority)
| Project | URL | Notes |
|---------|-----|-------|
| `deity-machine` | https://deity-machine.web.app | No App ID set |
| `dogwood-counseling` | — | — |
| `five-star-cleaning-lv` | — | — |
| `istsim1` | — | — |
| `lazerflow` | https://lazerflow.web.app | No App ID set |
| `lazerflow-insights-demo` | — | — |
| `outreachai-vs3yq` | https://outreachai-vs3yq.web.app | — |
| `pamperme-ai` | — | — |
| `pixel-playground-w942s` | — | — |
| `stitchstovegarden-2bece` | — | — |
| `studio-2975129913-5f8c1` | — | Generic Firebase app |
| `studio-870891613-ab24e` | — | Generic Firebase app |
| `studio-8786433039-28b1b` | — | Generic Firebase app |

---

## Domain Strategy (TBD)

User states a custom domain is "already set up." Need to verify:
1. Is it connected to `vcard-studio-314` or one of the sibling projects?
2. If connected, why doesn't `firebase hosting:sites:get` show it?
3. Common places: Cloudflare proxy, separate registrar DNS, or Firebase Hosting custom domain config.

**Action needed:** Screenshot Firebase Console Hosting page for domain verification.

---

## Asset Inventory

| Asset | Location | Status |
|-------|----------|--------|
| favicon.svg | `public/favicon.svg` | ✅ Placeholder created |
| icon-192.png | `public/icon-192.png` | ✅ Present |
| icon-512.png | `public/icon-512.png` | ✅ Present |
| Real brand icon | Unknown Firebase bucket | 🔍 Need to locate |
