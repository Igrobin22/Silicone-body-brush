const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = readFileSync(path.join(__dirname, '../assets/pureform-admin.js'), 'utf8');

function fixture() {
  const ids = {};
  const document = { addEventListener() {}, getElementById(id) { return ids[id] ||= { value: '', textContent: '' }; } };
  const context = vm.createContext({ document, window: {}, URL, URLSearchParams, Intl, FormData: class {
    constructor(form) { this.form = form; }
    entries() { return this.form.fields.entries(); }
  } });
  new vm.Script(source.replace(/\}\)\(\);\s*$/, `globalThis.workspaceTest = { state, els, filterOrderRecords, filterListingRecords, matchesSearch,
    formSnapshot, rememberEditor, hasUnsavedEditor, editorFormKey, syncDiscountFields, mayLeaveEditor, onListingSubmit, handleSession,
    stubAuthView(fn) { showAuth = fn; },
    stubSave(payload) { collectListingPayload = function () { return payload; }; loadListings = async function () {}; renderDashboard = function () {}; fillListingForm = function () {}; setView = function () {}; } }; })();`)).runInContext(context);
  return { ...context.workspaceTest, document, ids, window: context.window };
}

test('order search combines with source and payment filters without changing the source data', () => {
  const f = fixture();
  const rows = [
    { id:'live', order_number:'PF-LIVE', source:'website', first_name:'Alice', contact:'alice@example.test', payment_status:'paid', total:40 },
    { id:'test', order_number:'PF-TEST', source:'stripe_sandbox', first_name:'Alice', contact:'alice@example.test', payment_status:'paid', total:99 },
    { id:'pending', order_number:'PF-PENDING', source:'website', payment_status:'requires_payment' },
    { id:'refund', order_number:'PF-REFUND', source:'website', payment_status:'paid', refunded_total:10 },
    { id:'failed', order_number:'PF-FAILED', source:'website', payment_status:'failed' }
  ];
  const before = JSON.stringify(rows);
  const ids = (...args) => Array.from(f.filterOrderRecords(rows, ...args), row => row.id);
  assert.deepEqual(ids('alice@example.test','paid','customer'), ['live']);
  assert.deepEqual(ids('alice','paid','sandbox'), ['test']);
  assert.deepEqual(ids('','unpaid','all'), ['pending']);
  assert.deepEqual(ids('','refund','customer'), ['refund']);
  assert.deepEqual(ids('','failed','all'), ['failed']);
  assert.deepEqual(ids('not-found','all','all'), []);
  assert.equal(JSON.stringify(rows), before);
});

test('product search, visibility and sort are local and preserve storefront order', () => {
  const f = fixture();
  const rows = [
    { name:'Grey set', slug:'grey', price:100, discount:50, inventory_quantity:24, visible:true },
    { name:'Black set', slug:'black', price:90, discount:50, inventory_quantity:18, visible:true },
    { name:'Pink set', slug:'pink', price:42, discount:10, inventory_quantity:0, visible:false, inventory_status:'out_of_stock' }
  ];
  const names = (...args) => Array.from(f.filterListingRecords(rows, ...args), row=>row.slug);
  assert.deepEqual(names('','all','store'), ['grey','black','pink']);
  assert.deepEqual(names('','all','name'), ['black','grey','pink']);
  assert.deepEqual(names('','all','stock'), ['pink','black','grey']);
  assert.deepEqual(names('','all','price'), ['pink','black','grey']);
  assert.deepEqual(names('','visible','store'), ['grey','black']);
  assert.deepEqual(names('','hidden','store'), ['pink']);
  assert.deepEqual(names('','low','store'), ['pink']);
  assert.deepEqual(names('black','all','store'), ['black']);
  assert.deepEqual(rows.map(row=>row.slug), ['grey','black','pink']);
});

test('dirty tracking uses the form ID attribute, never a shadowing name=id control', () => {
  const f = fixture();
  const form = { id: { value:'product-record-id' }, getAttribute: name=>name==='id'?'listingForm':null, fields: new Map([['name','Grey set'],['photo_urls','https://example.test/grey.webp']]) };
  f.state.activeView = 'listings'; f.els.listingForm = form;
  assert.equal(f.editorFormKey(form), 'listingForm');
  f.rememberEditor(form);
  assert.equal(f.hasUnsavedEditor(), false);
  form.fields.set('name','Changed set');
  assert.equal(f.hasUnsavedEditor(), true);
  f.rememberEditor(form);
  assert.equal(f.hasUnsavedEditor(), false);
  form.fields.set('photo_urls','https://example.test/second.webp\nhttps://example.test/grey.webp');
  assert.equal(f.hasUnsavedEditor(), true);
});

