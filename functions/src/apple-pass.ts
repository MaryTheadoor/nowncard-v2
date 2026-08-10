import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { PNG } from 'pngjs';
import { zipSync } from 'fflate';

// ---------------------------------------------------------------------------
// Apple Wallet (.pkpass) builder — inactive until configured.
//
// A .pkpass is a signed zip: pass.json + images + manifest.json (SHA-1 of each
// file) + a PKCS#7 detached signature over manifest.json made with the Pass
// Type ID certificate.
//
// Required env vars to activate:
//   APPLE_PASS_TYPE_ID       e.g. pass.com.nowncard.card
//   APPLE_PASS_TEAM_ID       10-char Apple Developer team id
//   APPLE_PASS_CERT          base64 of the .p12 pass certificate
//   APPLE_PASS_CERT_PASSWORD password for the .p12
//
// Until those are set, getApplePass returns { configured: false }.
// ---------------------------------------------------------------------------

interface ApplePassConfig {
  passTypeId: string;
  teamId: string;
  certP12Base64: string;
  certPassword: string;
}

interface ApplePassCard {
  slug: string;
  name: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  email?: string;
  website?: string;
  bio?: string;
  cardUrl: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function solidPng(size: number, hex: string): Buffer {
  const png = new PNG({ width: size, height: size });
  const [r, g, b] = hexToRgb(hex);
  for (let i = 0; i < size * size; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

let wwdrDerCache: Buffer | null = null;

async function getWwdrIntermediate(): Promise<Buffer | null> {
  if (wwdrDerCache) return wwdrDerCache;
  try {
    const res = await fetch('https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer', { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      wwdrDerCache = Buffer.from(await res.arrayBuffer());
      return wwdrDerCache;
    }
  } catch {
    // fall through — signature still works for many validators without the chain
  }
  return null;
}

function signManifest(manifestBytes: Buffer, config: ApplePassConfig, wwdrDer: Buffer | null): Buffer {
  const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(config.certP12Base64));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, config.certPassword);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
  if (!keyBags.length || !certBags.length) {
    throw new Error('Pass certificate .p12 did not contain a key/certificate');
  }

  const key = keyBags[0].key!;
  const cert = certBags[0].cert!;

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestBytes.toString('utf8'));
  p7.addCertificate(cert);
  if (wwdrDer) {
    try {
      const wwdrAsn1 = forge.asn1.fromDer(wwdrDer.toString('binary'));
      p7.addCertificate(forge.pki.certificateFromAsn1(wwdrAsn1));
    } catch {
      // ignore invalid WWDR cert
    }
  }
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha1,
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
}

export async function buildApplePass(card: ApplePassCard, config: ApplePassConfig): Promise<Buffer> {
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeId,
    serialNumber: `${card.slug}-${Date.now()}`,
    teamIdentifier: config.teamId,
    organizationName: 'NownCard',
    description: `${card.name} — digital business card`,
    logoText: card.name,
    foregroundColor: '#FFFFFF',
    backgroundColor: '#391681',
    labelColor: '#f5b940',
    barcode: { format: 'PKBarcodeFormatQR', message: card.cardUrl, messageEncoding: 'iso-8859-1' },
    generic: {
      primaryFields: [{ key: 'name', label: 'Name', value: card.name }],
      secondaryFields: [
        ...(card.company ? [{ key: 'company', label: 'Company', value: card.company }] : []),
        ...(card.jobTitle ? [{ key: 'title', label: 'Title', value: card.jobTitle }] : []),
      ],
      auxiliaryFields: [
        ...(card.phone ? [{ key: 'phone', label: 'Phone', value: card.phone }] : []),
        ...(card.email ? [{ key: 'email', label: 'Email', value: card.email }] : []),
        ...(card.website ? [{ key: 'website', label: 'Website', value: card.website }] : []),
      ],
      backFields: [
        { key: 'url', label: 'Card', value: card.cardUrl },
        ...(card.bio ? [{ key: 'bio', label: 'About', value: card.bio.slice(0, 500) }] : []),
      ],
    },
  };

  const passJsonBuf = Buffer.from(JSON.stringify(passJson), 'utf8');
  const iconBuf = solidPng(116, '#391681');

  const wwdr = await getWwdrIntermediate();
  const manifestBytes = Buffer.from(
    JSON.stringify({
      'pass.json': crypto.createHash('sha1').update(passJsonBuf).digest('hex'),
      'icon.png': crypto.createHash('sha1').update(iconBuf).digest('hex'),
    }),
    'utf8',
  );
  const signature = signManifest(manifestBytes, config, wwdr);

  const zipped = zipSync(
    {
      'pass.json': new Uint8Array(passJsonBuf),
      'icon.png': new Uint8Array(iconBuf),
      'manifest.json': new Uint8Array(manifestBytes),
      'signature': new Uint8Array(signature),
    },
    { level: 9 },
  );

  return Buffer.from(zipped);
}
