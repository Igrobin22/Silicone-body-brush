import assert from 'node:assert/strict';
import { handler as checkout } from '../functions/create-checkout-session/handler.ts';
import { handler as status } from '../functions/checkout-status/handler.ts';
import { handler as webhook, verifyStripeSignature } from '../functions/stripe-webhook/handler.ts';

const orderId = '00000000-0000-4000-8000-000000000001';
const orderNumber = 'PF-261015-ABC123';
const sessionId = 'cs_test_12345678901234567890';
const site = 'https://store.example.test';
const payload = {
  contact: 'test@example.test', phone: '+971500000000', first_name: 'Test', last_name: 'Customer',
  country: 'United Arab Emirates', address: 'Test address', city: 'Dubai', emirate: 'Dubai',
  line_items: [{ id: 'pureform-4pc-set-grey', quantity: 1 }],
};
const paidSession = {
  id: sessionId, mode: 'payment', status: 'complete', currency: 'aed', payment_status: 'paid', amount_total: 7500,
  metadata: { order_id: orderId, order_number: orderNumber }, client_reference_id: orderId, payment_intent: 'pi_test_fixture',
};
const settings = {
  SUPABASE_URL: 'https://backend.example.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only-service-key',
  STRIPE_SECRET_KEY: 'sk_test_fixture_only', STRIPE_WEBHOOK_SECRET: 'whsec_fixture_only', SITE_URL: site,
  STRIPE_PAYMENT_METHOD_CONFIG: 'pmc_fixtureOnly',
};

