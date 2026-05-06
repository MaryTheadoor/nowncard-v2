/**
 * Square API test script
 *
 * Usage:
 *   SQUARE_ACCESS_TOKEN=your_token SQUARE_ENVIRONMENT=sandbox node scripts/test-square.js
 *
 * This verifies your Square credentials and lists recent payments.
 */

import { Client, Environment } from 'square';

const token = process.env.SQUARE_ACCESS_TOKEN;
const env = process.env.SQUARE_ENVIRONMENT === 'production' ? Environment.Production : Environment.Sandbox;

if (!token) {
  console.error('❌ Set SQUARE_ACCESS_TOKEN environment variable');
  process.exit(1);
}

const client = new Client({
  accessToken: token,
  environment: env,
});

async function main() {
  try {
    // Test 1: List locations (verifies auth)
    const { result: locations } = await client.locationsApi.listLocations();
    console.log(`✅ Auth OK — ${locations.locations?.length || 0} location(s) found`);
    locations.locations?.forEach((loc) => {
      console.log(`   • ${loc.name} (${loc.id}) — ${loc.status}`);
    });

    // Test 2: List recent payments
    const { result: payments } = await client.paymentsApi.listPayments();
    console.log(`✅ Payments API OK — ${payments.payments?.length || 0} recent payment(s)`);

    // Test 3: Create a test payment link (sandbox only)
    if (env === Environment.Sandbox) {
      const { result: link } = await client.checkoutApi.createPaymentLink({
        idempotencyKey: `test-${Date.now()}`,
        quickPay: {
          name: 'NownCard Pro — Test',
          priceMoney: { amount: BigInt(1900), currency: 'USD' },
          locationId: locations.locations?.[0]?.id || '',
        },
      });
      console.log(`✅ Payment Link created: ${link.paymentLink?.url}`);
    }

    console.log('\n🎉 All Square API tests passed!');
  } catch (err) {
    console.error('❌ Square API error:', err.message || err);
    process.exit(1);
  }
}

main();
