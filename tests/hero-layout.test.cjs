const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('assets/pureform-home.css');
const html = read('index.html');

test('hero photo, bubbles and pause control share one bounded scene before the copy', () => {
  const scene = html.slice(html.indexOf('<div class="home-hero-scene">'), html.indexOf('<div class="home-hero-content">'));
  assert.match(scene, /<picture class="home-hero-media">/);
  assert.match(scene, /id="heroBubbles" aria-hidden="true"/);
  assert.match(scene, /class="home-hero-motion-toggle"/);
  assert.match(css, /\.home-hero-scene\s*\{[^}]*width: min\(100%, 1600px\);[^}]*isolation: isolate;/);
});

test('hero contains the original photograph without stretching or cropping at wide aspect ratios', () => {
  const image = css.match(/\.home-hero-media img\s*\{[^}]*\}/)[0];
  for (const rule of ['width: auto;', 'height: auto;', 'max-width: 100%;', 'max-height: 100%;', 'object-fit: contain;']) assert.ok(image.includes(rule), rule);
  assert.doesNotMatch(css, /object-fit: cover/);
  assert.match(html, /FOR_MOBILE_dbeja3\.png/);
  assert.match(html, /ChatGPT_Image_May_14_2026_11_40_44_AM_jzx8xg\.png/);
});

test('compact hero reserves scene space in normal flow without overlapping the headline', () => {
  assert.match(css, /\.home-hero-scene\s*\{\s*position: relative;\s*height: 300px;/);
  assert.match(css, /\.home-hero-scene\s*\{\s*height: clamp\(220px, 36svh, 320px\);/);
  assert.match(css, /\.home-hero-content\s*\{\s*display: block;\s*padding: 12px 24px 20px;/);
  assert.doesNotMatch(css, /padding(?:-top)?: (?:250|300)px/);
  assert.doesNotMatch(css, /\.home-hero-bubbles\s*\{[^}]*height:/);
});

test('empty copy-overlay space cannot block the scene pause control', () => {
  assert.match(css, /\.home-hero-content\s*\{[^}]*pointer-events: none;/);
  for (const selector of ['home-hero-copy-block', 'home-hero-specs']) {
    assert.match(css, new RegExp('\\.' + selector + '\\s*\\{[^}]*pointer-events: auto;'));
  }
});
