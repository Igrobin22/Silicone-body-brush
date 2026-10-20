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
  let gatewayStatus = 200;
  let gatewayErrorType = 'invalid_request_error';
  let transportFailures = 0;
  let malformedGateway = false;
  let databaseFailure = false;
  let attachmentFailure = false;
  let reservationFailure = false;
  let releaseFailure = false;
  let nonCardMethod = false;
  let expiryFailure = false;
  let expiryWrongOrder = false;
  let expiryMalformed = false;
  let rateWait = 0;
  let limitFailure = false;
  let refundFailure = false;
  let session = { ...paidSession };
  let discountMode = 'ongoing';
  let discountStartsAt: string | null = null;
  let discountEndsAt: string | null = null;
  const realConsoleError = console.error;
  const alerts: string[] = [];
  console.error = (value: unknown) => { alerts.push(String(value)); };
  const calls: { path: string; query: URLSearchParams; body: string; headers: Headers }[] = [];
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    const options = init as RequestInit | undefined;
    calls.push({ path: url.pathname, query: url.searchParams, body: String(options?.body || ''), headers: new Headers(options?.headers) });
    const response = (value: unknown, code = 200) => Promise.resolve(new Response(JSON.stringify(value), { status: code, headers: { 'Content-Type': 'application/json' } }));
    if (url.pathname === '/rest/v1/site_listings') return response(['grey','pink'].map(color=>({
      slug: 'pureform-4pc-set-'+color, name: color+' set', description: 'Public product description', inventory_note: 'INTERNAL INVENTORY NOTE', price: 100, discount: 25, discount_mode: discountMode, discount_starts_at: discountStartsAt, discount_ends_at: discountEndsAt, inventory_quantity: 2, inventory_status: 'in_stock', photo_urls: [],
    })));
    if (url.pathname === '/rest/v1/site_orders') {
      if (options?.method === 'PATCH' && String(options.body).includes('payment_session_id') && attachmentFailure) return response({ message: 'Attachment failed' }, 500);
      return response({ id: orderId, order_number: orderNumber });
    }
    if (url.pathname.endsWith('/reserve_site_order') && reservationFailure) return response({ message: 'Not enough stock' }, 409);
    if (url.pathname.endsWith('/release_site_order') && releaseFailure) return response({ message: 'Release failed' }, 500);
    if (url.pathname.endsWith('/apply_paid_site_order') && databaseFailure) return response({ message: 'Database write failed' }, 500);
    if (url.pathname.endsWith('/check_site_checkout_limit')) return limitFailure ? response({message:'Unavailable'},503) : response(rateWait);
    if (url.pathname.endsWith('/record_site_refund') && refundFailure) return response({message:'Unavailable'},500);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return response(null);
    if (url.pathname === '/v1/checkout/sessions') {
      if (transportFailures > 0) {
        transportFailures--;
        return Promise.reject(new TypeError('Connection lost with private gateway information'));
      }
      if (malformedGateway) return Promise.resolve(new Response('Gateway response truncated', { status: 200 }));
      return gatewayStatus !== 200
        ? response({ error: { type: gatewayErrorType, message: 'Private gateway error' } }, gatewayStatus)
        : response({ id: sessionId, url: `https://checkout.stripe.com/c/pay/${sessionId}`, livemode: false, payment_method_types: nonCardMethod ? ['card', 'link'] : ['card'] });
    }
    if (url.pathname === `/v1/checkout/sessions/${sessionId}/expire`) {
      if (expiryFailure) return response({ error: { type: 'invalid_request_error' } }, 400);
      if (expiryMalformed) return response({ id: sessionId });
      return response({ ...paidSession, status: 'expired', payment_status: 'unpaid', client_reference_id: expiryWrongOrder ? 'another-order' : orderId });
    }
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
    await test.step('two validated sets waive delivery for matching, mixed or duplicate cart lines', async () => {
      for (const line_items of [[{id:'grey',quantity:2}],[{id:'grey',quantity:1},{id:'pink',quantity:1}],[{id:'grey',quantity:1},{id:'grey',quantity:1}]]) {
        calls.length=0;
        assert.equal((await checkout(request({...payload,line_items,shipping_total:999,total:0.01}))).status,200);
        const params=new URLSearchParams(calls.find(call=>call.path==='/v1/checkout/sessions')!.body);
        const saved=JSON.parse(calls.find(call=>call.path==='/rest/v1/site_orders')!.body);
        assert.equal(params.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'),'0');
        assert.equal(saved.subtotal,150); assert.equal(saved.shipping_total,0); assert.equal(saved.total,150);
      }
    });
    await test.step('public setup reports the full delivery policy without exposing credentials', async () => {
      const response = await status(new Request(site + '/checkout', { headers: { Origin: site } }));
      assert.deepEqual(await response.json(), { configured: true, shipping_total: 10, free_shipping_min_sets: 2, currency: 'AED' });
    });
    await test.step('oversized bodies and durable rate limits fail before stock or gateway requests', async () => {
      calls.length = 0;
      assert.equal((await checkout(request({...payload, customer_notes:'x'.repeat(17000)}))).status,413);
      assert.equal(calls.length,0);
      rateWait = 123;
      const blocked = await checkout(request(payload));
      assert.equal(blocked.status,429);
      assert.equal(blocked.headers.get('Retry-After'),'123');
      assert(!calls.some(call=>call.path === '/rest/v1/site_orders' || call.path.startsWith('/v1/')));
      const fingerprint = JSON.parse(calls[0].body);
      assert.match(fingerprint.p_phone_hash,/^[a-f0-9]{64}$/);
      assert(!calls[0].body.includes(payload.phone));
      assert(!calls[0].body.includes(payload.contact));
      rateWait = 0; limitFailure = true;
      assert.equal((await checkout(request(payload))).status,503);
      limitFailure = false;
    });
    await test.step('future and expired catalog offers are not discounted at the gateway', async () => {
      discountMode = 'fixed';
      for (const future of [true, false]) {
        calls.length = 0;
        discountStartsAt = future ? new Date(Date.now() + 86400000).toISOString() : null;
        discountEndsAt = future ? null : new Date(Date.now() - 86400000).toISOString();
        assert.equal((await checkout(request(payload))).status, 200);
        const stripe = calls.find(call => call.path === '/v1/checkout/sessions')!;
        assert.equal(new URLSearchParams(stripe.body).get('line_items[0][price_data][unit_amount]'), '10000');
        const saved = JSON.parse(calls.find(call => call.path === '/rest/v1/site_orders')!.body);
        assert.equal(saved.line_items[0].discount, 0);
        assert.equal(saved.total, 110);
      }
      discountMode = 'ongoing'; discountStartsAt = null; discountEndsAt = null;
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
    await test.step('definite gateway rejections release stock without exposing gateway errors', async () => {
      for (const code of [400, 401, 403, 404, 429]) {
        calls.length = 0; gatewayStatus = code;
        const result = await checkout(request(payload));
        assert.equal(result.status, 502);
        assert(calls.some((call) => call.path.endsWith('/release_site_order')));
        assert(!JSON.stringify(await result.json()).includes('Private gateway error'));
      }
      gatewayStatus = 200;
    });
    await test.step('idempotency conflicts and unrecognized errors keep the original hold', async () => {
      for (const [code, type] of [[409, 'invalid_request_error'], [400, 'idempotency_error'], [400, 'api_error']] as const) {
        calls.length = 0; gatewayStatus = code; gatewayErrorType = type;
        assert.equal((await checkout(request(payload))).status, 502);
        assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      }
      gatewayStatus = 200; gatewayErrorType = 'invalid_request_error';
    });
    await test.step('server failures retain stock and flag the order for reconciliation', async () => {
      calls.length = 0; alerts.length = 0; gatewayStatus = 503;
      const result = await checkout(request(payload));
      assert.equal(result.status, 502);
      const body = await result.json();
      assert(body.error.includes(orderNumber));
      assert(!body.error.includes('No payment was taken'));
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      const note = calls.find((call) => call.path === '/rest/v1/site_orders' && call.body.includes('admin_notes'))!;
      assert(note.body.includes('Stock is retained'));
      assert.equal(note.query.get('admin_notes'), 'eq.');
      assert.equal(note.query.get('payment_status'), 'eq.requires_payment');
      assert.equal(JSON.parse(alerts[0]).reason, 'gateway_outcome_unknown');
      assert(!alerts.join('').includes(payload.contact));
      assert(!alerts.join('').includes('Private gateway error'));
      gatewayStatus = 200;
    });
    await test.step('a lost create response replays exactly the same idempotent request', async () => {
      calls.length = 0; transportFailures = 1;
      assert.equal((await checkout(request(payload))).status, 200);
      const creates = calls.filter((call) => call.path === '/v1/checkout/sessions');
      assert.equal(creates.length, 2);
      assert.equal(creates[0].body, creates[1].body);
      assert.equal(creates[0].headers.get('Idempotency-Key'), creates[1].headers.get('Idempotency-Key'));
      assert.equal(calls.filter((call) => call.path.endsWith('/reserve_site_order')).length, 1);
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
    });
    await test.step('exhausted transport retries never release a potentially payable session', async () => {
      calls.length = 0; alerts.length = 0; transportFailures = 2;
      assert.equal((await checkout(request(payload))).status, 502);
      assert.equal(calls.filter((call) => call.path === '/v1/checkout/sessions').length, 2);
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      assert.equal(JSON.parse(alerts[0]).reason, 'gateway_outcome_unknown');
      assert(!alerts.join('').includes('private gateway information'));
      transportFailures = 0;
    });
    await test.step('a rejection after an uncertain attempt does not prove the first request failed', async () => {
      calls.length = 0; transportFailures = 1; gatewayStatus = 429;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      gatewayStatus = 200;
    });
    await test.step('truncated successful responses retain their reservations', async () => {
      calls.length = 0; malformedGateway = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      malformedGateway = false;
    });
    await test.step('failed session attachment expires the matching session before releasing', async () => {
      calls.length = 0; attachmentFailure = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(calls.findIndex((call) => call.path.endsWith('/expire')) < calls.findIndex((call) => call.path.endsWith('/release_site_order')));
      assert(calls.some((call) => call.path.endsWith('/release_site_order')));
      attachmentFailure = false;
    });
    await test.step('a lost expiry response is checked before releasing stock', async () => {
      calls.length = 0; attachmentFailure = true; expiryFailure = true;
      session = { ...paidSession, status: 'expired', payment_status: 'unpaid' };
      assert.equal((await checkout(request(payload))).status, 502);
      assert(calls.some((call) => call.path === `/v1/checkout/sessions/${sessionId}`));
      assert(calls.some((call) => call.path.endsWith('/release_site_order')));
      attachmentFailure = false; expiryFailure = false; session = { ...paidSession };
    });
    await test.step('a payment racing expiry is recorded and never releases stock', async () => {
      calls.length = 0; alerts.length = 0; attachmentFailure = true; expiryFailure = true;
      const result = await checkout(request(payload));
      assert.equal(result.status, 409);
      assert((await result.json()).error.includes('Do not pay again'));
      assert(calls.some((call) => call.path.endsWith('/apply_paid_site_order')));
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      assert.equal(alerts.length, 0);
      attachmentFailure = false; expiryFailure = false;
    });
    await test.step('a failed paid-state write retains stock for the signed webhook retry', async () => {
      calls.length = 0; attachmentFailure = true; expiryFailure = true; databaseFailure = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert(calls.some((call) => call.path.endsWith('/apply_paid_site_order')));
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      attachmentFailure = false; expiryFailure = false; databaseFailure = false;
    });
    await test.step('unconfirmed expiry, a different order or an open session retain stock', async () => {
      for (const malformed of [false, true]) {
        calls.length = 0; attachmentFailure = true; expiryWrongOrder = true; expiryMalformed = malformed;
        session = { ...paidSession, status: 'open', payment_status: 'unpaid' };
        assert.equal((await checkout(request(payload))).status, 502);
        assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      }
      calls.length = 0;
      session = { ...paidSession, client_reference_id: 'another-order' };
      assert.equal((await checkout(request(payload))).status, 502);
      assert(!calls.some((call) => call.path.endsWith('/apply_paid_site_order')));
      assert(!calls.some((call) => call.path.endsWith('/release_site_order')));
      attachmentFailure = false; expiryWrongOrder = false; expiryMalformed = false; session = { ...paidSession };
    });
    await test.step('stock release failures are flagged rather than silently discarded', async () => {
      calls.length = 0; alerts.length = 0; gatewayStatus = 400; releaseFailure = true;
      assert.equal((await checkout(request(payload))).status, 502);
      assert.equal(JSON.parse(alerts[0]).reason, 'stock_release_failed');
      assert(calls.some((call) => call.path === '/rest/v1/site_orders' && call.body.includes('stock release could not be confirmed')));
      gatewayStatus = 200; releaseFailure = false;
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
    await test.step('signed refund events persist only the refund fields and request retries on database failures', async () => {
      const refund = {id:'re_fixture',payment_intent:'pi_test_fixture',amount:2500,currency:'aed',status:'succeeded',card_number:'never-store'};
      async function deliver(object: unknown) {
        const body=JSON.stringify({type:'refund.updated',livemode:false,created:100,data:{object}});
        return webhook(new Request(site+'/webhook',{method:'POST',headers:{'stripe-signature':await signature(body)},body}));
      }
      calls.length=0;
      assert.equal((await deliver(refund)).status,200);
      const saved=JSON.parse(calls.find(call=>call.path.endsWith('/record_site_refund'))!.body);
      assert.deepEqual(saved,{p_refund_id:'re_fixture',p_payment_intent_id:'pi_test_fixture',p_amount_minor:2500,p_currency:'aed',p_status:'succeeded',p_livemode:false,p_event_created:100});
      assert.equal((await deliver({...refund,amount:1.5})).status,400);
      refundFailure=true;
      assert.equal((await deliver(refund)).status,500);
      refundFailure=false;
    });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realConsoleError;
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value);
    }
  }
});
