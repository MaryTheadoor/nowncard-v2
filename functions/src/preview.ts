import React from 'react';
import { readFileSync } from 'fs';
import * as path from 'path';
import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import satori, { type Font } from 'satori';
import { Resvg } from '@resvg/resvg-js';

const h = React.createElement;

// Lazy access — the module may be evaluated before index.ts calls initializeApp().
function db(): admin.firestore.Firestore {
  return admin.firestore();
}

// The card image bucket must send CORS headers so the browser (html2canvas in
// "Save Image") can read photo pixels cross-origin. Idempotent, runs on cold start.
let corsChecked = false;
async function ensureStorageCors(): Promise<void> {
  if (corsChecked) return;
  corsChecked = true;
  try {
    const bucket = admin.storage().bucket('vcard-studio-314.firebasestorage.app');
    const [metadata] = await bucket.getMetadata();
    const cors = metadata.cors as Array<{ origin?: string[] }> | undefined;
    if (cors?.some((c) => c.origin?.includes('*'))) return;
    await bucket.setCorsConfiguration([{ origin: ['*'], method: ['GET', 'HEAD'], responseHeader: ['*'], maxAgeSeconds: 3600 }]);
    console.log('[storage] CORS enabled on card image bucket');
  } catch (err) {
    console.warn('[storage] Failed to configure bucket CORS:', err);
  }
}
void ensureStorageCors();

// ---------------------------------------------------------------------------
// Fonts (Inter via @fontsource — satori supports ttf/otf/woff)
// ---------------------------------------------------------------------------
const fontDir = path.join(__dirname, '..', 'node_modules', '@fontsource', 'inter', 'files');

const fonts: Font[] = [
  {
    name: 'Inter',
    data: readFileSync(path.join(fontDir, 'inter-latin-400-normal.woff')),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: readFileSync(path.join(fontDir, 'inter-latin-700-normal.woff')),
    weight: 700,
    style: 'normal',
  },
];

// ---------------------------------------------------------------------------
// Small helpers (mirror of src/lib/utils.ts for the server)
// ---------------------------------------------------------------------------
function fullName(card: { [key: string]: unknown } | null): string {
  if (!card) return '';
  const parts: string[] = [];
  if (typeof card.prefix === 'string') parts.push(card.prefix);
  if (typeof card.firstName === 'string') parts.push(card.firstName);
  if (typeof card.middleName === 'string') parts.push(card.middleName);
  if (typeof card.lastName === 'string') parts.push(card.lastName);
  if (typeof card.suffix === 'string') parts.push(card.suffix);
  return parts.join(' ').trim();
}

