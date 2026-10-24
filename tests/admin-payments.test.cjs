const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../assets/pureform-admin.js'), 'utf8');

function element(tag = 'div') {
  return {
    tag, children: [], dataset: {}, attributes: {}, value: '', disabled: false,
    classList: { toggle() {} },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus(options) { this.focusOptions = options; },
    scrollIntoView(options) { this.scrollOptions = options; },
    querySelector() { return null; }
  };
}

function fixture() {
  const ids = {};
  const document = {
    addEventListener() {},
    createElement: element,
    getElementById(id) { return ids[id] || (ids[id] = element()); }
  };
  // Expose private functions only inside the isolated test copy, never in the shipped script.
  assert.match(source, /\}\)\(\);\s*$/);
  const instrumented = source.replace(/\}\)\(\);\s*$/, `
    globalThis.adminTest = { state, els, orderSelect, onOrdersTableChange, onOrdersTableClick, onOrderSubmit, renderStats, renderOrdersTable, fillOrderForm, syncOrderFilterTabs, renderListingsTable, renderContentTable, focusEditor,
      captureUpdates(fn) { updateOrder = fn; setView = function () {}; } };
  })();`);
  const context = vm.createContext({ document, window: {}, Intl, URL, URLSearchParams });
  new vm.Script(instrumented).runInContext(context);
  return { ...context.adminTest, ids, document };
}

test('quick payment status is disabled and has no update action; fulfillment status remains editable', () => {
  const page = fixture();
  const order = { id: 'test-order', order_number: 'PF-TEST', payment_status: 'paid', status: 'confirmed' };
  const payment = page.orderSelect(order, 'payment_status', ['pending', 'paid'], 'quick-payment-status');
  assert.equal(payment.disabled, true);
  assert.equal(payment.dataset.action, undefined);
  assert.equal(payment.title, 'Payment status verified by Stripe');
  assert.equal(payment.children[1].selected, true);
  const status = page.orderSelect(order, 'status', ['new', 'confirmed'], 'quick-order-status');
  assert.equal(status.disabled, false);
  assert.equal(status.dataset.action, 'quick-order-status');
});

test('forged payment change events are ignored while ordinary order status changes work', async () => {
  const page = fixture();
  page.state.orders = [{ id: 'test-order' }];
  const writes = [];
  page.captureUpdates(async (id, payload) => writes.push({ id, payload: JSON.parse(JSON.stringify(payload)) }));
  const target = { dataset: { action: 'quick-payment-status' }, value: 'paid', closest() { return { dataset: { id: 'test-order' } }; } };
  await page.onOrdersTableChange({ target });
  assert.equal(writes.length, 0);
  target.dataset.action = 'quick-order-status';
  target.value = 'packing';
  await page.onOrdersTableChange({ target });
  assert.deepEqual(writes, [{ id: 'test-order', payload: { status: 'packing' } }]);
});

test('saving order details submits fulfillment and notes but never payment fields', async () => {
  const page = fixture();
  const values = { orderId: 'test-order', orderStatus: 'packing', orderFulfillmentStatus: 'packed', orderAdminNotes: '  Test note  ', orderPaymentStatus: 'paid' };
  Object.entries(values).forEach(([id, value]) => { page.document.getElementById(id).value = value; });
  const writes = [];
  page.captureUpdates(async (id, payload) => writes.push({ id, payload: JSON.parse(JSON.stringify(payload)) }));
  await page.onOrderSubmit({ preventDefault() {} });
  assert.deepEqual(writes, [{ id: 'test-order', payload: { status: 'packing', fulfillment_status: 'packed', admin_notes: 'Test note' } }]);
});

test('statistics count only settled customer revenue and exclude sandbox new/open orders', () => {
  const page = fixture();
  page.els.statsGrid = element();
  page.state.orders = [
    { source: 'website', payment_status: 'paid', status: 'confirmed', total: 100 },
    { source: 'website', payment_status: 'pending', status: 'new', total: 200 },
    { source: 'website', payment_status: 'requires_payment', status: 'new', total: 50 },
    { source: 'website', payment_status: 'refunded', status: 'completed', total: 90 },
    { source: 'website', payment_status: 'paid', status: 'cancelled', total: 25 },
    { source: 'stripe_sandbox', payment_status: 'paid', status: 'new', total: 999 },
    { source: 'stripe_sandbox', payment_status: 'requires_payment', status: 'new', total: 88 }
  ];
  page.renderStats();
  const stats = Object.fromEntries(page.els.statsGrid.children.map((card) => card.children.map((child) => child.textContent)));
  assert.equal(stats.Revenue, 'AED 125.00');
  assert.equal(stats['New orders'], '2');
  assert.equal(stats['Open orders'], '3');
});

