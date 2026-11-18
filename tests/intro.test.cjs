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
    "  globalThis.timeline = { INTRO, distanceAt, travelFrames, layerFrames };\n  document.addEventListener('keydown', onKeydown);");
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
      assert.ok(frames.every(frame => /^translate3d\(.+\) rotate\(-0\.4deg\)$/.test(frame.transform)));
      assert.ok(frames.slice(1).every((frame, i) => frame.offset > frames[i].offset));
    }
    assert.equal(starts.size, INTRO.order.length);
  }
});

test('the studio entrance timing slows between bursts and brakes at the handoff', () => {
  const { distanceAt } = readTimeline();
  const speedAt = time => distanceAt(time) - distanceAt(time - .01);
  const turning = speedAt(.53);
  assert.ok(turning > 0);
  assert.ok(speedAt(.18) > turning * 3);
  assert.ok(speedAt(.82) > turning * 3);
  assert.ok(speedAt(1) < turning * .15);
});

test('the color wave uses existing assets, staggers, and finishes in Pink', () => {
  const { INTRO, layerFrames } = readTimeline();
  assert.equal(INTRO.colors.join(','), 'black,pink,grey');
  assert.equal(INTRO.loadTimeout, 2500);
  assert.ok(INTRO.revealAt < INTRO.whiteStart + INTRO.flightDuration);
  const handoff = INTRO.whiteStart + INTRO.flightDuration + (INTRO.order.length - 1) * INTRO.stagger;
  assert.ok(INTRO.revealAt + INTRO.backdropFade < handoff);
  assert.ok(INTRO.titleOut + INTRO.titleFadeOut < handoff);
  for (const color of INTRO.colors) {
    for (const part of INTRO.order) {
      assert.ok(existsSync(path.join(__dirname, '../assets/floating-scene', color + '-' + part + '.webp')));
    }
    const first = layerFrames(color, 0);
    const last = layerFrames(color, 3);
    assert.equal(first[0].opacity, Number(color === 'black'));
    assert.equal(last.at(-1).opacity, Number(color === 'pink'));
    assert.ok(last[1].offset > first[1].offset);
  }
  assert.doesNotMatch(source, /hue-rotate|style\.filter/);
});
