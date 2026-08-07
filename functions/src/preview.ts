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

// ---------------------------------------------------------------------------
// OG image renderer (1200x630 PNG)
// ---------------------------------------------------------------------------
async function renderPreview(card: { [key: string]: unknown } | null): Promise<Buffer> {
  const name = truncate(fullName(card) || 'NownCard', 34);
  const org = truncate(orgLine(card), 64);
  const bio = truncate(typeof card?.bio === 'string' ? card.bio : '', 140);
  const slug = typeof card?.slug === 'string' ? card.slug : 'card';
  const accent = typeof card?.accentColor === 'string' && card.accentColor ? card.accentColor : '#e8a628';
  const brandName = fullName(card) ? name : 'NownCard';
  const tagline = fullName(card) ? 'Digital business card' : 'Digital Business Cards';

  let profileSrc: string | null = null;
  if (typeof card?.profileImage === 'string' && card.profileImage) {
    try {
      const res = await fetch(card.profileImage, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') || 'image/jpeg';
        profileSrc = `data:${mime};base64,${buf.toString('base64')}`;
      }
    } catch (err) {
      console.warn('[cardOgImage] profile image fetch failed:', err);
    }
  }

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
// GET /og-images/<slug>.png — the generated share thumbnail
// ---------------------------------------------------------------------------
export const cardOgImage = onRequest(
  { cors: true, memory: '512MiB', timeoutSeconds: 30 },
  async (req, res) => {
    const slug = parseImageSlug(req.path);
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
      const png = await renderPreview(card);
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
    .replace(/<meta name="twitter:image" content="[^"]*"/, `<meta name="twitter:image" content="${escapeHtml(image)}"`);

  res.send(out);
});

// ---------------------------------------------------------------------------
// Path parsing
// ---------------------------------------------------------------------------
function parseImageSlug(p: string): string | null {
  const m = p.match(/^\/og-images\/([^/?#]+?)(?:\.png)?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseCardSlug(p: string): string | null {
  const m = p.match(/^\/card\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