test('order detail always locks payment status and labels the sandbox environment', () => {
  const page = fixture();
  page.els.orderFormTitle = element();
  page.els.orderDetailSummary = element();
  page.els.orderItemsList = element();
  page.fillOrderForm({ id: 'test-order', order_number: 'PF-TEST', source: 'stripe_sandbox', payment_status: 'paid', status: 'cancelled' });
  assert.equal(page.ids.orderPaymentStatus.disabled, true);
  assert.equal(page.ids.orderPaymentStatus.value, 'paid');
  assert.ok(page.els.orderDetailSummary.children.some((item) => item.children[0].textContent === 'Environment' && item.children[1].textContent === 'Stripe sandbox - do not fulfill'));
  page.fillOrderForm(null);
  assert.equal(page.ids.orderPaymentStatus.disabled, true);
});

test('both admin HTML routes start with payment fields disabled', () => {
  for (const file of ['index.html', 'dashboard.html']) {
    const html = readFileSync(path.join(__dirname, '../admin/', file), 'utf8');
    const select = html.match(/<select\b[^>]*id="orderPaymentStatus"[^>]*>/)[0];
    assert.match(select, /\bdisabled\b/);
  }
});

test('order rows expose every mobile label and show gateway payment as read-only text', () => {
  const page = fixture();
  page.els.ordersTableBody = element();
  page.els.orderFilterTabs = [];
  page.state.orders = [{ id: 'test-order', order_number: 'PF-TEST', payment_status: 'paid', status: 'confirmed', total: 47.8 }];
  page.renderOrdersTable();
  const cells = page.els.ordersTableBody.children[0].children;
  assert.deepEqual(cells.map(cell => cell.dataset.label), ['Order', 'Customer', 'Items', 'Total', 'Status', 'Payment', 'Actions']);
  assert.equal(cells[5].children[0].tag, 'span');
  assert.equal(cells[5].children[0].textContent, 'Paid');
  assert.equal(cells[5].children[0].dataset.action, undefined);
});

test('viewing an order moves keyboard focus to the full-width detail without saving anything', async () => {
  const page = fixture();
  page.els.orderFormTitle = element();
  page.els.orderDetailSummary = element();
  page.els.orderItemsList = element();
  page.state.orders = [{ id: 'test-order', order_number: 'PF-TEST', payment_status: 'refunded', status: 'cancelled' }];
  let writes = 0;
  page.captureUpdates(() => { writes++; });
  const button = { dataset: { action: 'view-order' }, closest: () => ({ dataset: { id: 'test-order' } }) };
  await page.onOrdersTableClick({ target: { closest: () => button } });
  assert.equal(page.els.orderFormTitle.textContent, 'PF-TEST');
  assert.equal(page.els.orderFormTitle.focusOptions.preventScroll, true);
  assert.equal(page.els.orderFormTitle.scrollOptions.block, 'start');
  assert.equal(page.ids.orderPaymentStatus.disabled, true);
  assert.equal(writes, 0);
});

test('both admin routes provide keyboard-accessible order list and detail navigation', () => {
  for (const file of ['index.html', 'dashboard.html']) {
    const html = readFileSync(path.join(__dirname, '../admin/', file), 'utf8');
    assert.match(html, /class="table-scroll orders-table-scroll" role="region" aria-label="Customer orders" tabindex="0"/);
    assert.match(html, /id="orderFormTitle" tabindex="-1"/);
    assert.match(html, /href="#ordersHeading">Back to orders<\/a>/);
  }
});

