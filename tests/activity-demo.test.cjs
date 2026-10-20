const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '../assets/pureform-activity-demo.js'), 'utf8');
const grey = 'pureform-4pc-set-grey';

function fixture({ hostname = '127.0.0.1', pathname = '/products.html', search = '?demo=activity', storage = new Map(), now = 1000000, reduce = false, blockedStorage = false } = {}) {
  let clock = now;
  let reads = 0;
  const window = {
    location: { hostname, pathname, search, href: `http://${hostname}${pathname}${search}`, origin: `http://${hostname}` },
    matchMedia() { return { matches: reduce }; }
  };
  const context = vm.createContext({
    window, URL, URLSearchParams, Date: { now: () => clock },
    document: { visibilityState: 'visible', querySelector() { return null; }, querySelectorAll() { return []; } },
    localStorage: {
      getItem(key) { reads++; if (blockedStorage) throw Error('Unavailable'); return storage.get(key); },
      setItem(key, value) { if (blockedStorage) throw Error('Unavailable'); storage.set(key, value); }
    }
  });
  const instrumented = source.replace('  start();', 'window.demoTest = { readState, sampleFor, togglePause, setState(value) { state = value; } }; start();');
  new vm.Script(instrumented).runInContext(context);
  return { api: window.demoTest, reads: () => reads, advance(ms) { clock += ms; }, now: () => clock, storage };
}

test('sample activity is unavailable on public and lookalike domains', () => {
  for (const hostname of ['siliconebodybrush2.pages.dev', 'pureform.ae', 'localhost.example.com', '127.0.0.1.example.com']) {
    const page = fixture({ hostname });
    assert.equal(page.api, undefined);
    assert.equal(page.reads(), 0);
  }
});

test('sample activity requires explicit local preview and never runs on checkout or admin', () => {
  for (const options of [{ search: '' }, { search: '?demo=1' }, { pathname: '/checkout.html' }, { pathname: '/admin/dashboard.html' }]) {
    assert.equal(fixture(options).api, undefined);
  }
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) assert.ok(fixture({ hostname }).api);
});

test('sample progression is deterministic, bounded and retained on reload', () => {
  const page = fixture();
  const state = page.api.readState(page.now());
  page.api.setState(state);
  page.storage.set('pureform.activity-demo.v1', JSON.stringify(state));
  assert.equal(page.api.sampleFor(grey, page.now()).stock, 8);
  page.advance(90000);
  const before = page.api.sampleFor(grey, page.now());
  assert.equal(before.stock, 6);
  assert.equal(before.sold, 130);
  assert.equal(before.week, 14);
  const reloaded = fixture({ storage: page.storage, now: page.now() });
  reloaded.api.setState(reloaded.api.readState(reloaded.now()));
  assert.equal(JSON.stringify(reloaded.api.sampleFor(grey, reloaded.now())), JSON.stringify(before));
  assert.equal(reloaded.api.sampleFor(grey, reloaded.now() + 86400000).stock, 2);
  assert.equal(reloaded.api.sampleFor('unknown', reloaded.now()), null);
});

test('pause freezes sample time and resume continues without jumping forward', () => {
  const page = fixture();
  page.api.setState(page.api.readState(page.now()));
  page.advance(45000);
  page.api.togglePause();
  const paused = JSON.stringify(page.api.sampleFor(grey, page.now()));
  page.advance(600000);
  assert.equal(JSON.stringify(page.api.sampleFor(grey, page.now())), paused);
  page.api.togglePause();
  assert.equal(JSON.stringify(page.api.sampleFor(grey, page.now())), paused);
  page.advance(45000);
  assert.equal(page.api.sampleFor(grey, page.now()).stock, 6);
});

test('reduced motion starts paused and damaged storage fails safely', () => {
  const reduced = fixture({ reduce: true });
  const state = reduced.api.readState(reduced.now());
  assert.equal(state.pausedAt, reduced.now());
  reduced.api.setState(state);
  reduced.advance(600000);
  assert.equal(reduced.api.sampleFor(grey, reduced.now()).stock, 8);
  const page = fixture({ storage: new Map([['pureform.activity-demo.v1', '{bad']]) });
  assert.equal(page.api.readState(page.now()).startedAt, page.now());
  const blocked = fixture({ blockedStorage: true });
  blocked.api.setState(blocked.api.readState(blocked.now()));
  assert.doesNotThrow(() => blocked.api.togglePause());
});
