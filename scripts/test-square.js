/**
 * Square API test script
 *
 * Usage:
 *   node scripts/test-square.js
 *
 * Loads credentials from functions/.env (production token from the Square
 * dashboard) and resolves the `square` SDK from the functions package so it
 * exercises the SAME SDK version and call shapes as the deployed Cloud
 * Functions (square@38: locationsApi / checkoutApi / paymentsApi).
 *
 * Verifies auth, lists locations, lists recent payments, and — mirroring the
 * createCheckout Cloud Function — resolves an ACTIVE location and creates a
 * payment link (no charge; the link is unused).
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
// Resolve square from the functions package to match the deployed SDK.
const functionsRequire = createRequire(path.join(here, '..', 'functions', 'package.json'));
const { Client, Environment } = functionsRequire('square');

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(here, '..', 'functions', '.env'));

const token = process.env.SQUARE_ACCESS_TOKEN;
const env = process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox;

if (!token) {
  console.error('❌ Set SQUARE_ACCESS_TOKEN in functions/.env');
  process.exit(1);
}

const client = new Client({ accessToken: token, environment: env });

async function main() {
  // Test 1: List locations (verifies auth) — mirrors resolveLocationId()
  const { result: locations } = await client.locationsApi.listLocations();
  console.log(`✅ Auth OK — ${locations.locations?.length || 0} location(s) found`);
  locations.locations?.forEach((loc) => {
    console.log(`   • ${loc.name} (${loc.id}) — ${loc.status}`);
  });

  const active = locations.locations?.find((l) => l.status === 'ACTIVE');
  const locationId = active?.id || locations.locations?.[0]?.id || '';
  if (!locationId) {
    console.error('❌ No Square location found');
    process.exit(1);
  }
  console.log(`   → using ${active ? 'ACTIVE' : 'fallback'} location ${locationId}`);

  // Test 2: List recent payments
  const { result: payments } = await client.paymentsApi.listPayments();
  console.log(`✅ Payments API OK — ${payments.payments?.length || 0} recent payment(s)`);

  // Test 3: Create a payment link exactly like createCheckout does (no charge)
  const { result: link } = await client.checkoutApi.createPaymentLink({
    idempotencyKey: `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    quickPay: {
      name: 'NownCard Pro — Test',
      priceMoney: { amount: BigInt(1900), currency: 'USD' },
      locationId,
    },
    checkoutOptions: {
      redirectUrl: 'https://nowncard.com/success',
    },
    paymentNote: 'NownCard checkout smoke test',
  });
  console.log(`✅ Payment Link created (no charge): ${link.paymentLink?.url}`);
  console.log(`   orderId: ${link.paymentLink?.orderId ?? 'null (set when buyer checks out)'}`);

  console.log('\n🎉 All Square API tests passed!');
}

main().catch((err) => {
  console.error('❌ Square API error:', err.message || err);
  process.exit(1);
});