function request(body: unknown, origin = site) {
  return new Request(site + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
}

async function signature(body: string, time = Math.floor(Date.now() / 1000)) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(settings.STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = await crypto.subtle.sign('HMAC', key, encoder.encode(`${time}.${body}`));
  return `t=${time},v1=${Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('')}`;
}

Deno.test('secure checkout and signed payment handling', async (test) => {
  const previousEnv = Object.fromEntries(Object.keys(settings).map((name) => [name, Deno.env.get(name)]));
  for (const [name, value] of Object.entries(settings)) Deno.env.set(name, value);
  const realFetch = globalThis.fetch;
  let gatewayFailure = false;
  let databaseFailure = false;
  let reservationFailure = false;
  let nonCardMethod = false;
  let session = { ...paidSession };
  const calls: { path: string; body: string; headers: Headers }[] = [];
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    const options = init as RequestInit | undefined;
    calls.push({ path: url.pathname, body: String(options?.body || ''), headers: new Headers(options?.headers) });
    const response = (value: unknown, code = 200) => Promise.resolve(new Response(JSON.stringify(value), { status: code, headers: { 'Content-Type': 'application/json' } }));
    if (url.pathname === '/rest/v1/site_listings') return response([{
      slug: 'pureform-4pc-set-grey', name: 'Grey set', description: 'Public product description', inventory_note: 'INTERNAL INVENTORY NOTE', price: 100, discount: 25, discount_mode: 'ongoing', inventory_quantity: 2, inventory_status: 'in_stock', photo_urls: [],
    }]);
    if (url.pathname === '/rest/v1/site_orders') return response({ id: orderId, order_number: orderNumber });
    if (url.pathname.endsWith('/reserve_site_order') && reservationFailure) return response({ message: 'Not enough stock' }, 409);
    if (url.pathname.endsWith('/apply_paid_site_order') && databaseFailure) return response({ message: 'Database write failed' }, 500);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return response(null);
    if (url.pathname === '/v1/checkout/sessions') return gatewayFailure ? response({ error: {} }, 503) : response({ id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}`, livemode: false, payment_method_types: nonCardMethod ? ['card', 'link'] : ['card'] });
    if (url.pathname === `/v1/checkout/sessions/${sessionId}/expire`) return response({ id: sessionId, status: 'expired' });
    if (url.pathname === `/v1/checkout/sessions/${sessionId}`) return response(session);
    throw new Error('Unexpected mocked request: ' + url);
  };
  try {
    await test.step('checkout fails closed without required setup', async () => {
      Deno.env.delete('STRIPE_WEBHOOK_SECRET');
      assert.equal((await checkout(request(payload))).status, 503);
      Deno.env.set('STRIPE_WEBHOOK_SECRET', settings.STRIPE_WEBHOOK_SECRET);
      Deno.env.delete('STRIPE_PAYMENT_METHOD_CONFIG');
      assert.equal((await checkout(request(payload))).status, 503);
      Deno.env.set('STRIPE_PAYMENT_METHOD_CONFIG', settings.STRIPE_PAYMENT_METHOD_CONFIG);
    });
    await test.step('rejects unapproved origins, foreign delivery and invalid quantities', async () => {
      assert.equal((await checkout(request(payload, 'https://wrong.example.test'))).status, 403);
      assert.equal((await checkout(request({ ...payload, country: 'United States' }))).status, 400);
      assert.equal((await checkout(request(null))).status, 400);
      for (const quantity of [0, -1, 1.5, 21, '2']) {
        assert.equal((await checkout(request({ ...payload, line_items: [{ id: 'grey', quantity }] }))).status, 400);
      }
      assert.equal((await checkout(request({ ...payload, line_items: [{ id: 'grey', quantity: 20 }, { id: 'grey', quantity: 20 }] }))).status, 400);
    });
    await test.step('uses admin prices, AED and cards only; does not store card fields', async () => {
      calls.length = 0;
      const result = await checkout(request({ ...payload, total: 0.01, shipping_total: 0, card_number: 'must-not-be-stored' }));
      assert.equal(result.status, 200);
      const stripe = calls.find((call) => call.path === '/v1/checkout/sessions')!;
      const params = new URLSearchParams(stripe.body);
      assert.equal(params.get('line_items[0][price_data][unit_amount]'), '7500');
      assert.equal(params.get('line_items[0][price_data][currency]'), 'aed');
      assert.equal(params.get('payment_method_types[0]'), null);
      assert.equal(params.get('payment_method_configuration'), settings.STRIPE_PAYMENT_METHOD_CONFIG);
      assert.equal(params.get('shipping_address_collection[allowed_countries][0]'), 'AE');
      assert.equal(params.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '1000');
      assert.equal(params.get('shipping_options[0][shipping_rate_data][fixed_amount][currency]'), 'aed');
      assert.equal(stripe.headers.get('Idempotency-Key'), orderId);
      assert(calls.findIndex((call) => call.path.endsWith('/reserve_site_order')) < calls.indexOf(stripe));
      const saved = JSON.parse(calls.find((call) => call.path === '/rest/v1/site_orders')!.body);
      assert.equal(saved.subtotal, 75);
      assert.equal(saved.shipping_total, 10);
      assert.equal(saved.total, 85);
      assert.equal(saved.source, 'stripe_sandbox');
      assert.equal(params.get('line_items[0][price_data][product_data][description]'), 'Public product description');
      const attached = calls.find((call) => call.path === '/rest/v1/site_orders' && call.body.includes('payment_session_id'))!;
      assert.equal(JSON.parse(attached.body).source, 'stripe_sandbox');
      assert(!('card_number' in saved));
    });
    await test.step('public setup reports AED 10 shipping without exposing credentials', async () => {
      const response = await status(new Request(site + '/checkout', { headers: { Origin: site } }));
      assert.deepEqual(await response.json(), { configured: true, shipping_total: 10, currency: 'AED' });
    });
    await test.step('stock conflicts do not create a payment session', async () => {
      calls.length = 0; reservationFailure = true;
      assert.equal((await checkout(request(payload))).status, 409);
      assert(!calls.some((call) => call.path === '/v1/checkout/sessions'));
      reservationFailure = false;
    });
    await test.step('non-card gateway configurations expire sessions and release stock', async () => {
      calls.length = 0; nonCardMethod = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(calls.some((call) => call.path.endsWith('/expire')));
      assert(calls.some((call) => call.path.endsWith('/release_site_order')));
      assert(!calls.some((call) => call.path === '/rest/v1/site_orders' && call.body.includes('payment_session_id')));
      nonCardMethod = false;
    });
    await test.step('gateway failures release stock and return JSON', async () => {
      calls.length = 0; gatewayFailure = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(calls.some((call) => call.path.endsWith('/release_site_order')));
      gatewayFailure = false;
    });
    await test.step('payment status verifies session and order before confirming', async () => {
      const response = await status(request({ session_id: sessionId, order_number: orderNumber }));
      assert.deepEqual(await response.json(), { paid: true, order_number: orderNumber });
      assert.equal((await status(request({ session_id: sessionId, order_number: 'PF-WRONG123' }))).status, 400);
      session = { ...paidSession, payment_status: 'unpaid' };
      assert.equal((await (await status(request({ session_id: sessionId, order_number: orderNumber }))).json()).paid, false);
      session = { ...paidSession };
    });
    await test.step('rejects unsigned, stale and modified webhooks', async () => {
      assert.equal((await webhook(request({ type: 'checkout.session.completed' }))).status, 400);
      const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: paidSession } });
      await assert.rejects(verifyStripeSignature(body, await signature(body, Math.floor(Date.now() / 1000) - 600), settings.STRIPE_WEBHOOK_SECRET));
      await assert.rejects(verifyStripeSignature(body + ' ', await signature(body), settings.STRIPE_WEBHOOK_SECRET));
    });
    await test.step('only settled sessions update orders; database errors trigger retries', async () => {
      async function deliver(type: string, object: unknown) {
        const body = JSON.stringify({ type, data: { object } });
        return webhook(new Request(site + '/webhook', { method: 'POST', headers: { 'stripe-signature': await signature(body) }, body }));
      }
      calls.length = 0;
      assert.equal((await deliver('checkout.session.completed', { ...paidSession, payment_status: 'unpaid' })).status, 200);
      assert(!calls.some((call) => call.path.endsWith('/apply_paid_site_order')));
      assert.equal((await deliver('checkout.session.completed', paidSession)).status, 200);
      databaseFailure = true;
      assert.equal((await deliver('checkout.session.completed', paidSession)).status, 500);
      databaseFailure = false;
      assert.equal((await deliver('checkout.session.expired', { ...paidSession, status: 'expired', payment_status: 'unpaid' })).status, 200);
      assert(calls.some((call) => call.path.endsWith('/release_site_order')));
    });
  } finally {
    globalThis.fetch = realFetch;
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
});
