# Custom Domain Setup — vcard.nownsite.com

## Overview
VCard Studio is designed to be served from `vcard.nownsite.com` with shareable URLs like `vcard.nownsite.com/YourNameHere`. This guide walks through connecting your custom domain via Firebase Hosting.

## Step 1 — Deploy to Firebase Hosting (if not already)
```bash
cd /app/frontend
yarn build
cd /app
firebase deploy --only hosting
```
Your app is now live at `vcard-studio-314.web.app` and `vcard-studio-314.firebaseapp.com`.

## Step 2 — Add Custom Domain in Firebase Console
1. Open **Firebase Console → Hosting → Add custom domain**
2. Enter `vcard.nownsite.com`
3. Firebase will ask you to verify ownership via a TXT record, then provide DNS records.

## Step 3 — Configure DNS at your `nownsite.com` Registrar
Add the records Firebase gave you (typically **two A records** for the apex or a **CNAME** for a subdomain like `vcard`).

For a subdomain `vcard.nownsite.com`, Firebase usually gives you:

| Type  | Name    | Value                           |
|-------|---------|---------------------------------|
| A     | vcard   | 199.36.158.100                  |
| A     | vcard   | 199.36.158.101                  |

(The exact IPs are shown in your Firebase console — use those.)

Alternatively, Firebase may offer a **CNAME** option:

| Type  | Name    | Value                           |
|-------|---------|---------------------------------|
| CNAME | vcard   | vcard-studio-314.web.app        |

## Step 4 — Add the domain to Firebase Auth Authorized Domains
**Firebase Console → Authentication → Settings → Authorized domains → Add domain**
- Add `vcard.nownsite.com`
- Keep `vcard-studio-314.firebaseapp.com` (default)
- Keep `localhost` for local dev

Without this, Google Sign-In popup will reject.

## Step 5 — Wait for SSL Provisioning
Firebase auto-provisions a Let's Encrypt certificate once DNS propagates.
This can take **up to 24 hours** but often completes in 15–60 minutes.

## Step 6 — Verify
Visit `https://vcard.nownsite.com` — you should see the VCard Studio editor.
Publish a test card with slug `demo`, then visit `https://vcard.nownsite.com/demo`.

## Notes on URL Structure
`firebase.json` rewrites all non-asset paths to `/index.html` so React Router handles:
- `vcard.nownsite.com/` → Editor
- `vcard.nownsite.com/dashboard` → Dashboard
- `vcard.nownsite.com/YourNameHere` → Public card for slug `YourNameHere`
- `vcard.nownsite.com/c/YourNameHere` → same public card (legacy path)

Reserved slugs (`dashboard`, `admin`, `api`, `c`, `auth`, `login`, etc.) cannot be taken, to avoid route collisions.
