const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const source = read('assets/pureform-hero-bubbles.js');
const css = read('assets/pureform-home.css');
const html = read('index.html');

function fixture({ reduced = false, observer = true, broken = false, missingHero = false } = {}) {
  const attributes = new Map();
  const events = {};
  const buttonEvents = {};
  let callback;
  let observed;
  const preference = { matches: reduced, addEventListener(name, fn) { events['motion-' + name] = fn; } };
  const button = { hidden: true, setAttribute(name, value) { this[name] = value; }, addEventListener(name, fn) { buttonEvents[name] = fn; } };
  const hero = {
    querySelector() { return button; }, setAttribute(name, value) { attributes.set(name, value); },
    getBoundingClientRect() { return { top: 106, bottom: 726 }; }
  };
  const document = { hidden: false, querySelector() { return missingHero ? null : hero; }, addEventListener(name, fn) { events[name] = fn; } };
  const window = { innerHeight: 900, matchMedia() { return preference; }, addEventListener(name, fn) { events[name] = fn; } };
  if (observer) window.IntersectionObserver = class {
    constructor(fn) { if (broken) throw Error('Unavailable'); callback = fn; }
    observe(target) { observed = target; }
  };
  new vm.Script(source).runInNewContext({ window, document });
  return { attributes, events, buttonEvents, button, preference, document, hero, observed,
    intersect(value) { callback([{ target: hero, isIntersecting: value }]); } };
}

test('original soap-bubble layer is decorative, clipped and cannot intercept hero controls', () => {
  const layer = html.match(/<div class="home-hero-bubbles"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.match(layer, /id="heroBubbles" aria-hidden="true"/);
  assert.equal((layer.match(/class="home-hero-bubble bu\d+"/g) || []).length, 12);
  assert.match(html, /aria-label="Pause bubble animation" aria-controls="heroBubbles"/);
  assert.match(html, /src="assets\/pureform-hero-bubbles.js" defer/);
  assert.match(css, /\.home-hero-bubbles\s*\{[^}]*overflow: hidden;[^}]*pointer-events: none;/);
  assert.match(css, /\.home-hero-motion-toggle\s*\{[^}]*width: 44px;[^}]*height: 44px;/);
  const frames = css.match(/@keyframes home-hero-bubble-float\s*\{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(frames, /(?:top|left|bottom|width|height|filter):/);
});

test('visible hero plays bubbles and manual pause/resume preserves the animation timeline', () => {
  const page = fixture();
  assert.equal(page.observed, page.hero);
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  assert.equal(page.button.hidden, false);
  page.buttonEvents.click();
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  assert.equal(page.attributes.get('data-bubbles-paused'), 'true');
  assert.equal(page.button['aria-label'], 'Resume bubble animation');
  page.buttonEvents.click();
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  assert.equal(page.button['aria-label'], 'Pause bubble animation');
  assert.match(css, /animation-play-state: paused;/);
});

test('bubbles stop offscreen, in background tabs and on exit, then resume on return', () => {
  const page = fixture();
  page.intersect(false);
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  page.intersect(true);
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  page.document.hidden = true; page.events.visibilitychange();
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  page.document.hidden = false; page.events.visibilitychange();
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  page.events.pagehide();
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  page.events.pageshow();
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  page.buttonEvents.click(); page.events.pagehide(); page.events.pageshow();
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
});

test('reduced motion disables bubbles and the pause control, including preference changes', () => {
  const page = fixture({ reduced: true });
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  assert.equal(page.button.hidden, true);
  page.preference.matches = false; page.events['motion-change']();
  assert.equal(page.attributes.get('data-bubbles-running'), 'true');
  assert.equal(page.button.hidden, false);
  page.preference.matches = true; page.events['motion-change']();
  assert.equal(page.attributes.get('data-bubbles-running'), 'false');
  assert.equal(page.button.hidden, true);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.home-hero-bubble \{ animation: none; opacity: 0; \}/);
});

test('missing hero or observer fails safely without exposing a non-working control', () => {
  for (const options of [{ observer: false }, { missingHero: true }, { broken: true }]) {
    const page = fixture(options);
    assert.equal(page.button.hidden, true);
    assert.equal(page.attributes.get('data-bubbles-running'), undefined);
    assert.equal(Object.keys(page.buttonEvents).length, 0);
  }
});
