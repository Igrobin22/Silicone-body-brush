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
    globalThis.adminTest = { state, els, orderSelect, onOrdersTableChange, onOrderSubmit, renderStats, fillOrderForm,
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