function orgLine(card: { [key: string]: unknown } | null): string {
  if (!card) return '';
  const parts: string[] = [];
  if (typeof card.jobTitle === 'string' && card.jobTitle) parts.push(card.jobTitle);
  if (typeof card.department === 'string' && card.department) parts.push(card.department);
  if (typeof card.company === 'string' && card.company) parts.push(card.company);
  return parts.join(' · ');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NC';
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Profile images come from Firebase Storage (uploads) or Google user avatars.
// Server-side fetching must be restricted to these hosts to prevent SSRF.
const ALLOWED_IMAGE_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com', 'googleusercontent.com'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function isAllowedImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_IMAGE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function loadProfileImage(card: { [key: string]: unknown } | null): Promise<string | null> {
  const url = typeof card?.profileImage === 'string' ? card.profileImage : '';
  if (!url || !isAllowedImageUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) {
      console.warn('[preview] profile image too large, skipping:', buf.length);
      return null;
    }
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn('[preview] profile image fetch failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// OG image renderer (1200x630 PNG)
// ---------------------------------------------------------------------------
async function renderPreview(card: { [key: string]: unknown } | null): Promise<Buffer> {
  const name = truncate(fullName(card) || 'NownCard', 34);
  const org = truncate(orgLine(card), 64);
  const bio = truncate(typeof card?.bio === 'string' ? card.bio : '', 140);
  const slug = typeof card?.slug === 'string' ? card.slug : 'card';
  const accent = typeof card?.accentColor === 'string' && card.accentColor ? card.accentColor : '#f5b940';
  const brandName = fullName(card) ? name : 'NownCard';
  const tagline = fullName(card) ? 'Digital business card' : 'Digital Business Cards';

  const profileSrc = await loadProfileImage(card);

  const photo = profileSrc
    ? h('img', {
        src: profileSrc,
        style: { width: 224, height: 224, borderRadius: 30, border: `5px solid ${accent}`, objectFit: 'cover' },
      })
    : h(
        'div',
        {
          style: {
            width: 224,
            height: 224,
            borderRadius: 30,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `5px solid ${accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        h('div', { style: { fontSize: 80, fontWeight: 700, color: accent } }, getInitials(brandName)),
      );

  const children: React.ReactNode[] = [
    h('div', {
      style: {
        position: 'absolute',
        width: 520,
        height: 520,
        borderRadius: '50%',
        backgroundColor: accent,
        opacity: 0.1,
        right: -120,
        top: -140,
      },
    }),
    h('div', {
      style: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: '50%',
        backgroundColor: accent,
        opacity: 0.06,
        left: 400,
        bottom: -100,
      },
    }),
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 14 } },
      h(
        'div',
        {
          style: {
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        h('div', { style: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#0B1220' } }),
      ),
      h('div', { style: { fontSize: 30, fontWeight: 700, color: '#ffffff', letterSpacing: 0.5 } }, 'NownCard'),
    ),
    h(
      'div',
      { style: { display: 'flex', gap: 48, alignItems: 'center', flex: 1 } },
      photo,
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 16, flex: 1 } },
        h('div', { style: { fontSize: 62, fontWeight: 700, color: '#ffffff', lineHeight: 1.12 } }, brandName),
        org
          ? h('div', { style: { fontSize: 32, fontWeight: 500, color: accent } }, org)
          : h('div', { style: { fontSize: 32, fontWeight: 500, color: accent } }, 'Connect on NownCard'),
        bio
          ? h('div', { style: { fontSize: 27, fontWeight: 400, color: '#C9D4E4', lineHeight: 1.45 } }, bio)
          : null,
      ),
    ),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { fontSize: 23, color: '#ffffff66' } }, `https://nowncard.com/${slug}`),
      h('div', { style: { fontSize: 23, color: '#ffffff55' } }, tagline),
    ),
  ];

  const svg = await satori(
    h(
      'div',
      {
        style: {
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0B1220',
          padding: '64px 72px',
          position: 'relative',
          fontFamily: 'Inter',
        },
      },
      children,
    ),
    { width: 1200, height: 630, fonts },
  );

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

// ---------------------------------------------------------------------------
// Vertical card image renderer (1080x1890 PNG) — used by "Save Image" so the
// downloaded file is a portrait card with the person's contact details.
// ---------------------------------------------------------------------------
const ICON_PATHS: Record<string, string> = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  mail: 'M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  globe: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
};

function contactIcon(type: string, accent: string): React.ReactNode {
  return h(
    'svg',
    { viewBox: '0 0 24 24', style: { width: 26, height: 26, fill: 'none', stroke: accent, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } },
    h('path', { d: ICON_PATHS[type] || ICON_PATHS.globe }),
  );
}

interface ContactRow {
  icon: 'phone' | 'mail' | 'globe' | 'pin';
  text: string;
}

function contactRows(card: { [key: string]: unknown } | null): ContactRow[] {
  if (!card) return [];
  const rows: ContactRow[] = [];
  const phones = Array.isArray(card.phones) ? card.phones : [];
  phones.slice(0, 2).forEach((p) => {
    const num = (p as { number?: unknown })?.number;
    if (typeof num === 'string' && num) rows.push({ icon: 'phone', text: num });
  });
  if (!rows.some((r) => r.icon === 'phone') && typeof card.phone === 'string' && card.phone) rows.push({ icon: 'phone', text: card.phone });
  const emails = Array.isArray(card.emails) ? card.emails : [];
  emails.slice(0, 2).forEach((e) => {
    const addr = (e as { address?: unknown })?.address;
    if (typeof addr === 'string' && addr) rows.push({ icon: 'mail', text: addr });
  });
  if (!rows.some((r) => r.icon === 'mail') && typeof card.email === 'string' && card.email) rows.push({ icon: 'mail', text: card.email });
  const websites = Array.isArray(card.websites) ? card.websites : [];
  websites.slice(0, 2).forEach((w) => {
    const u = (w as { url?: unknown })?.url;
    if (typeof u === 'string' && u) rows.push({ icon: 'globe', text: u });
  });
  if (!rows.some((r) => r.icon === 'globe') && typeof card.website === 'string' && card.website) rows.push({ icon: 'globe', text: card.website });
  const addr = Array.isArray(card.addresses) ? (card.addresses[0] as { street?: unknown; city?: unknown; state?: unknown; zip?: unknown } | undefined) : undefined;
  if (addr) {
    const parts = [addr.street, [addr.city, addr.state].filter(Boolean).join(', '), addr.zip].filter(Boolean);
    if (parts.length) rows.push({ icon: 'pin', text: parts.join(', ') });
  }
  return rows;
}

function socialList(card: { [key: string]: unknown } | null): string[] {
  if (!card || !Array.isArray(card.socialLinks)) return [];
  return card.socialLinks
    .map((s) => (s as { platform?: unknown })?.platform)
    .filter((p): p is string => typeof p === 'string' && Boolean(p))
    .slice(0, 4);
}

async function renderCardImage(card: { [key: string]: unknown } | null): Promise<Buffer> {
  const name = truncate(fullName(card) || 'NownCard', 40);
  const org = truncate(orgLine(card), 70);
  const bio = truncate(typeof card?.bio === 'string' ? card.bio : '', 220);
  const slug = typeof card?.slug === 'string' ? card.slug : 'card';
  const accent = typeof card?.accentColor === 'string' && card.accentColor ? card.accentColor : '#f5b940';
  const brandName = fullName(card) ? name : 'NownCard';

  const profileSrc = await loadProfileImage(card);
  const rows = contactRows(card);
  const socials = socialList(card);

  const photo = profileSrc
    ? h('img', { src: profileSrc, style: { width: 280, height: 280, borderRadius: 48, border: `6px solid ${accent}`, objectFit: 'cover' } })
    : h(
        'div',
        {
          style: {
            width: 280,
            height: 280,
            borderRadius: 48,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `6px solid ${accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
        },
        h('div', { style: { fontSize: 104, fontWeight: 700, color: accent } }, getInitials(brandName)),
      );

  const children: React.ReactNode[] = [
    h('div', { style: { position: 'absolute', width: 520, height: 520, borderRadius: '50%', backgroundColor: accent, opacity: 0.1, right: -140, top: -140 } }),
    h('div', { style: { position: 'absolute', width: 380, height: 380, borderRadius: '50%', backgroundColor: accent, opacity: 0.06, left: -120, bottom: 180 } }),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        h(
          'div',
          {
            style: {
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          },
          h('div', { style: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#0B1220' } }),
        ),
        h('div', { style: { fontSize: 30, fontWeight: 700, color: '#ffffff', letterSpacing: 0.5 } }, 'NownCard'),
      ),
      h('div', { style: { fontSize: 22, fontWeight: 500, color: '#ffffff55', letterSpacing: 1 } }, 'DIGITAL CARD'),
    ),
    h(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 34,
          flex: 1,
        },
      },
      photo,
      h('div', { style: { fontSize: 76, fontWeight: 700, color: '#ffffff', lineHeight: 1.1, textAlign: 'center' } }, brandName),
      org
        ? h('div', { style: { fontSize: 40, fontWeight: 500, color: accent, textAlign: 'center' } }, org)
        : h('div', { style: { fontSize: 40, fontWeight: 500, color: accent, textAlign: 'center' } }, 'Digital business card'),
      bio
        ? h('div', { style: { fontSize: 28, fontWeight: 400, color: '#C9D4E4', lineHeight: 1.5, textAlign: 'center', maxWidth: 860 } }, bio)
        : null,
      h('div', { style: { width: 160, height: 3, borderRadius: 2, backgroundColor: accent, opacity: 0.7 } }),
      rows.length > 0
        ? h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, maxWidth: 920 } },
            rows.map((r) =>
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 26px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  },
                },
                contactIcon(r.icon, accent),
                h('div', { style: { fontSize: 28, fontWeight: 500, color: '#E6EBF4' } }, r.text),
              ),
            ),
          )
        : null,
      socials.length > 0
        ? h(
            'div',
            { style: { display: 'flex', gap: 14 } },
            socials.map((s) =>
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 20px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.09)',
                  },
                },
                h('div', { style: { fontSize: 24, fontWeight: 600, color: accent } }, `@${s.toLowerCase()}`),
              ),
            ),
          )
        : null,
    ),
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h('div', { style: { fontSize: 26, color: '#ffffff66' } }, `https://nowncard.com/${slug}`),
      h('div', { style: { fontSize: 26, color: '#ffffff55' } }, 'Share via link, QR, NFC, or vCard'),
    ),
  ];

  const svg = await satori(
    h(
      'div',
      {
        style: {
          width: 1080,
          height: 1890,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0B1220',
          padding: '72px',
          position: 'relative',
          fontFamily: 'Inter',
        },
      },
      children,
    ),
    { width: 1080, height: 1890, fonts },
  );

  return new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render().asPng();
}

// ---------------------------------------------------------------------------
// GET /og-images/<slug>.png — the generated share thumbnail (1200x630)
// GET /card-images/<slug>.png — the vertical card image (1080x1890)
// ---------------------------------------------------------------------------
export const cardOgImage = onRequest(
  { cors: true, memory: '512MiB', timeoutSeconds: 30 },
  async (req, res) => {
    const slug = parseImageSlug(req.path);
    const isCardImage = /^\/card-images\//.test(req.path);
    let card: { [key: string]: unknown } | null = null;
    if (slug) {
      try {
        const snap = await db().collection('cards').where('slug', '==', slug).limit(1).get();
        const data = snap.docs[0]?.data();
        if (data && data.isPublic === true) card = data as { [key: string]: unknown };
      } catch (err) {
        console.error('[cardOgImage] card lookup failed:', err);
      }
    }
    try {
      const png = isCardImage ? await renderCardImage(card) : await renderPreview(card);
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
      res.send(png);
    } catch (err) {
      console.error('[cardOgImage] render failed:', err);
      res.status(500).send('Preview generation failed');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /card/<slug> — index.html with the card's meta tags injected so link
// previews (WhatsApp, iMessage, Slack, Discord, Facebook, LinkedIn, X) see
// real per-card titles/descriptions/images without running JS.
// ---------------------------------------------------------------------------
const INDEX_SOURCES = [
  'https://vcard-studio-314.web.app/index.html',
  'https://nowncard.com/index.html',
];

let cachedHtml: { html: string; at: number } | null = null;

async function getIndexHtml(): Promise<string> {
  if (cachedHtml && Date.now() - cachedHtml.at < 60_000) return cachedHtml.html;
  for (const src of INDEX_SOURCES) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const html = await res.text();
        cachedHtml = { html, at: Date.now() };
        return html;
      }
    } catch (err) {
      console.warn(`[cardPage] index fetch failed from ${src}:`, err);
    }
  }
  return cachedHtml?.html ?? '<!doctype html><html><head><meta charset="utf-8"><title>NownCard</title></head><body></body></html>';
}

export const cardPage = onRequest({ cors: true }, async (req, res) => {
  res.set('Cache-Control', 'public, max-age=60');

  if (req.path === '/sitemap.xml' || req.path === '/sitemap.xml/') {
    await serveSitemap(res);
    return;
  }

  const html = await getIndexHtml();
  const slug = parseCardSlug(req.path);
  if (!slug) {
    res.send(html);
    return;
  }

  let card: { [key: string]: unknown } | null = null;
  try {
    const snap = await db().collection('cards').where('slug', '==', slug).limit(1).get();
    const data = snap.docs[0]?.data();
    if (data && data.isPublic === true) card = data as { [key: string]: unknown };
  } catch (err) {
    console.error('[cardPage] card lookup failed:', err);
  }

  if (!card) {
    res.send(html);
    return;
  }

  const name = fullName(card) || 'Contact';
  const title = `${name} — NownCard`;
  const fallbackDesc = `Digital business card for ${name}. Share via link, QR, NFC, or vCard.`;
  const desc = truncate(typeof card.bio === 'string' && card.bio ? card.bio : fallbackDesc, 200);
  const forwarded = Array.isArray(req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-host'][0]
    : req.headers['x-forwarded-host'];
  const host = typeof forwarded === 'string' ? forwarded : typeof req.headers.host === 'string' ? req.headers.host : 'nowncard.com';
  const v = card.updatedAt instanceof admin.firestore.Timestamp ? card.updatedAt.toMillis() : Date.now();
  const image = `https://${host}/og-images/${encodeURIComponent(slug)}.png?v=${v}`;
  const url = `https://${host}/card/${encodeURIComponent(slug)}`;
  const imageAlt = `Digital business card for ${name}`;

  const personImage = typeof card.profileImage === 'string' && card.profileImage ? card.profileImage : image;
  const firstPhone = Array.isArray(card.phones) ? (card.phones[0] as { number?: unknown })?.number : typeof card.phone === 'string' ? card.phone : '';
  const firstEmail = Array.isArray(card.emails) ? (card.emails[0] as { address?: unknown })?.address : typeof card.email === 'string' ? card.email : '';
  const sameAs = Array.isArray(card.socialLinks)
    ? card.socialLinks.map((s) => (s as { url?: unknown })?.url).filter((u): u is string => typeof u === 'string' && Boolean(u))
    : [];

  const personJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    url,
    image: personImage,
    description: desc,
  };
  if (typeof card.firstName === 'string' && card.firstName) personJsonLd.givenName = card.firstName;
  if (typeof card.lastName === 'string' && card.lastName) personJsonLd.familyName = card.lastName;
  if (typeof card.jobTitle === 'string' && card.jobTitle) personJsonLd.jobTitle = card.jobTitle;
  if (typeof card.company === 'string' && card.company) personJsonLd.worksFor = { '@type': 'Organization', name: card.company };
  if (typeof firstPhone === 'string' && firstPhone) personJsonLd.telephone = firstPhone;
  if (typeof firstEmail === 'string' && firstEmail) personJsonLd.email = `mailto:${firstEmail}`;
  if (sameAs.length) personJsonLd.sameAs = sameAs;
  const addr = Array.isArray(card.addresses) ? (card.addresses[0] as { street?: unknown; city?: unknown; state?: unknown; zip?: unknown; country?: unknown } | undefined) : undefined;
  if (addr && (addr.street || addr.city)) {
    personJsonLd.address = {
      '@type': 'PostalAddress',
      ...(typeof addr.street === 'string' ? { streetAddress: addr.street } : {}),
      ...(typeof addr.city === 'string' ? { addressLocality: addr.city } : {}),
      ...(typeof addr.state === 'string' ? { addressRegion: addr.state } : {}),
      ...(typeof addr.zip === 'string' ? { postalCode: addr.zip } : {}),
      ...(typeof addr.country === 'string' ? { addressCountry: addr.country } : {}),
    };
  }

  const personScript = `<script type="application/ld+json">${JSON.stringify(personJsonLd).replace(/</g, '\\u003c')}</script>`;
  const extraHead = `${personScript}<meta property="og:image:alt" content="${escapeHtml(imageAlt)}"><meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">`;

  const out = html
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapeHtml(desc)}"`)
    .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${escapeHtml(title)}"`)
    .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${escapeHtml(desc)}"`)
    .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${escapeHtml(url)}"`)
    .replace(/<meta property="og:image" content="[^"]*"/, `<meta property="og:image" content="${escapeHtml(image)}"`)
    .replace(/<meta property="og:image:width" content="[^"]*"/, `<meta property="og:image:width" content="1200"`)
    .replace(/<meta property="og:image:height" content="[^"]*"/, `<meta property="og:image:height" content="630"`)
    .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${escapeHtml(title)}"`)
    .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${escapeHtml(desc)}"`)
    .replace(/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${escapeHtml(image)}"`)
    .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${escapeHtml(url)}"`)
    .replace(/<\/head>/, `${extraHead}</head>`);

  res.send(out);
});

// ---------------------------------------------------------------------------
// GET /sitemap.xml — static routes + every public card slug
// ---------------------------------------------------------------------------
async function serveSitemap(res: { set: (k: string, v: string) => void; send: (b: string) => void }): Promise<void> {
  const urls = [
    'https://nowncard.com/',
    'https://nowncard.com/rolodex',
    'https://nowncard.com/terms',
    'https://nowncard.com/privacy',
    'https://nowncard.com/contact',
  ];
  try {
    const snap = await db().collection('cards').where('isPublic', '==', true).select('slug').limit(5000).get();
    snap.docs.forEach((d) => {
      const s = d.get('slug');
      if (typeof s === 'string' && s) urls.push(`https://nowncard.com/card/${encodeURIComponent(s)}`);
    });
  } catch (err) {
    console.error('[sitemap] card fetch failed:', err);
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escapeHtml(u)}</loc></url>`)
    .join('\n')}\n</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.send(body);
}

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------
function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function parseImageSlug(p: string): string | null {
  const m = p.match(/^\/(?:og-images|card-images)\/([^/?#]+?)(?:\.png)?$/);
  return m ? safeDecode(m[1]) : null;
}

function parseCardSlug(p: string): string | null {
  const m = p.match(/^\/card\/([^/?#]+)/);
  return m ? safeDecode(m[1]) : null;
}
