const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = readFileSync(path.join(__dirname, '../assets/pureform-mobile-menu.js'), 'utf8');
const setup = source.slice(source.indexOf('  function setupMenuTabs('), source.indexOf('  const menuButton'));
const css = readFileSync(path.join(__dirname, '../assets/pureform-mobile-menu.css'), 'utf8');
const transitions = readFileSync(path.join(__dirname, '../assets/pureform-page-transitions.css'), 'utf8');

function fixture({ active = 2, width = 420, hover = true, observer = true, brokenObserver = false } = {}) {
  const frames = [], events = {}, targets = [];
  const element = rect => {
    const classes = new Set(), styles = {}, listeners = {}, attributes = {};
    return { children: [], classes, styles, listeners, attributes, rect,
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      style: { setProperty: (key, value) => styles[key] = value },
      getBoundingClientRect() { return this.rect; },
      matches() { return this.focusVisible !== false; },
      appendChild(child) { this.children.push(child); },
      addEventListener: (name, callback) => { listeners[name] = callback; },
      getAttribute: name => attributes[name], setAttribute: (name, value) => { attributes[name] = value; }
    };
  };
  const menu = element({ left: 40, top: 50, width, height: 44 });
  const links = Array.from({ length: 5 }, (_, index) => element({ left: 40 + index * 75, top: 50, width: 60 + index * 3, height: 44 }));
  if (active >= 0) links[active].attributes['aria-current'] = 'page';
  const window = { matchMedia: () => ({ matches: hover }), requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, addEventListener: (name, fn) => { events[name] = fn; } };
  if (observer) window.ResizeObserver = class { constructor(fn) { if (brokenObserver) throw Error('Observer unavailable'); this.notify = fn; } observe(target) { targets.push(target); } };
  const context = vm.createContext({ window, document: { createElement: () => element({}), fonts: { ready: Promise.resolve() } } });
  new vm.Script(setup).runInContext(context);
  context.setupMenuTabs(menu, links);
  return { menu, links, highlight: menu.children[0], indicator: menu.children[1], frames, targets, events, flush() { while (frames.length) frames.shift()(); } };
}

test('menu underline follows the real current page, never a hard-coded first tab', () => {
  const f = fixture();
  assert.equal(f.indicator.styles['--pf-tab-x'], '150px');
  assert.equal(f.indicator.styles['--pf-tab-width'], '66px');
  assert.equal(f.indicator.styles['--pf-tab-y'], '46px');
  assert.equal(f.indicator.classes.has('is-visible'), true);
  assert.equal(f.highlight.classes.has('is-visible'), false);
  assert.equal(fixture({ active: -1 }).indicator.classes.has('is-visible'), false);
});

test('one shared highlight slides between hovered links and leaves the active page unchanged', () => {
  const f = fixture();
  f.links[1].listeners.pointerenter({ pointerType: 'mouse' });
  assert.equal(f.highlight.styles['--pf-tab-x'], '75px');
  assert.equal(f.highlight.classes.has('is-visible'), true);
  f.links[4].listeners.pointerenter({ pointerType: 'mouse' });
  assert.equal(f.highlight.styles['--pf-tab-x'], '300px');
  assert.equal(f.highlight.styles['--pf-tab-width'], '72px');
  assert.equal(f.indicator.styles['--pf-tab-x'], '150px');
  f.menu.listeners.pointerleave();
  assert.equal(f.highlight.classes.has('is-visible'), false);
});

test('keyboard focus gets the same highlight and touch cannot leave a sticky hover', () => {
  const f = fixture();
  f.links[3].listeners.pointerenter({ pointerType: 'touch' });
  assert.equal(f.highlight.classes.has('is-visible'), false);
  f.menu.listeners.focusin({ target: f.links[3] });
  assert.equal(f.highlight.styles['--pf-tab-x'], '225px');
  f.menu.listeners.focusout({ relatedTarget: f.links[4] });
  assert.equal(f.highlight.styles['--pf-tab-x'], '300px');
  f.menu.listeners.focusout({ relatedTarget: null });
  assert.equal(f.highlight.classes.has('is-visible'), false);
  f.links[0].focusVisible = false;
  f.menu.listeners.focusin({ target: f.links[0] });
  assert.equal(f.highlight.classes.has('is-visible'), false, 'Mouse focus does not leave a sticky highlight');
  const coarse = fixture({ hover: false });
  coarse.links[1].listeners.pointerenter({ pointerType: 'mouse' });
  assert.equal(coarse.highlight.classes.has('is-visible'), false);
});

test('measurements respond to resize, font changes and restored history without new dependencies', async () => {
  const f = fixture();
  assert.equal(f.targets.length, 6);
  f.links[2].rect.left = 240;
  f.links[2].rect.width = 90;
  f.events.resize(); f.events.resize();
  assert.equal(f.frames.length, 1);
  f.flush();
  assert.equal(f.indicator.styles['--pf-tab-x'], '200px');
  assert.equal(f.indicator.styles['--pf-tab-width'], '90px');
  f.menu.rect.width = 0;
  f.events.pageshow(); f.flush();
  assert.equal(f.indicator.classes.has('is-visible'), false);
  f.menu.rect.width = 420;
  await Promise.resolve(); f.flush();
  assert.equal(f.indicator.classes.has('is-visible'), true);
  assert.equal(fixture({ observer: false }).indicator.classes.has('is-visible'), true);
  assert.equal(fixture({ brokenObserver: true }).indicator.classes.has('is-visible'), true);
});

test('decoration is hidden from assistive technology, preserves native links and respects reduced motion', () => {
  const f = fixture();
  for (const decoration of f.menu.children) {
    assert.equal(decoration.attributes['aria-hidden'], 'true');
    assert.equal(decoration.attributes.role, 'presentation');
  }
  assert.doesNotMatch(setup, /preventDefault|sessionStorage|localStorage|fetch\(|setTimeout|role.*tab|addEventListener\('click'/);
  assert.match(css, /prefers-reduced-motion: no-preference[\s\S]*pf-nav-hover-highlight[^}]*transition:/);
  assert.match(css, /\.site-header \.pf-nav-tabs a:focus-visible/);
  assert.match(transitions, /view-transition-name: pf-nav-indicator;/);
});
