# Wallet Passes — Integration Guide

Adds a "Save to Wallet" button to card pages. **Google Wallet** is implemented
server-side (`getWalletPass` callable) and just needs your credentials to activate.
**Apple Wallet** requires an Apple Developer certificate and is documented below.

---

## Google Wallet (implemented)

### How it works
- Card page "Wallet" button → calls the `getWalletPass` callable → builds a signed JWT
  containing a generic pass (your name, card URL QR code, contact info, brand colors) →
  returns an **Add to Google Wallet** link: `https://pay.google.com/gp/v/save/<jwt>`.
- The pass opens in Google Wallet; the user taps **Add**.
- Until credentials are set, the callable returns `{ configured: false }` and the UI shows
  "Wallet passes are coming soon."

### Setup steps (once)
1. **Google Cloud project** — you already have one (`vcard-studio-314`).
2. **Create a service account + key**:
   - Google Cloud Console → IAM & Admin → Service Accounts → your project.
   - Create/select a service account → **Keys** → **Add Key → JSON** → download.
   - (This project's default compute service account may work; a dedicated one is cleaner.)
3. **Create a Google Wallet issuer**:
   - https://wallet-console.developers.google.com → set up an issuer account.
   - You'll get an **Issuer ID** (e.g. `3388000000000000000`) after agreeing to the terms.
4. **Set env vars on the `getWalletPass` function** (Firebase console → Functions →
   `getWalletPass` → Edit → Runtime/Environment variables, or via CLI):
   - `GOOGLE_WALLET_ISSUER_ID` = your issuer id
   - `GOOGLE_WALLET_SERVICE_ACCOUNT` = the **entire JSON** of the service account key
     (paste the JSON string as the value).
5. **Test** — open any public card page → **Wallet** → it should open Google Wallet.
   Passes show **"[TEST ONLY]"** until you request publishing access
   (Google Wallet console → Go live).

### Validation
- The pass uses the **Generic pass** type (class `{issuer}.nowncard-card`, object
  `{issuer}.{slug}`). If the card page/object fields need tuning, use Google's
  **Pass Builder** (https://developers.google.com/wallet/generic/resources/pass-builder)
  to preview the layout, then update `functions/src/index.ts` `getWalletPass`.
- The JWT must stay under ~1800 characters (it will — the payload is small).

---

## Apple Wallet (documented — requires a certificate)

Apple Wallet passes are **`.pkpass` files**: a signed zip (`pass.json` + images +
`manifest.json` + a signature created with your **Pass Type ID certificate**). This cannot
be done without an Apple Developer account + certificate, which must be provisioned by you.

### Setup steps (when ready)
1. **Apple Developer Program** membership (~$99/yr) — https://developer.apple.com.
2. **Create a Pass Type ID** (Identifiers → Pass Type IDs → register e.g.
   `pass.com.nowncard.card`) and download the **pass certificate** (`.p12`/`.cer` + private key).
3. Store the certificate + its password in the functions env:
   - `APPLE_PASS_CERT` (base64 of the `.p12`) and `APPLE_PASS_CERT_PASSWORD`, and
     `APPLE_PASS_TYPE_ID` (`pass.com.nowncard.card`).
4. A new callable/endpoint (`getApplePass`) would:
   - Build `pass.json` (a **generic** pass: `"formatVersion": 1`,
     `"passTypeIdentifier": pass.com.nowncard.card`, `serialNumber`, `barcode` = QR of the
     card URL, `organizationName`, `description`, `foregroundColor`/`backgroundColor`).
   - Add `icon.png` + `logo.png` (Apple requires an icon).
   - Write `manifest.json` (SHA-1 of every file), then sign `manifest.json` with the cert
     (PKCS#7 detached, using the WWDR intermediate) → `signature`.
   - Zip everything as `Card.pkpass` and serve with `application/vnd.apple.pkpass`.
5. Wire the card page "Wallet" button to try Apple first on iOS (or show both options).

### Apple specifics worth knowing
- Requires a **web-service URL** only for update/registration (optional for static passes).
- The pass `barcode` (QR/PDF417) renders on the lock screen.
- Signing uses the pass certificate + the Apple **WWDR** intermediate certificate.

---

## Current status
- [x] Google Wallet server code + client button (needs your issuer id + service account key).
- [ ] Google Wallet: set credentials → test on device.
- [ ] Apple Wallet: needs Apple Developer account + cert (follow steps above).
