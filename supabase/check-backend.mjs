import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const scope = { window: {} };
vm.runInNewContext(await readFile(new URL('../assets/pureform-supabase-config.js', import.meta.url), 'utf8'), scope);
const config = scope.window.PUREFORM_SUPABASE_CONFIG;
const headers = { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` };
let failures = 0;
async function check(label, url, expected, auth = true) {
  try {
    const response = await fetch(url, { headers: auth ? headers : {}, signal: AbortSignal.timeout(15000) });
    const ok = (Array.isArray(expected) ? expected : [expected]).includes(response.status);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: HTTP ${response.status}`);
    if (!ok) failures++;
    return ok ? response : null;
  } catch (error) {
    failures++;
    console.log(`FAIL ${label}: ${error.cause?.code || error.message}`);
    return null;
  }
}

const base = String(config.url).replace(/\/+$/, '');
const products = await check('Public product catalog', base + '/rest/v1/site_listings?select=slug&visible=eq.true', 200);
if (products) {
  const rows = await products.json();
  const present = new Set(rows.map((row) => row.slug));
  const missing = ['grey', 'black', 'pink'].filter((color) => !present.has(`pureform-4pc-set-${color}`));
  console.log(`${missing.length ? 'FAIL' : 'PASS'} Canonical sets: ${missing.length ? 'missing ' + missing.join(', ') : 'Grey, Black and Pink present'}`);
  if (missing.length) failures++;
}
const health = await check('Checkout configuration', base + '/functions/v1/checkout-status', 200);
if (health) {
  const setup = await health.json();
  if (setup.configured !== true) { failures++; console.log('FAIL Checkout secrets or SITE_URL are incomplete'); }
  const shippingReady = setup.currency === 'AED' && setup.shipping_total === config.shippingFeeAED;
  console.log(`${shippingReady ? 'PASS' : 'FAIL'} Server/storefront delivery agreement: ${shippingReady ? 'AED ' + setup.shipping_total : 'deploy the approved shipping configuration'}`);
  if (!shippingReady) failures++;
}
await check('Anonymous order access denied', base + '/rest/v1/site_orders?select=id&limit=0', [401, 403]);
await check('Checkout creation requires Supabase JWT', base + '/functions/v1/create-checkout-session', 401, false);
await check('Checkout status requires Supabase JWT', base + '/functions/v1/checkout-status', 401, false);
await check('Signed webhook deployed without Supabase JWT requirement', base + '/functions/v1/stripe-webhook', 405, false);
console.log('Read-only checks only. These do not replace a hosted Stripe sandbox purchase or webhook test.');
process.exitCode = failures ? 1 : 0;
