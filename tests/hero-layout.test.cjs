const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const css = read('assets/pureform-home.css');
const html = read('index.html');
const floating = read('assets/pureform-floating-scene.css');

test('hero floats all four tools with color controls outside the artwork image role', () => {
  const scene = html.slice(html.indexOf('<div class="home-hero-scene">'), html.indexOf('<div class="home-hero-content">'));
  assert.match(scene, /data-float-stage role="img"/);
  for (const part of ['back', 'body', 'scalp', 'face']) assert.ok(scene.includes('data-float-part="' + part + '"'));
  assert.ok(scene.indexOf('aria-hidden="true"') < scene.indexOf('class="float-controls"'));
  assert.match(scene, /aria-label="Choose set color"/);
  assert.match(scene, /data-float-motion/);
  assert.match(html, /src="assets\/pureform-floating-scene.js" defer/);
});

test('hero starts with local aligned assets and defers the unselected colors', () => {
  const scene = html.slice(html.indexOf('<div class="home-hero-scene">'), html.indexOf('<div class="home-hero-content">'));
  assert.match(scene, /background.webp"[^>]*fetchpriority="high"/);
  assert.equal((scene.match(/data-color-layer="grey"/g) || []).length, 4);
  assert.doesNotMatch(scene, /src="[^"]*(?:black-|pink-|cloudinary)/);
  assert.match(floating, /--hero-scene-height: min\(780px, calc\(100svh - var\(--hero-header-height\)\)/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] \.float-scene \{[^}]*height: var\(--hero-scene-height\);/);
  assert.match(html, /data-pf-home-color-label/);
});

test('hero uses the full-width artwork with overlaid copy and mobile-safe purchase controls', () => {
  assert.match(floating, /\.home-hero\[data-floating-scene\] \{[^}]*width: 100%;[^}]*margin: 0 0 24px;/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] \.float-scene \{[^}]*border: 0; border-radius: 0; box-shadow: none;/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] \.float-scene::after \{ display: none; \}/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] \.home-hero-content \{ position: absolute; inset: 0;/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] h1 \{ position: absolute;/);
  assert.match(floating, /\.home-hero\[data-floating-scene\] \.home-hero-actions a \{ display: inline-flex;/);
  assert.match(html, /class="home-hero-variant"><span data-pf-home-color-label>Grey<\/span> <span>4-piece set<\/span>/);
  assert.doesNotMatch(html, /data-pf-home-price/);
  assert.match(floating, /\.home-hero-variant \{[^}]*font: 400 clamp\([^}]*var\(--heading\)/);
});

test('empty copy-overlay space cannot block the scene pause control', () => {
  assert.match(css, /\.home-hero-content\s*\{[^}]*pointer-events: none;/);
  for (const selector of ['home-hero-copy-block', 'home-hero-specs']) {
    assert.match(css, new RegExp('\\.' + selector + '\\s*\\{[^}]*pointer-events: auto;'));
  }
  assert.match(floating, /\.home-hero-purchase\s*\{[^}]*pointer-events: auto;/);
});
