const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, '../checkout.html'), 'utf8');
const checkoutSource = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const cartSource = readFileSync(path.join(__dirname, '../assets/pureform-cart.js'), 'utf8');
const grey = 'pureform-4pc-set-grey';
const order = 'PF-261017-ABC123';
const session = 'cs_test_12345678901234567890';
const successQuery = `?payment=success&order=${order}&session_id=${session}`;
const copy = value => JSON.parse(JSON.stringify(value));
const settle = () => new Promise(resolve => setImmediate(resolve));

function element() {
  return {
    value: '', textContent: '', disabled: false, hidden: false, children: [], attributes: {}, listeners: {},
    classList: { toggle() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name]; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); },
    replaceChildren() { this.children = []; },
    closest() { return this; },
    checkValidity() { return true; },
    reset() { this.resets = (this.resets || 0) + 1; }
  };
}

function fixture({ search = '', fetch = async () => ({ ok: true, json: async () => ({}) }), config = true,
  setup = { configured: true, shipping_total: 10, currency: 'AED' } } = {}) {
  const ids = {};
  const events = {};
  const calls = [];
  const setupCalls = [];
  const redirects = [];
  const history = [];
  const storage = new Map([['pureform.cart.v1', JSON.stringify([{ id: grey, quantity: 2 }])]]);
  const catalog = {
    [grey]: { id: grey, name: 'Grey set', price: 43.89, image: 'grey.png', meta: '4 tools', inventory_quantity: 24, inventory_status: 'in_stock' }
  };
  const document = {
    readyState: 'complete', title: 'Checkout',
    getElementById(id) { return ids[id] || (ids[id] = element()); },
    querySelector() { return element(); }, querySelectorAll() { return []; }, createElement: element
  };
  const window = {
    PUREFORM_SUPABASE_CONFIG: config ? { url: 'https://backend.example.test', anonKey: 'public-fixture-key' } : {},
    PureFormCatalog: { getCatalogSync: () => catalog },
    location: { search, pathname: '/checkout.html', assign(url) { redirects.push(url); } },
    history: { replaceState(...args) { history.push(args); window.location.search = ''; } },
    addEventListener(name, callback) { (events[name] ||= []).push(callback); },
    dispatchEvent(event) { for (const callback of events[event.type] || []) callback(event); }
  };
  const context = vm.createContext({
    window, document, URL, URLSearchParams, AbortSignal,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    FormData: class { get(name) { return name === 'country' ? 'United Arab Emirates' : name === 'emirate' ? 'Dubai' : 'Fixture'; } },
    fetch: async (...args) => {
      if (args[1]?.method === 'GET') {
        setupCalls.push(args);
        return { ok: true, json: async () => setup };
      }
      calls.push(args);
      return fetch(...args);
    }
  });
  document.getElementById('checkout-country').value = 'United Arab Emirates';
  document.getElementById('checkout-emirate').value = 'Dubai';
  document.getElementById('checkoutVerifyPayment').hidden = true;
  new vm.Script(cartSource).runInContext(context);
  new vm.Script(checkoutSource).runInContext(context);
  return { ids, calls, setupCalls, redirects, history, window, cart: window.PureFormCart,
    submit: () => ids.checkoutForm.listeners.submit({ preventDefault() {} }),
    retry: () => ids.checkoutVerifyPayment.listeners.click() };
}

test('forged success links never clear the cart or start another payment', async () => {
  const page = fixture({ search: '?payment=success' });
  await settle();
  assert.equal(page.cart.getCount(), 2);
  assert.equal(page.calls.length, 0);
  assert.equal(page.ids.checkoutSubmit.disabled, true);
  assert.equal(page.ids.checkoutVerifyPayment.hidden, true);
  await page.submit();
  assert.equal(page.calls.length, 0);
});

for (const [name, reply] of [
  ['unpaid', async () => ({ ok: true, json: async () => ({ paid: false, order_number: order }) })],
  ['mismatched order', async () => ({ ok: true, json: async () => ({ paid: true, order_number: 'PF-WRONG' }) })],
  ['server failure', async () => ({ ok: false, json: async () => ({ paid: true, order_number: order }) })],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw Error('Invalid response'); } })],
  ['network failure', async () => { throw Error('Private gateway diagnostics'); }]
]) {
  test(`${name} keeps the cart and offers verification without a second charge`, async () => {
    const page = fixture({ search: successQuery, fetch: reply });
    await settle();
    assert.equal(page.cart.getCount(), 2);
    assert.equal(page.ids.checkoutSubmit.disabled, true);
    assert.equal(page.ids.checkoutVerifyPayment.hidden, false);
    assert.match(page.ids.checkoutStatus.textContent, /contact support before paying again/);
    assert.doesNotMatch(page.ids.checkoutStatus.textContent, /Private gateway diagnostics/);
    assert.equal(page.history.length, 0);
    assert.ok(page.calls.every(([url]) => url.endsWith('/checkout-status')));
  });
}

test('a verified retry clears the cart once and removes callback parameters', async () => {
  let verified = false;
  const page = fixture({ search: successQuery, fetch: async () => ({ ok: true, json: async () => ({ paid: verified, order_number: order }) }) });
  await settle();
  verified = true;
  await page.retry();
  assert.equal(page.cart.getCount(), 0);
  assert.equal(page.ids.checkoutForm.resets, 1);
  assert.equal(page.ids.checkoutVerifyPayment.hidden, true);
  assert.equal(page.ids.checkoutSubmit.disabled, true);
  assert.match(page.ids.checkoutStatus.textContent, /Payment confirmed for PF-261017-ABC123/);
  assert.equal(page.history[0][2], '/checkout.html');
  assert.deepEqual(JSON.parse(page.calls[1][1].body), { session_id: session, order_number: order });
  await page.retry();
  assert.equal(page.calls.length, 2);
  assert.equal(page.ids.checkoutForm.resets, 1);
});

