# NownCard — Go-Live Deployment Playbook

> **Goal:** ship NownCard live on `nowncard.com` using **Firebase Hosting** (frontend) and **Firebase Cloud Functions** (backend, no more Emergent-hosted FastAPI). One project, one `firebase deploy`.

This guide assumes you are running commands from `/app` on your dev machine (or this Emergent container for one-off deploys).

---

## 0. Architecture — what goes where

| Layer                  | Where                              | Cost                            |
|------------------------|------------------------------------|---------------------------------|
| Frontend (React build) | Firebase Hosting                   | Free (10 GB/mo)                 |
| Backend (`/api/**`)    | Firebase Cloud Functions (Python)  | Free tier: 2M invocations/mo *  |
| Database               | Firestore (replaces MongoDB)       | Free tier: 50K reads/day        |
| Auth                   | Firebase Auth (Anonymous + Google) | Free                            |
| File uploads           | Firebase Storage                   | Free tier: 5 GB                 |
| Payments               | Stripe                             | 2.9% + 30¢ per successful tx    |

\* Cloud Functions requires the **Blaze (pay-as-you-go) plan**, but you will almost certainly stay inside the free tier until you have thousands of users. With a credit card on file, Firebase warns you long before any charge.

---

## Phase 1 · Firebase project setup (one-time, ~10 min)

### 1.1 Create / configure the Firebase project
You currently have `vcard-studio-314`. Decide:
- **Option A (recommended):** create a fresh project `nowncard` to match the rebrand.
- **Option B:** keep `vcard-studio-314` — zero data migration but the ID stays old.

For Option A:
1. https://console.firebase.google.com → **Add project** → name it `nowncard`
2. Continue through wizard (Google Analytics optional).
3. In the new project → ⚙️ **Project settings** → **General** → scroll to "Your apps" → **</>** (Web) → register app → copy the config object.

### 1.2 Update `frontend/.env` with the new Firebase keys
```bash
REACT_APP_FIREBASE_API_KEY=xxx
REACT_APP_FIREBASE_AUTH_DOMAIN=nowncard.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=nowncard
REACT_APP_FIREBASE_STORAGE_BUCKET=nowncard.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=xxx
REACT_APP_FIREBASE_APP_ID=xxx
```
(Skip if using Option B.)

### 1.3 Enable the services in Firebase Console
All of these are one-click in the left sidebar:
- **Authentication** → **Sign-in method** → enable **Anonymous** + **Google**
- **Firestore Database** → **Create database** → **Production mode** → pick the region closest to your users (e.g. `nam5` for North America) → done
- **Storage** → **Get started** → **Production mode** → same region → done
- **Upgrade to Blaze** (pay-as-you-go, required for Functions): ⚙️ → **Usage and billing** → **Modify plan** → **Blaze** → add credit card. Set a budget alert at $5/mo for peace of mind.

### 1.4 Add authorized domains
Authentication → **Settings** → **Authorized domains** → add:
- `nowncard.com`
- `www.nowncard.com`
- Your preview URL (`contact-share-4.preview.emergentagent.com`) — remove after go-live.

---

## Phase 2 · Migrate backend to Cloud Functions (~30 min)

The current FastAPI/MongoDB backend has to move to Cloud Functions + Firestore. I've left the FastAPI code intact as a reference — you can delete `/app/backend/` after deploy succeeds.

### 2.1 Install Firebase CLI locally
```bash
npm install -g firebase-tools
firebase login
```

### 2.2 Initialize Functions in `/app/functions/`
```bash
cd /app
firebase use nowncard              # or: firebase use --add
firebase init functions
# Pick: Python, Use existing project, install deps
```

This creates `/app/functions/main.py`, `/app/functions/requirements.txt`, `/app/functions/.gitignore`.

