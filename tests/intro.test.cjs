const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('assets/pureform-intro.js');
const css = read('assets/pureform-intro.css');

function fixture({ url = 'https://pureform.test/index.html', referrer = '', navigation = 'navigate', painted = false,
  reduced = false, hidden = false, seen = false, blockedStorage = false, styled = true, body = true, photoReady = true } = {}) {
  const storage = new Map(seen ? [['pureform.intro.v3', '1']] : []);
  const timers = new Map();
  let nextTimer = 1;
  const documentEvents = new Map();
  const windowEvents = new Map();
  const mediaEvents = new Map();
  const children = [];
  const nodes = [];
  const photos = Array.from({ length: 2 }, () => ({ complete: photoReady, naturalWidth: photoReady ? 500 : 0, events: {},
    addEventListener(type, fn) { this.events[type] = fn; }, removeEventListener(type) { delete this.events[type]; } }));
  const preference = { matches: reduced,
    addEventListener: (type, fn) => mediaEvents.set(type, fn),
    removeEventListener: type => mediaEvents.delete(type) };
  const document = {
    hidden, referrer, documentElement: {},
    body: body ? { appendChild(node) { children.push(node); } } : null,
    addEventListener: (type, fn) => documentEvents.set(type, fn),
    removeEventListener: type => documentEvents.delete(type),
    createElement() {
      const node = { attributes: {}, events: {}, innerHTML: '',
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, fn) { this.events[name] = fn; },
        querySelectorAll() { return photos; },
        remove() { const index = children.indexOf(this); if (index !== -1) children.splice(index, 1); } };
      nodes.push(node); return node;
    }
  };
  const window = {
    location: new URL(url),
    matchMedia: () => preference,
    getComputedStyle: () => ({ getPropertyValue: () => styled ? '1' : '' }),
    performance: { getEntriesByType: type => type === 'navigation' ? [{ type: navigation }] : (painted ? [{ name: 'first-contentful-paint' }] : []) },
    get sessionStorage() { if (blockedStorage) throw Error('Storage unavailable'); return { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }; },
    setTimeout(fn, ms) { const id = nextTimer++; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
    addEventListener: (type, fn) => windowEvents.set(type, fn),
    removeEventListener: type => windowEvents.delete(type)
  };
  new vm.Script(source).runInNewContext({ window, document, URL, URLSearchParams });
  return { storage, timers, documentEvents, windowEvents, mediaEvents, children, nodes, document, preference, photos };
}

