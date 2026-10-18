const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../assets/pureform-public-catalog.js'), 'utf8');

async function fixture() {
  const window = { dispatchEvent() {} };
  const context = vm.createContext({
    window, URL, document: { readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } },
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
  assert.equal(catalog.normalizeListing({ ...grey, discount_starts_at: null, discount_ends_at: new Date(Date.now() - 86400000).toISOString() }).priceText, 'AED 100.00');
  assert.equal(catalog.normalizeListing({ ...grey, discount_mode: 'ongoing' }).priceText, 'AED 75.00');
  const listings = catalog.normalizeListings([grey, { slug: 'unknown-product', price: 1 }]);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].id, 'pureform-4pc-set-grey');
});

test('scarcity copy follows actual available quantity, not a stale low-stock flag', async () => {
  const catalog = await fixture();
  const listing = { slug: 'pureform-4pc-set-pink', price: 42, inventory_status: 'low_stock' };
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 12 }).inventoryStatusText, 'In stock');
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 6 }).inventoryStatusText, 'In stock');
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 5, inventory_status: 'in_stock' }).inventoryStatusText, 'Only 5 left');
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 1 }).inventoryStatusText, 'Only 1 left');
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 0 }).inventoryStatusText, 'Out of stock');
  assert.equal(catalog.normalizeListing({ ...listing, inventory_quantity: 12, inventory_status: 'out_of_stock' }).inventoryStatusText, 'Out of stock');
});

test('raw versioned Cloudinary photos use bounded delivery without modifying admin originals', async () => {
  const catalog = await fixture();
  const original = 'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553535/grey_Head_h1duwj.png';
  const record = { slug: 'pureform-4pc-set-grey', photo_urls: [original], price: 100 };
  const product = catalog.normalizeListing(record);
  assert.equal(product.image, 'https://res.cloudinary.com/dqjilscgl/image/upload/f_auto,q_auto,c_limit,w_1400/v1779553535/grey_Head_h1duwj.png');
  assert.equal(product.images[0], product.image);
  assert.equal(record.photo_urls[0], original);
  assert.equal(catalog.normalizeListing({ ...record, photo_urls: product.images }).image, product.image);
});

test('existing crops, signed URLs, local files and other image hosts stay untouched', async () => {
  const catalog = await fixture();
  const images = [
    'https://res.cloudinary.com/demo/image/upload/c_crop,w_500,h_500/v123/photo.png',
    'https://res.cloudinary.com/demo/image/upload/s--signature--/v123/photo.png',
    'https://res.cloudinary.com/demo/image/upload/v123/photo.png?__cld_token__=fixture',
    'https://res.cloudinary.com/demo/image/upload/v123/photo.png#original',
    'https://res.cloudinary.com.attacker.test/demo/image/upload/v123/photo.png',
    'https://images.example.test/photo.png',
    'assets/pureform-body-brush.png'
  ];
  for (const image of images) {
    assert.equal(catalog.normalizeListing({ slug: 'pureform-4pc-set-grey', photo_urls: [image] }).image, image);
  }
});
