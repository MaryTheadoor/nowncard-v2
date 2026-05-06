/**
 * List Stripe Products & Prices
 *
 * Run this to see what's already in your Stripe account before running setup.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_xxx npm run stripe:list
 */

import Stripe from 'stripe';

const SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
if (!SECRET_KEY) {
  console.error('❌ Set STRIPE_SECRET_KEY environment variable');
  process.exit(1);
}

const stripe = new Stripe(SECRET_KEY, {
  apiVersion: '2026-04-22.dahlia',
});

async function main() {
  console.log('\n📋 Stripe Products & Prices\n');
  console.log(`Mode: ${SECRET_KEY.startsWith('sk_live') ? '🔴 LIVE' : '🟢 TEST'}\n`);

  const products = await stripe.products.list({ limit: 100, active: true });

  if (products.data.length === 0) {
    console.log('No active products found.\n');
    return;
  }

  for (const product of products.data) {
    console.log(`Product: ${product.name}`);
    console.log(`  ID: ${product.id}`);
    console.log(`  Description: ${product.description || '(none)'}`);

    const prices = await stripe.prices.list({ product: product.id, limit: 10 });
    for (const price of prices.data) {
      const amount = (price.unit_amount ?? 0) / 100;
      const currency = price.currency.toUpperCase();
      const recurring = price.recurring
        ? `${price.recurring.interval_count ?? 1}/${price.recurring.interval}`
        : 'one-time';
      const lookup = price.lookup_key ? ` (lookup: ${price.lookup_key})` : '';
      console.log(`  Price: ${price.id} — $${amount} ${currency} ${recurring}${lookup}`);
    }
    console.log('');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
