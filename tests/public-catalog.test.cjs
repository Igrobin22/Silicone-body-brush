const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../assets/pureform-public-catalog.js'), 'utf8');

async function fixture() {
  const window = { dispatchEvent() {} };
  const context = vm.createContext({
    window, document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  });
  const instrumented = source.replace(/\}\)\(\);\s*$/, 'window.catalogTest = { normalizeListing, normalizeListings }; })();');
  new vm.Script(instrumented).runInContext(context);
  await window.PureFormCatalog.ready;
  return window.catalogTest;
}

test('public product copy never uses admin inventory notes', async () => {
  const catalog = await fixture();
  const product = catalog.normalizeListing({
    slug: 'pureform-4pc-set-pink', name: 'Owner product title', description: 'Owner public description',
    inventory_note: 'INTERNAL: Dedicated product photography and shipment tracking',
    price: 42, discount: 10, inventory_quantity: 12, inventory_status: 'low_stock', visible: true
  });
  assert.equal(product.name, 'Owner product title');
  assert.equal(product.description, 'Owner public description');
  assert.equal(product.meta, 'Pink set / 4 tools');
  assert.equal(product.inventory_note, undefined);
  assert.ok(!JSON.stringify(product).includes('INTERNAL:'));
  assert.equal(product.priceText, 'AED 37.80');
  assert.ok(product.fit.includes('AED 10 delivery per order across the UAE.'));
});

test('catalog follows admin discount dates and stock, keeping only the three canonical colors', async () => {
  const catalog = await fixture();
  const grey = {
    slug: 'pureform-4pc-set-grey', name: 'Grey', price: 100, discount: 25, discount_mode: 'fixed',
    discount_starts_at: new Date(Date.now() + 86400000).toISOString(), inventory_quantity: 0, inventory_status: 'in_stock'
  };
  assert.equal(catalog.normalizeListing(grey).priceText, 'AED 100.00');
  assert.equal(catalog.normalizeListing(grey).inventoryStatusText, 'Out of stock');
  assert.equal(catalog.normalizeListing({ ...grey, discount_mode: 'ongoing' }).priceText, 'AED 75.00');
  const listings = catalog.normalizeListings([grey, { slug: 'unknown-product', price: 1 }]);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].id, 'pureform-4pc-set-grey');
});