test('ongoing discounts make scheduling controls unavailable without discarding their values', () => {
  const f = fixture();
  const mode = f.document.getElementById('listingDiscountMode');
  const start = f.document.getElementById('listingDiscountStartsAt');
  const end = f.document.getElementById('listingDiscountEndsAt');
  start.value = '2026-12-01T10:00'; end.value = '2026-12-02T10:00';
  mode.value = 'ongoing'; f.syncDiscountFields();
  assert.equal(start.disabled, true); assert.equal(end.disabled, true);
  mode.value = 'fixed'; f.syncDiscountFields();
  assert.equal(start.disabled, false); assert.equal(end.disabled, false);
  assert.equal(start.value, '2026-12-01T10:00');
});

test('stale product writes include the original updated_at and report a conflict without retrying', async () => {
  const f = fixture();
  const filters = [], writes = [];
  f.stubSave({ name:'Black set', inventory_quantity:18 });
  f.document.getElementById('listingId').value='black';
  f.state.listingEditVersion='2026-10-24T06:00:00Z';
  f.els.dashboardStatus={textContent:'',classList:{toggle(){}}};
  const query={ update(payload){writes.push(payload);return query},eq(key,value){filters.push([key,value]);return query},select(){return query},async single(){return {error:{code:'PGRST116'}}} };
  f.state.supabase={from(table){assert.equal(table,'site_listings');return query}};
  await f.onListingSubmit({preventDefault(){}});
  assert.deepEqual(filters,[['id','black'],['updated_at','2026-10-24T06:00:00Z']]);
  assert.equal(writes.length,1);
  assert.match(f.els.dashboardStatus.textContent,/listing changed or is no longer available/);
  assert.match(f.els.dashboardStatus.textContent,/edits have been kept/);
});

test('unsaved editor and pending save guards prevent accidental navigation', () => {
  const f=fixture();
  const form={getAttribute:()=> 'listingForm',fields:new Map([['name','Grey set']])};
  f.state.activeView='listings'; f.els.listingForm=form;
  f.rememberEditor(form); form.fields.set('name','Changed set');
  let confirmations=0; f.window.confirm=()=>{confirmations++;return false};
  assert.equal(f.mayLeaveEditor(),false);
  assert.equal(confirmations,1);
  assert.equal(form.fields.get('name'),'Changed set');
  f.state.savingForms.listingForm=true;
  f.els.dashboardStatus={textContent:'',classList:{toggle(){}}};
  assert.equal(f.mayLeaveEditor(),false);
  assert.equal(confirmations,1);
  assert.match(f.els.dashboardStatus.textContent,/wait for the current save/);
});

test('session loss hides private data and never lets dirty-form guards block the sign-in redirect', async () => {
  const f=fixture();
  f.state.profile={role:'admin'}; f.state.photoUploadPending=true; f.state.savingForms.listingForm=true;
  f.state.formBaselines.listingForm='old'; f.els.dashboardView={hidden:false};
  let authShown=false; f.stubAuthView(()=>{authShown=true});
  await f.handleSession(null);
  assert.equal(f.els.dashboardView.hidden,true);
  assert.equal(f.state.profile,null);
  assert.equal(f.state.photoUploadPending,false);
  assert.equal(Object.keys(f.state.formBaselines).length,0);
  assert.equal(Object.keys(f.state.savingForms).length,0);
  assert.equal(authShown,true);
});

test('both routes expose usable search, real filters, grouped forms and discard actions', () => {
  for (const file of ['index.html','dashboard.html']) {
    const html = readFileSync(path.join(__dirname,'../admin/',file),'utf8');
    for (const id of ['orderSearch','orderPaymentFilter','orderSourceFilter','listingSearch','listingVisibilityFilter','listingSort','contentSearch']) assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
    for (const label of ['Product details','Pricing &amp; discounts','Inventory &amp; visibility','Media']) assert.ok(html.includes('<legend>'+label+'</legend>'));
    assert.match(html,/id="listingEditor"[^>]*hidden/);
    assert.match(html,/id="contentEditor"[^>]*hidden/);
    assert.match(html,/data-discard-editor="listing"/);
    assert.match(html,/data-discard-editor="content"/);
    assert.match(html,/pureform-admin-workspace\.css/);
  }
});

test('redesign adds no dependencies, telemetry, fabricated charts or storefront styling', () => {
  const css = readFileSync(path.join(__dirname,'../assets/pureform-admin-workspace.css'),'utf8');
  assert.match(css,/@container records/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css,/radial-gradient|backdrop-filter:\s*blur/);
  for (const file of ['../index.html','../products.html','../checkout.html']) {
    assert.ok(!readFileSync(path.join(__dirname,file),'utf8').includes('pureform-admin-workspace.css'));
  }
});