test('order filters announce the selected state', () => {
  const page = fixture();
  page.els.orderFilterTabs = ['all', 'new', 'open', 'completed'].map(filter => {
    const button = element('button');
    button.dataset.orderFilter = filter;
    return button;
  });
  page.state.orderFilter = 'new';
  page.syncOrderFilterTabs();
  assert.deepEqual(page.els.orderFilterTabs.map(button => button.attributes['aria-pressed']), ['false', 'true', 'false', 'false']);
});

test('listing and content rows expose every field label for layouts without inner scrolling', () => {
  const page = fixture();
  page.els.listingsTableBody = element();
  page.els.contentTableBody = element();
  page.state.listings = [{ id: 'black', name: 'Black set', slug: 'pureform-4pc-set-black', price: 87.78, discount: 50, visible: true }];
  page.state.contentBlocks = [{ id: 'announcement', key: 'home.announcement', label: 'Announcement', block_type: 'text' }];
  page.renderListingsTable();
  page.renderContentTable();
  assert.deepEqual(page.els.listingsTableBody.children[0].children.map(cell => cell.dataset.label), ['Listing', 'Price', 'Discount', 'Stock', 'Visible', 'Actions']);
  assert.deepEqual(page.els.contentTableBody.children[0].children.map(cell => cell.dataset.label), ['Key', 'Label', 'Type', 'Updated', 'Actions']);
});

test('editors move keyboard focus and use ordinary document scrolling', () => {
  const page = fixture();
  const title = element();
  page.focusEditor(title);
  assert.equal(title.focusOptions.preventScroll, true);
  assert.equal(title.scrollOptions.block, 'start');
  assert.equal(title.scrollOptions.behavior, 'auto');
  for (const file of ['index.html', 'dashboard.html']) {
    const html = readFileSync(path.join(__dirname, '../admin/', file), 'utf8');
    assert.match(html, /id="listingFormTitle" tabindex="-1"/);
    assert.match(html, /href="#listingsHeading">Back to listings/);
    assert.match(html, /href="#contentHeading">Back to content/);
    assert.match(html, /admin-table records-table listings-table/);
    assert.match(html, /admin-table records-table content-table/);
  }
});

test('refund totals reduce customer revenue and remain read-only in order details', () => {
  const page = fixture();
  page.els.statsGrid = element();
  page.els.orderFormTitle = element();
  page.els.orderDetailSummary = element();
  page.els.orderItemsList = element();
  const order = { id: 'refund-order', payment_status: 'paid', total: 100, refunded_total: 25, refund_pending_total: 10, refund_attention_required: true };
  page.state.orders = [order];
  page.renderStats();
  const stats = Object.fromEntries(page.els.statsGrid.children.map(card => card.children.map(child => child.textContent)));
  assert.equal(stats.Revenue, 'AED 75.00');
  page.fillOrderForm(order);
  const summary = Object.fromEntries(page.els.orderDetailSummary.children.map(item => item.children.map(child => child.textContent)));
  assert.equal(summary.Refunded, 'AED 25.00');
  assert.equal(summary['Refund pending'], 'AED 10.00');
  assert.equal(summary['Refund review'], 'Action required in Stripe');
  assert.equal(page.ids.orderPaymentStatus.disabled, true);
});

test('admin shows saved shipping and promotion totals without recalculating historical delivery fees', () => {
  const page = fixture();
  page.els.orderFormTitle = element();
  page.els.orderDetailSummary = element();
  page.els.orderItemsList = element();
  page.fillOrderForm({ id: 'shipping-order', order_number: 'PF-SHIPPING', subtotal: 100, shipping_total: 10, total: 85, payment_status: 'paid' });
  const summary = Object.fromEntries(page.els.orderDetailSummary.children.map(item => item.children.map(child => child.textContent)));
  assert.equal(summary.Subtotal, 'AED 100.00');
  assert.equal(summary['UAE delivery'], 'AED 10.00');
  assert.equal(summary['Promotion discount'], 'AED 25.00');
  assert.equal(summary.Total, 'AED 85.00');
  page.fillOrderForm({ id: 'historical-order', order_number: 'PF-OLD', subtotal: 75, total: 75, payment_status: 'paid' });
  const historical = Object.fromEntries(page.els.orderDetailSummary.children.map(item => item.children.map(child => child.textContent)));
  assert.equal(historical['UAE delivery'], 'AED 0.00');
});
