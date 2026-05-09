# NownCard v2

Digital business cards that work everywhere. Create a beautiful card in seconds, share via QR code, NFC, or link — no app required for recipients.

**Live:** https://nowncard.com

---

## What is NownCard?

NownCard lets professionals create digital business cards with:

- **Rich contact info** — multiple phones, emails, addresses, websites, social links
- **Custom design** — colors, fonts, background images, light/dark themes
- **QR codes** — scannable vCard or URL on the back of every card
- **NFC support** — program physical NFC tags with your card
- **Analytics** — track views, saves, and engagement
- **Direct messaging** — visitors can send inquiries straight to your dashboard
- **vCard export** — one-tap save to any phone's contacts

---

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind CSS v4
- **Backend:** Firebase (Auth, Firestore, Storage, Hosting, Cloud Functions v2)
- **Payments:** Square Checkout Links
- **Push Notifications:** OneSignal (client-side)

---

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Deploy to Firebase
firebase deploy --only hosting
```

Cloud Functions:
```bash
cd functions && npm install && npm run build
cd ..
firebase deploy --only functions
```

---

## Project Structure

See [`AGENTS.md`](./AGENTS.md) for complete architecture documentation, data models, and coding conventions.

Key directories:
- `src/pages/` — Route-level page components
- `src/components/` — Reusable UI components
- `src/lib/` — Utilities, Firebase init, vCard generation
- `functions/src/` — Cloud Functions (Square webhook, push notifications)
- `docs/` — Product requirements, deployment guides, roadmaps

---

## Documentation

| File | Purpose |
|------|---------|
| `AGENTS.md` | Full agent/developer onboarding guide |
| `MASTER_AUDIT.md` | Feature inventory, data model, audit findings |
| `PRODUCTION_STATUS.md` | Current live state, recent deployments, action items |
| `DEVELOPMENT_LOG.md` | Chronological change history |
| `docs/PRD-NownCard-v2.md` | Product Requirements Document |
| `docs/ROADMAP.md` | Future feature plans |

---

## License

Proprietary — all rights reserved.
