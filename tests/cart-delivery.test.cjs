const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cartSource = readFileSync(path.join(__dirname, '../assets/pureform-cart.js'), 'utf8');
const source = readFileSync(path.join(__dirname, '../assets/pureform-cart-delivery.js'), 'utf8');
const id = color => 'pureform-4pc-set-' + color;
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture({ count = 1, fresh = true, setup = {}, fail = false } = {}) {
  const events = {};
  const elements = {};
  const storage = new Map([['pureform.cart.v1', JSON.stringify(count ? [{ id: id('grey'), quantity: count }] : [])]]);
  const products = Object.fromEntries(['grey', 'black', 'pink'].map(color => [id(color), {
    id: id(color), color: color[0].toUpperCase() + color.slice(1), name: color + ' set', price: color === 'pink' ? 37.8 : 43.89,
    image: color + '.webp', inventory_quantity: 24, inventory_status: 'in_stock', visible: true
  }]));
  const document = { activeElement: null, readyState: 'complete', querySelectorAll: () => [], querySelector: () => null,
    getElementById: key => elements[key] ||= element(), createElement: () => element() };
  function element() {
    return { children: [], hidden: false, value: '', textContent: '', attributes: {}, listeners: {},
      appendChild(child) { this.children.push(child); },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key] || this[key]; },
      contains(child) { return child === this || this.children.some(node => node.contains(child)); },
      focus() { document.activeElement = this; }
    };
  }
  const window = {
    PUREFORM_SUPABASE_CONFIG: { url: 'https://public.example.test', anonKey: 'public-test-key' },
    PureFormCatalog: { ready: Promise.resolve(), isFresh: () => fresh, getCatalogSync: () => products },
    addEventListener(name, callback) { (events[name] ||= []).push(callback); },
    dispatchEvent(event) { for (const callback of events[event.type] || []) callback(event); }
  };
  document.getElementById('cartDeliveryChoices').appendChild(document.getElementById('cartDeliveryOptions'));
  document.getElementById('cartDeliveryChoices').appendChild(document.getElementById('cartDeliveryAdd'));
  const calls = [];
  const context = vm.createContext({ window, document, AbortSignal,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    fetch: async (...args) => {
      calls.push(args);
      if (fail) throw Error('offline');
      return { ok: true, json: async () => ({ configured: true, currency: 'AED', shipping_total: 10, free_shipping_min_sets: 2, ...setup }) };
    }
  });
  new vm.Script(cartSource).runInContext(context);
  new vm.Script(source).runInContext(context);
  const cart = window.PureFormCart;
  return { elements, products, cart, calls, document,
    emit: name => window.dispatchEvent({ type: name }),
    select(color) { const row = elements.cartDeliveryOptions.children.find(label => label.children[0].value === id(color)); row.children[0].listeners.change(); },
    add() { elements.cartDeliveryAdd.listeners.click(); },
    refresh() { cart.setCatalog(products); window.dispatchEvent({ type: 'pureform:catalog-refresh' }); }
  };
}

test('one-set delivery chooser uses current prices and previews the full total without a second discount', async () => {
  const f = fixture();
  await settle();
  assert.equal(f.elements.cartDeliveryOffer.hidden, false);
  assert.equal(f.elements.cartDeliveryProgress.value, 1);
  assert.equal(f.elements.cartDeliveryChoices.hidden, false);
  f.select('pink');
  assert.equal(f.elements.cartDeliveryPreview.textContent, 'New order total: AED 81.69 with free UAE delivery.');
  assert.equal(f.cart.getTotal(), 53.89);
  assert.equal(f.calls.length, 1);
  assert.ok(f.calls[0][0].endsWith('/checkout-status'));
});

test('adding exactly one set unlocks free delivery and moves focus before hiding its controls', async () => {
  const f = fixture();
  await settle();
  f.select('pink');
  f.document.activeElement = f.elements.cartDeliveryAdd;
  f.add();
  assert.equal(f.cart.getCount(), 2);
  assert.equal(f.cart.getTotal(), 81.69);
  assert.equal(f.cart.getShippingTotal(), 0);
  assert.equal(f.elements.cartDeliveryChoices.hidden, true);
  assert.equal(f.elements.cartDeliveryProgress.value, 2);
  assert.equal(f.document.activeElement, f.elements.cartDeliveryTitle);
  assert.match(f.elements.cartDeliveryStatus.textContent, /Pink set added/);
  f.add();
  assert.equal(f.cart.getCount(), 2, 'Repeated/forged click cannot add a third set');
});

test('removing the second set restores the offer and empty cart hides it', async () => {
  const f = fixture();
  await settle();
  f.select('pink');
  f.add();
  assert.equal(f.elements.cartDeliveryChoices.hidden, true);
  f.cart.removeItem('pink');
  assert.equal(f.elements.cartDeliveryChoices.hidden, false);
  assert.equal(f.elements.cartDeliveryProgress.value, 1);
  assert.equal(f.elements.cartDeliveryStatus.textContent, '', 'Removal must not retain the prior free-delivery success message');
  f.cart.clearCart();
  assert.equal(f.elements.cartDeliveryOffer.hidden, true);
});

test('a focused radio remains usable if its color sells out during a refresh', async () => {
  const f = fixture();
  await settle();
  f.select('pink');
  const pink = f.elements.cartDeliveryOptions.children.find(label => label.children[0].value === id('pink'));
  f.document.activeElement = pink.children[0];
  f.products[id('pink')].inventory_status = 'out_of_stock';
  f.refresh();
  assert.equal(pink.hidden, true);
  assert.notEqual(f.document.activeElement, pink.children[0]);
  assert.equal(f.document.activeElement.checked, true);
  assert.match(f.elements.cartDeliveryStatus.textContent, /no longer available/);
});

test('hidden, sold-out and already-exhausted colors cannot be offered or added', async () => {
  const f = fixture();
  f.products[id('grey')].inventory_quantity = 1;
  f.products[id('black')].visible = false;
  f.products[id('pink')].inventory_status = 'out_of_stock';
  await settle();
  assert.equal(f.elements.cartDeliveryChoices.hidden, true);
  f.select('pink');
  f.add();
  assert.equal(f.cart.getCount(), 1);
  assert.match(f.elements.cartDeliveryStatus.textContent, /Availability changed/);
});

test('live catalog changes update available prices and block overstocked saved carts', async () => {
  const f = fixture();
  await settle();
  f.select('pink');
  f.products[id('pink')].price = 42;
  f.refresh();
  assert.match(f.elements.cartDeliveryPreview.textContent, /AED 85.89/);
  f.products[id('grey')].inventory_quantity = 0;
  f.refresh();
  assert.equal(f.elements.cartDeliveryChoices.hidden, true);
  assert.equal(f.elements.cartDeliveryProgress.hidden, true);
  assert.match(f.elements.cartDeliveryTitle.textContent, /Check availability/);
});

for (const options of [{ fresh: false }, { fail: true }, { setup: { configured: false } }, { setup: { free_shipping_min_sets: 3 } }, { setup: { shipping_total: 15 } }, { setup: { currency: 'USD' } }, { count: 0 }]) {
  test('unverified or inapplicable offer stays hidden: ' + JSON.stringify(options), async () => {
    const f = fixture(options);
    await settle();
    assert.equal(f.elements.cartDeliveryOffer.hidden, true);
  });
}
