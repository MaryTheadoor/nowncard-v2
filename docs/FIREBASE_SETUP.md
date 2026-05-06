# VCard Studio — Firebase Setup Guide

This project uses **client-side Firebase only** for MVP. No Cloud Functions, no Admin SDK.

## 1. Required Console Configuration

In the Firebase console for project **vcard-studio-314**, enable:

### Authentication
- **Anonymous** provider → enabled
- **Google** provider → enabled (add the preview origin + final prod domain to Authorized domains)
  - Authorized domains must include: `contact-share-4.preview.emergentagent.com`, `localhost`, and your final deploy domain.

### Firestore Database
- Create database in **native mode**.
- Deploy the rules from `/app/firestore.rules`:
  ```
  firebase deploy --only firestore:rules
  ```

### Storage
- Enable Cloud Storage.
- Deploy the rules from `/app/storage.rules`:
  ```
  firebase deploy --only storage
  ```

## 2. Hosting Deployment

```
cd /app/frontend
yarn build
cd /app
firebase deploy --only hosting
```

The `firebase.json` rewrites all routes to `/index.html` (SPA), including `/c/:slug` and `/dashboard`.

## 3. Data Model

```
cards/{cardId}
  slug, firstName, lastName, jobTitle, company,
  email, phone, website, address, bio,
  socialLinks: [{ platform, url }],
  profileImage, accentColor, cardStyle,
  ownerId, isPublic, viewCount,
  createdAt, updatedAt

users/{uid}
  cards: [cardId, ...]
  updatedAt

analytics/{cardId}
  taps: { save, call, email, website, map, share, social:* }
  updatedAt
```

## 4. Security Notes

- Public read is gated by `isPublic == true` in Firestore rules.
- Only the owner (via `ownerId`) can write/delete their cards.
- Anonymous users can create cards; encourage upgrade to Google via the nav "Sign in" button.
- Storage uploads are gated by `uid` path prefix + 5MB + image MIME.

## 5. Analytics

Tap and view tracking is client-side — `trackView` increments `viewCount` on the card;
`trackTap` writes merge-updates to `analytics/{cardId}`.
