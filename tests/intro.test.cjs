const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const source = read('assets/pureform-intro.js');
const gate = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('pf_intro_seen'))[1];

function visit({ address = 'https://pureform.test/index.html', storage = new Map(), type = 'navigate',
  reduced = false, hidden = false, blockedStorage = false } = {}) {
  const classes = new Set();
  vm.runInNewContext(gate, {
    URLSearchParams,
    location: new URL(address),
    Element: { prototype: { animate() {} } },
    performance: { getEntriesByType: () => [{ type }] },
    document: { hidden, documentElement: { classList: { add: value => classes.add(value) } } },
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      getItem(key) {
        if (blockedStorage) throw new Error('Storage unavailable');
        return storage.get(key);
      },
      setItem: (key, value) => storage.set(key, value)
    }
  });
  return classes.has('pf-intro-active');
}

test('an eligible homepage visit plays once and the explicit preview can replay', () => {
  const storage = new Map();
  assert.equal(visit({ storage }), true);
  assert.equal(storage.get('pf_intro_seen'), '1');
  assert.equal(visit({ storage }), false);
  assert.equal(visit({ type: 'reload' }), false);
  assert.equal(visit({ type: 'back_forward' }), false);
  assert.equal(visit({ address: 'https://pureform.test/?intro=1', storage, type: 'reload' }), true);
});

test('intro respects motion preference, direct links and unavailable browser storage', () => {
  for (const options of [{ reduced: true, address: 'https://pureform.test/?intro=1' },
    { hidden: true }, { blockedStorage: true }, { address: 'https://pureform.test/#reviews' },
    { address: 'https://pureform.test/?payment=success' }, { address: 'https://pureform.test/?session_id=example' }]) {
    assert.equal(visit(options), false);
  }
  assert.ok(html.indexOf('pf_intro_seen') < html.indexOf('<body'));
  for (const file of ['products.html', 'pureform-product-detail.html', 'about.html', 'reviews.html',
    'policy.html', 'contact.html', 'cart.html', 'checkout.html', 'admin/index.html', 'faq.html']) {
    assert.doesNotMatch(read(file), /pureform-intro/, file);
  }
});

function readTimeline() {
  const instrumented = source.replace("  document.addEventListener('keydown', onKeydown);",
    "  globalThis.timeline = { INTRO, travelFrames };\n  document.addEventListener('keydown', onKeydown);");
  const context = {
    document: { documentElement: { classList: { contains: () => true } }, addEventListener() {} },
    window: { addEventListener() {} },
    matchMedia: () => ({ addEventListener() {} }),
    setTimeout() {}
  };
  vm.runInNewContext(instrumented, context);
  return context.timeline;
}

test('all four studio entrances follow separate paths at their measured hero size and rotation', () => {
  const { INTRO, travelFrames } = readTimeline();
  const target = { x: 212, y: 287, width: 100, height: 160, halfBounds: [51, 81], rotation: -.4 };
  for (const width of [390, 768, 1366, 1920]) {
    const starts = new Set();
    for (const part of INTRO.order) {
      const frames = travelFrames(target, part, { width, height: 800 });
      starts.add(frames[0].transform);
      assert.equal(frames.at(-1).offset, 1);
      assert.equal(frames.at(-1).transform, 'translate3d(162px,207px,0) rotate(-0.4deg)');
      assert.ok(frames.every(frame => /^translate3d\(.+\) rotate\([\d.e-]+deg\)$/.test(frame.transform)));
      assert.ok(frames.slice(1).every((frame, i) => frame.offset > frames[i].offset));
    }
    assert.equal(starts.size, INTRO.order.length);
  }
});

test('rising paths never reverse or change speed at bends and tilt settles without overshoot', () => {
  const { INTRO, travelFrames } = readTimeline();
  const target = { x: 500, y: 350, width: 100, height: 160, halfBounds: [51, 81], rotation: -.4 };
  for (const part of INTRO.order) {
    const frames = travelFrames(target, part, { width: 1366, height: 800 });
    const points = frames.map(frame => frame.transform.match(/translate3d\(([^p]+)px,([^p]+)px,0\) rotate\(([^d]+)deg/).slice(1).map(Number));
    const steps = points.slice(1).map((point, index) => {
      const previous = points[index];
      assert.ok(Math.abs(point[0] - 450) <= Math.abs(previous[0] - 450));
      assert.ok(point[1] <= previous[1], part + ' must rise continuously');
      assert.ok(Math.abs(point[2] - target.rotation) <= Math.abs(previous[2] - target.rotation));
      return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    });
    assert.ok(Math.max(...steps) / Math.min(...steps) < 1.01, part + ' must have uniform spatial samples');
    assert.ok(Math.abs(points[0][2] - target.rotation) <= 7);
  }
});

test('the intro keeps the existing Grey artwork through its hero handoff', () => {
  const { INTRO } = readTimeline();
  assert.equal(INTRO.color, 'grey');
  assert.equal(INTRO.loadTimeout, 2500);
  assert.ok(INTRO.revealAt < INTRO.whiteStart + INTRO.flightDuration);
  const handoff = INTRO.whiteStart + INTRO.flightDuration + (INTRO.order.length - 1) * INTRO.stagger;
  assert.ok(INTRO.revealAt + INTRO.backdropFade < handoff);
  for (const part of INTRO.order) {
    assert.ok(existsSync(path.join(__dirname, '../assets/floating-scene', INTRO.color + '-' + part + '.webp')));
  }
  assert.match(source, /scene\.prepareColor\(INTRO\.color\)/);
  assert.match(source, /image\.src = original\.currentSrc \|\| original\.src/);
  assert.doesNotMatch(source, /pink|black|layerFrames|colorFade|maskImage/i);
  assert.doesNotMatch(source, /hue-rotate|style\.filter/);
});