### 2.3 Replace `functions/main.py` with NownCard's backend
Paste the contents of `/app/functions_template/main.py` (I'll create this file in a follow-up iteration — see template below). It's a line-for-line port of `backend/server.py` that:
- Uses Firestore instead of MongoDB
- Wraps FastAPI in a single `@https_fn.on_request` function
- Reads Stripe key from `functions:secrets:set STRIPE_API_KEY`

### 2.4 Add Stripe key as a Firebase secret
```bash
firebase functions:secrets:set STRIPE_API_KEY
# paste your live key when prompted
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# paste after Phase 3 completes
```

### 2.5 Update `firebase.json` rewrites so `/api/**` hits the function
Already set correctly in `/app/firebase.json`:
```json
"rewrites": [
  { "source": "/api/**",   "function": "api" },
  { "source": "/c/**",     "destination": "/index.html" },
  { "source": "/dashboard","destination": "/index.html" },
  { "source": "**",        "destination": "/index.html" }
]
```
(If `/api/**` rewrite is missing, add it **before** the catch-all `**` rule — order matters.)

### 2.6 Deploy functions first (standalone test)
```bash
firebase deploy --only functions
# Then test:
curl https://us-central1-nowncard.cloudfunctions.net/api/
# or via hosting alias after Phase 5:
curl https://nowncard.com/api/
```

---

## Phase 3 · Stripe production hardening (~15 min)

### 3.1 🔴 Rotate the exposed live key
Stripe Dashboard → **Developers** → **API keys** → the `rk_live_51TSpJU...` key → **Roll key**.
Update `STRIPE_API_KEY` secret with the new value: `firebase functions:secrets:set STRIPE_API_KEY`.

### 3.2 Create the webhook endpoint
Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
- URL: `https://nowncard.com/api/webhook/stripe`
- Events to select:
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `customer.subscription.deleted` (in case you move to recurring later)
- **Reveal signing secret** → copy → `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET` → paste.

### 3.3 Add Firebase ID-token verification to `/api/stripe/checkout`
Right now anyone can POST `{uid:"someone_elses_uid", plan:"pro"}` and, on payment, activate *their* plan for another user. Before live payments:
1. Frontend sends `Authorization: Bearer <firebase_id_token>` with the checkout request.
2. Backend uses `firebase_admin.auth.verify_id_token(token)` to confirm the uid.

Template already scaffolded in `backend/server.py` comments. I'll wire this in iteration 4 before you flip to live.

---

## Phase 4 · Custom domain — `nowncard.com` (~20 min + SSL wait)

### 4.1 Add the domain in Firebase Hosting
Firebase Console → **Hosting** → **Add custom domain** → enter `nowncard.com`.

### 4.2 Verify ownership
Firebase shows a TXT record (e.g. `google-site-verification=xxx`).
Add it at your domain registrar (where you bought `nowncard.com` — Namecheap, Google Domains, etc.).
Click **Verify** back in Firebase after ~60 sec.

### 4.3 Point DNS to Firebase
Firebase gives you **two A records**:
```
A   @   199.36.158.100
A   @   199.36.158.101
```
Add both at your registrar. If you want `www.nowncard.com` too, add `CNAME www → nowncard.com`.

### 4.4 Wait for SSL (15 min – 24 h)
Firebase provisions a Let's Encrypt cert. Status shows **Connected** in the Hosting tab when ready.
Test: `curl -I https://nowncard.com/` should return `HTTP 200`.

### 4.5 Re-point frontend env
Update `frontend/.env`:
```bash
REACT_APP_BACKEND_URL=https://nowncard.com
```
Rebuild (next phase).

---

## Phase 5 · Deploy everything (~5 min each time)

```bash
cd /app/frontend
yarn build

cd /app
firebase deploy
```

This pushes:
- Static build from `frontend/build/` → Firebase Hosting
- Firestore rules from `firestore.rules`
- Storage rules from `storage.rules`
- Functions from `functions/`

After deploy, visit `https://nowncard.com` — you should see the cosmic navy editor.

### 5.1 Smoke-test checklist

- [ ] Landing page loads, logo visible, theme toggle works
- [ ] Publish a test card with slug `demo`
- [ ] `https://nowncard.com/demo` loads the public card
- [ ] "Save to contacts" downloads a `.vcf` that opens in your phone's Contacts app
- [ ] QR code scans back to `/demo`
- [ ] Dashboard lists the card
- [ ] Pricing page loads 3 tiers
- [ ] Click **Upgrade to Pro** → redirects to Stripe Checkout
- [ ] Complete a $19 test payment with a real card (or use Stripe's test mode by swapping the key for `sk_test_...` first!)
- [ ] `/checkout/success` activates the plan within ~5 seconds
- [ ] Dashboard now shows "Pro" chip + "Billing" button (Customer Portal)

---

## Phase 6 · Post-launch (first week)

- [ ] Set a Stripe budget alert at $1,000/mo in Stripe Dashboard
- [ ] Firebase Console → **Usage and billing** → set a $5/mo cap alert
- [ ] Add a simple admin view (`/admin`) listing payment_transactions for eyeballing
- [ ] Add Open Graph meta tags to public cards so link previews look good on iMessage/WhatsApp
- [ ] Write a 3-tweet launch thread; encourage 10 friends to make cards (free-tier virality loop starts here)

---

## Current outstanding items (in code, before you can deploy)

| # | Item                                                        | Where                           | Status       |
|---|-------------------------------------------------------------|---------------------------------|--------------|
| 1 | Customer Portal endpoint + button                           | `backend/server.py`, `Dashboard.jsx` | ✅ done (this iteration) |
| 2 | Migrate `backend/server.py` → `functions/main.py` (Python 2nd-gen) | `functions/main.py`             | ⏳ iteration 5 |
| 3 | Migrate MongoDB collections → Firestore                    | `functions/main.py`             | ⏳ iteration 5 |
| 4 | Firebase ID-token verification on `/api/stripe/checkout`   | `functions/main.py`             | ⏳ iteration 5 |
| 5 | Free-tier footer gating (show "Built with NownCard" only when owner's plan is free) | `PublicCard.jsx` + owner-plan lookup | ⏳ iteration 5 |
| 6 | Paid vs free slug URL enforcement (`/c/slug` vs `/slug`)   | `Editor.jsx` save()             | ⏳ iteration 5 |
| 7 | Rotate the `rk_live_...` key you pasted in chat             | Stripe dashboard                | 🔴 your action |

Items 2–6 are the code changes I'll do in the next iteration. Say the word ("let's do the cloud functions migration") and I'll port the backend, write the `functions/main.py`, and update the Dashboard/Editor to add the last gates. After that you run Phases 1–5 above and you're live.

---

## Fallback path — if you don't want Blaze / Cloud Functions

Deploy the existing FastAPI to **Render.com** (free tier, 512MB RAM, spins down after inactivity):
1. Push `/app/backend` to a GitHub repo
2. Render → New → Web Service → connect repo → build command `pip install -r requirements.txt` → start command `uvicorn server:app --host 0.0.0.0 --port $PORT`
3. Add env vars: `MONGO_URL` (MongoDB Atlas free tier), `DB_NAME`, `STRIPE_API_KEY`, `CORS_ORIGINS=https://nowncard.com`
4. In `firebase.json` change `/api/**` rewrite to a Hosting redirect to the Render URL (or set `REACT_APP_BACKEND_URL=https://nowncard-api.onrender.com` in frontend)

This keeps the current FastAPI code unchanged but splits infrastructure across two providers.

---

_Last updated: 2026-02-03 · iteration_4_
