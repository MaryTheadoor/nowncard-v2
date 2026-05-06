/**
 * Setup Stripe Products & Prices for NownCard
 *
 * This script creates (or finds existing) Stripe products and recurring yearly
 * prices for the Pro and Business plans. Run it once per Stripe environment
 * (test mode, then live mode).
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/setup-stripe-products.ts
 *
 * It will print the Price IDs you need for your .env file:
 *   VITE_STRIPE_PRICE_PRO=price_xxx
 *   VITE_STRIPE_PRICE_BUSINESS=price_xxx
 */

import Stripe from 'stripe';
import * as fs from 'fs';
import * as path from 'path';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
if (!SECRET_KEY) {
  console.error('❌ Set STRIPE_SECRET_KEY environment variable');
  console.error('   Example: STRIPE_SECRET_KEY=sk_test_xxx npx tsx scripts/setup-stripe-products.ts');
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

interface PlanConfig {
  name: string;
  description: string;
  lookupKey: string;
  amountCents: number;
  currency: string;
}

const PLANS: Record<string, PlanConfig> = {
  pro: {
    name: 'NownCard Pro',
    description: 'Up to 5 cards, custom fonts, analytics, no branding',
    lookupKey: 'nowncard_pro_yearly',
    amountCents: 1900, // $19.00
    currency: 'usd',
  },
  business: {
    name: 'NownCard Business',
    description: 'Unlimited cards, team cards, white-label, custom fonts',
    lookupKey: 'nowncard_business_yearly',
    amountCents: 3900, // $39.00
    currency: 'usd',
  },
};

async function findExistingPrice(lookupKey: string): Promise<string | null> {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    limit: 1,
  });
  return prices.data[0]?.id ?? null;
}

async function createOrUpdatePlan(planKey: string, config: PlanConfig): Promise<string> {
  // 1. Check if a price with this lookup_key already exists
  const existingPriceId = await findExistingPrice(config.lookupKey);
  if (existingPriceId) {
    console.log(`  ✅ ${config.name}: price already exists`);
    console.log(`     Price ID: ${existingPriceId}`);
    return existingPriceId;
  }

  // 2. Create the product
  const product = await stripe.products.create({
    name: config.name,
    description: config.description,
  });
  console.log(`  🆕 ${config.name}: product created`);

  // 3. Create the recurring yearly price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: config.amountCents,
    currency: config.currency,
    recurring: { interval: 'year' },
    lookup_key: config.lookupKey,
    // tax_behavior: 'exclusive', // Uncomment if you use Stripe Tax
  });
  console.log(`  🆕 ${config.name}: yearly price created`);
  console.log(`     Price ID: ${price.id}`);

  return price.id;
}

async function main() {
  console.log('\n🚀 NownCard Stripe Product Setup\n');
  console.log(`Mode: ${SECRET_KEY.startsWith('sk_live') ? '🔴 LIVE' : '🟢 TEST'}\n`);

  const results: Record<string, string> = {};

  for (const [key, config] of Object.entries(PLANS)) {
    try {
      const priceId = await createOrUpdatePlan(key, config);
      results[key] = priceId;
    } catch (err) {
      console.error(`  ❌ Failed to create ${config.name}:`, (err as Error).message);
      process.exitCode = 1;
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log('Copy these into your .env file:\n');
  console.log(`VITE_STRIPE_PRICE_PRO=${results.pro || 'price_xxx'}`);
  console.log(`VITE_STRIPE_PRICE_BUSINESS=${results.business || 'price_xxx'}`);
  console.log('────────────────────────────────────────\n');

  // Optionally write to .env
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const hasPro = envContent.includes('VITE_STRIPE_PRICE_PRO=');
    const hasBusiness = envContent.includes('VITE_STRIPE_PRICE_BUSINESS=');

    if (!hasPro || !hasBusiness) {
      const lines: string[] = [];
      if (!hasPro) lines.push(`VITE_STRIPE_PRICE_PRO=${results.pro}`);
      if (!hasBusiness) lines.push(`VITE_STRIPE_PRICE_BUSINESS=${results.business}`);
      fs.appendFileSync(envPath, '\n' + lines.join('\n') + '\n');
      console.log('✅ Auto-appended Price IDs to .env\n');
    } else {
      console.log('ℹ️  .env already contains Price IDs. Update them manually if needed.\n');
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
