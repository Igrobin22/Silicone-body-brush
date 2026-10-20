const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = readFileSync(path.join(__dirname, '../pureform-product-detail.html'), 'utf8');
const css = readFileSync(path.join(__dirname, '../assets/pureform-product.css'), 'utf8');

function fixture() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, setAttribute(name,value) { this[name]=value; }, classList: { toggle(name, value) { this[name] = value; } } });
    return elements.get(id);
  }
  const product = {
    id: 'pink', name: 'Owner product title', color: 'Pink', price: 37.8, priceText: 'AED 37.80',
    regularPrice: 42, regularPriceText: 'AED 42.00', discountActive: true, discountLabel: '10% off', fit: ['Owner detail'],
  };
  const context = vm.createContext({
    products: { pink: product }, fallbackId: 'pink', activeProductId: '', selectedQuantity: 2,
    publicCatalog: { updateLiveStatus() {} },
    document: { getElementById: element, querySelector: element },
    productName: element('name'), productLead: element('lead'), productPrice: element('price'),
    productCompare: element('compare'), productSaving: element('saving'), productCare: element('care'),
    productPriceNote: element('payment'), availabilityLine: element('availability'),
    getPriceText: p => p.priceText, getProductDescription: () => 'Owner description',
    getAvailabilityText: p => p.available === false ? 'Out of stock' : 'In stock',
    isProductAvailable: p => p.available !== false,
    renderFitList() {}, renderGallery() {}, renderRelatedProducts() {}, renderSetLinks() {},
    setQuantity() {}, updateStructuredData() {},
  });
  const render = html.match(/      function renderProduct\(id, pushState\) \{[\s\S]*?\n      \}/)[0];
  new vm.Script(render).runInContext(context);
  return { context, product, element, render: () => context.renderProduct('pink', false) };
}

test('purchase header, price, color and specifications use the same catalog record', () => {
  const f = fixture();
  f.render();
  assert.equal(f.element('name').textContent, 'Owner product title');
  assert.equal(f.element('price').textContent, 'AED 37.80');
  assert.equal(f.element('compare').textContent, 'AED 42.00');
  assert.equal(f.element('compare').hidden, false);
  assert.equal(f.element('saving').textContent, 'Save AED 4.20 (10% off)');
  assert.equal(f.element('productColor').textContent, 'Pink');
  assert.equal(f.element('productSpecColor').textContent, 'Pink');
  assert.equal(f.element('productBreadcrumb').textContent, 'Pink set');
  assert.equal(f.element('lead').textContent, 'Owner description');
});

test('ended discounts remove both the old price and saving instead of leaving stale offers', () => {
  const f = fixture();
  f.render();
  f.product.discountActive = false;
  f.product.priceText = 'AED 42.00';
  f.render();
  assert.equal(f.element('price').textContent, 'AED 42.00');
  for (const id of ['compare', 'saving']) {
    assert.equal(f.element(id).hidden, true);
    assert.equal(f.element(id).textContent, '');
  }
});

test('stock changes update the visible status without inventing scarcity', () => {
  const f = fixture();
  f.product.available = false;
  f.render();
  assert.equal(f.element('.pdp-status').textContent, 'Out of stock');
  assert.equal(f.element('.pdp-status').classList['is-unavailable'], true);
  f.product.available = true;
  f.render();
  assert.equal(f.element('.pdp-status').textContent, 'In stock');
  assert.equal(f.element('.pdp-status').classList['is-unavailable'], false);
});

test('product sections, native image dialog and bounded photos remain accessible', () => {
  assert.match(html, /<dialog[^>]+id="productZoom"[^>]+aria-labelledby="productZoomTitle"/);
  assert.match(html, /productZoom\.showModal\(\)/);
  assert.match(html, /productZoom\.close\(\)/);
  assert.match(html, /zoom\.setAttribute\('aria-label', zoom.title\)/);
  assert.match(html, /thumbnail\.alt = ''/);
  assert.match(html, /image\.setAttribute\('fetchpriority', 'high'\)/);
  assert.match(html, /image\.width = 1000/);
  for (const id of ['productDetails', 'productSpecifications', 'productDelivery', 'productReviews']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1);
    assert.ok(html.includes('href="#' + id + '"'));
  }
  assert.match(html, /target\.tagName === 'DETAILS'\) target\.open = true/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /scroll-snap-type: x mandatory/);
  assert.match(css, /\.pdp-quantity-input \{ font-size: 16px; \}/);
  assert.match(css, /\.pdp-gallery-frame img \{[^}]*object-fit: contain/);
});