test('verification stays single-flight while cart or catalog events fire', async () => {
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const page = fixture({ search: successQuery, fetch: () => response });
  await page.retry();
  page.window.dispatchEvent({ type: 'pureform:cart-change' });
  assert.equal(page.ids.checkoutSubmit.disabled, true);
  assert.equal(page.calls.length, 1);
  resolve({ ok: true, json: async () => ({ paid: true, order_number: order }) });
  await settle();
  assert.equal(page.cart.getCount(), 0);
});

test('cancelled payment leaves cart intact without verifying or claiming success', () => {
  const page = fixture({ search: '?payment=cancelled&order=' + order });
  assert.equal(page.cart.getCount(), 2);
  assert.equal(page.calls.length, 0);
  assert.match(page.ids.checkoutStatus.textContent, /cancelled/);
  assert.equal(page.history[0][2], '/checkout.html');
});

test('checkout sends only canonical quantities and blocks duplicate submissions', async () => {
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const page = fixture({ fetch: () => response });
  const pending = page.submit();
  await page.submit();
  await settle();
  page.window.dispatchEvent({ type: 'pureform:cart-change' });
  assert.equal(page.ids.checkoutSubmit.disabled, true);
  assert.equal(page.calls.length, 1);
  assert.equal(page.setupCalls.length, 1);
  const payload = JSON.parse(page.calls[0][1].body);
  assert.deepEqual(payload.line_items, [{ id: grey, quantity: 2 }]);
  assert.equal(payload.country, 'United Arab Emirates');
  assert.ok(!('total' in payload) && !('card_number' in payload));
  resolve({ ok: true, json: async () => ({ checkout_url: 'https://checkout.stripe.com/c/pay/fixture' }) });
  await pending;
  assert.deepEqual(page.redirects, ['https://checkout.stripe.com/c/pay/fixture']);
  assert.equal(page.cart.getCount(), 2);
});

for (const url of ['http://checkout.stripe.com/pay', 'https://checkout.stripe.com.attacker.test/pay', 'https://checkout.stripe.com@attacker.test/pay', 'javascript:alert(1)', 'https://checkout.stripe.com:8443/pay']) {
  test(`rejects an untrusted gateway redirect: ${url}`, async () => {
    const page = fixture({ fetch: async () => ({ ok: true, json: async () => ({ checkout_url: url }) }) });
    await page.submit();
    assert.equal(page.redirects.length, 0);
    assert.equal(page.cart.getCount(), 2);
    assert.equal(page.ids.checkoutSubmit.disabled, false);
    assert.match(page.ids.checkoutStatus.textContent, /untrusted payment URL/);
  });
}

test('stock reservations do not erase the cart; new additions obey current stock', () => {
  const page = fixture();
  const product = { ...page.cart.catalog[grey], inventory_quantity: 0, inventory_status: 'out_of_stock' };
  page.cart.setCatalog({ [grey]: product });
  assert.deepEqual(copy(page.cart.getCart()), [{ id: grey, quantity: 2 }]);
  page.cart.addItem(grey, 1);
  assert.equal(page.cart.getCount(), 2);
  page.cart.setQuantity(grey, 3);
  assert.equal(page.cart.getCount(), 2);
  page.cart.setQuantity(grey, 0);
  assert.equal(page.cart.getCount(), 0);
});

test('cart quantities are capped at the server limit while admin prices drive totals', () => {
  const page = fixture();
  page.cart.addItem(grey, 500);
  assert.equal(page.cart.getCount(), 20);
  page.cart.setCatalog({ [grey]: { ...page.cart.catalog[grey], price: 12.34 } });
  assert.equal(page.cart.formatAED(page.cart.getSubtotal()), 'AED 246.80');
});

test('delivery is AED 10 once per order, included in both checkout totals, and zero for an empty cart', () => {
  const page = fixture();
  assert.equal(page.cart.getShippingTotal(), 10);
  assert.equal(page.cart.formatAED(page.cart.getTotal()), 'AED 97.78');
  assert.equal(page.ids.checkoutShipping.textContent, 'AED 10.00');
  assert.equal(page.ids.checkoutTotal.textContent, 'AED 97.78');
  assert.equal(page.ids.checkoutMobileTotal.textContent, 'AED 97.78');
  page.cart.clearCart();
  assert.equal(page.cart.getShippingTotal(), 0);
  assert.equal(page.cart.getTotal(), 0);
  assert.equal(page.ids.checkoutShipping.textContent, 'AED 0.00');
});

test('checkout fails closed when deployed delivery configuration is missing or different', async () => {
  for (const setup of [{ configured: true }, { configured: true, currency: 'AED', shipping_total: 0 }, { configured: false, currency: 'AED', shipping_total: 10 }]) {
    const page = fixture({ setup });
    await page.submit();
    assert.equal(page.calls.length, 0);
    assert.equal(page.redirects.length, 0);
    assert.equal(page.cart.getCount(), 2);
    assert.match(page.ids.checkoutStatus.textContent, /Delivery settings are being updated/);
  }
});