test('first external homepage visit reuses two disclosed Grey and Pink scenes without sample video', () => {
  const page = fixture();
  assert.equal(page.children.length, 1);
  assert.equal(page.children[0].attributes['aria-hidden'], 'true');
  assert.match(page.children[0].innerHTML, /PureForm/);
  assert.equal((page.children[0].innerHTML.match(/<img /g) || []).length, 2);
  assert.match(page.children[0].innerHTML, /assets\/lifestyle\/grey-vanity-600.webp/);
  assert.match(page.children[0].innerHTML, /assets\/lifestyle\/pink-shower-600.webp/);
  assert.match(page.children[0].innerHTML, /AI-styled product scenes/);
  assert.match(page.children[0].innerHTML, /Soft touch\. Deep clean\. Every day\./);
  assert.equal((page.children[0].innerHTML.match(/fetchpriority="low"/g) || []).length, 2);
  assert.doesNotMatch(source, /<svg|<video|<canvas|fetch\(|document\.fonts|preventDefault|stopPropagation|\.focus\(/);
  assert.equal(page.storage.get('pureform.intro.v3'), '1');
  assert.equal(page.timers.get(1).ms, 3800);
  assert.equal(page.timers.get(2).ms, 350);
});

test('repeat visits, reload, history, internal navigation and already-painted content do not replay', () => {
  for (const options of [{ seen: true }, { navigation: 'reload' }, { navigation: 'back_forward' },
    { referrer: 'https://pureform.test/products.html' }, { painted: true }]) {
    const page = fixture(options);
    assert.equal(page.children.length, 0, JSON.stringify(options));
    assert.equal(page.timers.size, 0);
  }
});

test('checkout, cart, authentication, callbacks and fragment destinations are excluded defensively', () => {
  for (const route of ['products.html', 'pureform-product-detail.html', 'about.html', 'reviews.html', 'policy.html', 'contact.html', 'cart.html', 'checkout.html', 'admin/index.html', 'admin/dashboard.html', 'admin/reset-password.html',
    'faq.html', 'index.html#reviews', 'index.html?payment=success', 'products.html?session_id=fixture']) {
    assert.equal(fixture({ url: 'https://pureform.test/' + route }).children.length, 0, route);
  }
});

test('reduced motion, missing styles, inaccessible storage, hidden tabs and missing body fail open', () => {
  for (const options of [{ reduced: true }, { styled: false }, { blockedStorage: true }, { hidden: true }, { body: false }]) {
    const page = fixture(options);
    assert.equal(page.children.length, 0);
    assert.equal(page.timers.size, 0);
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pf-intro-screen \{ display: none; \}/);
});

test('CSS exit and JavaScript timeout independently remove the intro and clean up listeners', () => {
  for (const finish of [page => page.timers.get(1).fn(), page => page.children[0].events.animationend({ target: page.children[0], animationName: 'pf-intro-exit' })]) {
    const page = fixture();
    page.children[0].events.animationend({ target: {}, animationName: 'pf-intro-pink' });
    assert.equal(page.children.length, 1);
    finish(page);
    assert.equal(page.children.length, 0);
    assert.equal(page.timers.size, 0);
    assert.equal(page.documentEvents.size, 0);
    assert.equal(page.windowEvents.size, 0);
    assert.equal(page.mediaEvents.size, 0);
  }
  assert.match(css, /animation: pf-intro-exit 700ms cubic-bezier\(\.76, 0, \.24, 1\) 2700ms forwards;/);
  assert.match(css, /animation: pf-intro-drop 600ms cubic-bezier\(\.5, 0, \.9, \.4\) 1850ms forwards;/);
  assert.match(css, /animation: pf-intro-title 650ms cubic-bezier\(\.22, 1, \.36, 1\) 2100ms both;/);
  assert.match(css, /to \{ transform: translateY\(-100%\); visibility: hidden; \}/);
  assert.doesNotMatch(css, /infinite|will-change|filter:|perspective|rotateY/);
  assert.doesNotMatch(source, /document\.body\.style|scrollIntoView|scrollTo\(/);
  assert.match(css, /pointer-events: none;/);
});

test('broken or slow photos skip the decoration instead of delaying the homepage', () => {
  const slow = fixture({ photoReady: false });
  slow.timers.get(2).fn();
  assert.equal(slow.children.length, 0);
  assert.equal(slow.timers.size, 0);
  const broken = fixture();
  broken.photos[0].events.error();
  assert.equal(broken.children.length, 0);
  assert.equal(broken.documentEvents.size, 0);
  assert.equal(Object.keys(broken.photos[1].events).length, 0);
  const ready = fixture();
  ready.timers.get(2).fn();
  assert.equal(ready.children.length, 1);
});

test('interaction, tab hiding, page exit and motion preference changes dismiss immediately', () => {
  const finishes = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focusin'].map(type => page => page.documentEvents.get(type)());
  finishes.push(page => { page.document.hidden = true; page.documentEvents.get('visibilitychange')(); });
  finishes.push(page => page.windowEvents.get('pagehide')());
  finishes.push(page => page.windowEvents.get('pageswap')());
  finishes.push(page => { page.preference.matches = true; page.mediaEvents.get('change')(); });
  finishes.forEach(finish => { const page = fixture(); finish(page); assert.equal(page.children.length, 0); assert.equal(page.timers.size, 0); });
});

test('only a loopback preview may replay and it still honors reduced motion and storage failure', () => {
  assert.equal(fixture({ url: 'http://127.0.0.1:8081/index.html?preview=intro', seen: true, navigation: 'reload', painted: true }).children.length, 1);
  assert.equal(fixture({ url: 'https://pureform.test/index.html?preview=intro', seen: true }).children.length, 0);
  assert.equal(fixture({ url: 'http://localhost:8081/index.html?preview=intro', reduced: true }).children.length, 0);
  assert.equal(fixture({ url: 'http://localhost:8081/index.html?preview=intro', blockedStorage: true }).children.length, 0);
});

test('intro stays lightweight, uses bounded photos and only the homepage loads its non-blocking script', () => {
  assert.ok(Buffer.byteLength(source) < 8000);
  assert.ok(Buffer.byteLength(css) < 5000);
  assert.match(css, /object-fit: contain/);
  assert.ok(['assets/lifestyle/grey-vanity-600.webp', 'assets/lifestyle/pink-shower-600.webp'].reduce((total, file) => total + statSync(path.join(__dirname, '..', file)).size, 0) < 100000);
  for (const file of ['index.html']) {
    const html = read(file);
    assert.equal((html.match(/src="assets\/pureform-intro\.js" defer>/g) || []).length, 1, file);
    assert.match(html, /href="assets\/pureform-intro\.css"/);
    assert.doesNotMatch(html, /pureform-intro\.js"[^>]*blocking=/);
  }
  for (const file of ['products.html', 'pureform-product-detail.html', 'about.html', 'reviews.html', 'policy.html', 'contact.html', 'cart.html', 'checkout.html', 'admin/index.html', 'admin/dashboard.html', 'admin/reset-password.html', 'faq.html']) {
    assert.doesNotMatch(read(file), /pureform-intro/, file);
  }
});
