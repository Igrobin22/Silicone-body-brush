const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = readFileSync(path.join(root, 'assets/pureform-page-transitions.js'), 'utf8');
const css = readFileSync(path.join(root, 'assets/pureform-page-transitions.css'), 'utf8');

function fixture({ native = true, reduced = false, protocol = 'https:', reveals = [] } = {}) {
  const classes = new Set();
  const listeners = {};
  const mediaListeners = {};
  const preference = {
    matches: reduced,
    addEventListener(type, listener) { mediaListeners[type] = listener; }
  };
  const classList = {
    add(name) { classes.add(name); },
    remove(name) { classes.delete(name); },
    toggle(name, active) { if (active) classes.add(name); else classes.delete(name); }
  };
  const window = {
    innerHeight: 900,
    location: Object.freeze({ protocol, href: 'https://pureform.test/products.html' }),
    matchMedia: () => preference,
    addEventListener(type, listener) { listeners[type] = listener; }
  };
  if (native) window.onpagereveal = null;
  Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('Navigation must not depend on storage'); } });
  vm.runInNewContext(source, { document: { documentElement: { classList }, querySelectorAll: () => reveals }, window });
  return { classes, listeners, mediaListeners, preference, window };
}

test('native cross-document transitions do not intercept links, delay navigation or use storage', () => {
  const page = fixture();
  assert.equal(page.classes.has('pf-page-fallback'), false);
  assert.deepEqual(Object.keys(page.listeners).sort(), ['pagereveal', 'pageshow', 'pageswap']);
  assert.equal(page.window.location.href, 'https://pureform.test/products.html');
  assert.doesNotMatch(source, /preventDefault|sessionStorage|setTimeout|innerHTML|history\.|fetch\(/);
});

test('unsupported browsers and file previews use only the content entrance fallback', () => {
  assert.equal(fixture({ native: false }).classes.has('pf-page-fallback'), true);
  assert.equal(fixture({ protocol: 'file:' }).classes.has('pf-page-fallback'), true);
  assert.match(css, /html\.pf-page-fallback main\s*\{/);
  assert.doesNotMatch(css, /pf-page-(?:leaving|entering|ready)|\bfilter:|body\s*\{[^}]*transform:/);
});

test('reduced motion disables the fallback in both browser modes', () => {
  for (const native of [false, true]) {
    assert.equal(fixture({ native, reduced: true }).classes.has('pf-page-fallback'), false);
  }
});

test('only an active outgoing transition hides a closing drawer, and history restore clears it', () => {
  const page = fixture();
  page.listeners.pageswap({ viewTransition: null });
  assert.equal(page.classes.has('pf-page-swapping'), false);
  page.listeners.pageswap({ viewTransition: { skipTransition() { throw new Error('Unexpected skip'); } } });
  assert.equal(page.classes.has('pf-page-swapping'), true);
  page.listeners.pageshow({ persisted: true });
  assert.equal(page.classes.has('pf-page-swapping'), false);
});

test('a reduced-motion change cancels an outgoing native animation', () => {
  const page = fixture();
  page.preference.matches = true;
  let skipped = 0;
  page.listeners.pageswap({ viewTransition: { skipTransition() { skipped++; } } });
  assert.equal(skipped, 1);
  assert.equal(page.classes.has('pf-page-swapping'), false);
});

test('fallback animation follows preference changes without leaving content hidden', () => {
  const page = fixture({ native: false });
  page.preference.matches = true;
  page.mediaListeners.change();
  assert.equal(page.classes.has('pf-page-fallback'), false);
  page.preference.matches = false;
  page.mediaListeners.change();
  assert.equal(page.classes.has('pf-page-fallback'), true);
});

test('incoming native snapshots show viewport content immediately but preserve offscreen reveals', () => {
  function reveal(top, bottom) {
    const classes = new Set();
    return { classes, getBoundingClientRect: () => ({ top, bottom }),
      classList: { add(...names) { names.forEach(name => classes.add(name)); } } };
  }
  const visible = reveal(100, 500);
  const offscreen = reveal(1000, 1200);
  const above = reveal(-300, -10);
  const page = fixture({ reveals: [visible, offscreen, above] });
  page.listeners.pagereveal({ viewTransition: null });
  assert.equal(visible.classes.size, 0);
  page.preference.matches = true;
  page.listeners.pagereveal({ viewTransition: {} });
  assert.equal(visible.classes.size, 0);
  page.preference.matches = false;
  page.listeners.pagereveal({ viewTransition: {} });
  assert.equal(visible.classes.has('is-visible'), true);
  assert.equal(visible.classes.has('pf-page-visible'), true);
  assert.equal(offscreen.classes.size, 0);
  assert.equal(above.classes.size, 0);
  assert.match(css, /\[data-flow-reveal\]\.pf-page-visible\s*\{\s*opacity: 1;\s*transform: none;\s*transition: none;/);
});

test('native CSS opts in, keeps header snapshots stationary and opts out for reduced motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*@view-transition\s*\{\s*navigation: auto;/);
  assert.match(css, /body > nav\.site-header\s*\{\s*view-transition-name: pf-site-header;/);
  assert.match(css, /\.pf-mobile-menu-button\s*\{\s*view-transition-name: pf-menu-toggle;/);
  assert.match(css, /::view-transition-group\(pf-site-header\)[\s\S]*animation: none;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*navigation: none;/);
  assert.match(css, /html\.pf-page-swapping \.pf-mobile-sidebar,[\s\S]*display: none;/);
});

test('all participating storefront pages wait for their main markup without opting admin or recovery in', () => {
  const files = ['index.html', 'products.html', 'pureform-product-detail.html', 'about.html', 'reviews.html', 'policy.html', 'contact.html', 'cart.html', 'checkout.html'];
  for (const file of files) {
    const html = readFileSync(path.join(root, file), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /href="assets\/pureform-page-transitions\.css"/, file);
    assert.match(head, /<link rel="expect" href="#main-content" blocking="render">/, file);
    assert.match(html, /<main id="main-content"/, file);
    assert.match(head, /src="assets\/pureform-page-transitions\.js" defer blocking="render"/, file);
    assert.match(head, /src="assets\/pureform-mobile-menu\.js" defer blocking="render"/, file);
    assert.equal((html.match(/src="assets\/pureform-page-transitions\.js"/g) || []).length, 1, file);
    assert.equal((html.match(/src="assets\/pureform-mobile-menu\.js"/g) || []).length, 1, file);
  }
  for (const file of ['admin/index.html', 'admin/dashboard.html', 'admin/reset-password.html', 'faq.html']) {
    assert.doesNotMatch(readFileSync(path.join(root, file), 'utf8'), /pureform-page-transitions/, file);
  }
});
