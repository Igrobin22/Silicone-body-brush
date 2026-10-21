const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const css = read('assets/pureform-home.css');
const section = html.slice(html.indexOf('<section class="home-section home-lifestyle"'), html.indexOf('<section class="home-section home-reviews"'));

test('lifestyle scenes are a distinct homepage section, not hero or customer review replacements', () => {
  assert.match(section, /id="daily-ritual" aria-labelledby="lifestyleTitle"/);
  assert.equal((section.match(/<figure class="home-lifestyle-shot">/g) || []).length, 3);
  assert.match(section, /AI-styled product scenes\. Bathroom accessories not included\./);
  assert.doesNotMatch(section, /blockquote|rating|Verified|sold this week/);
  assert.doesNotMatch(html.slice(html.indexOf('id="hero"'), html.indexOf('class="home-promises"')), /assets\/lifestyle\//);
  assert.doesNotMatch(html.slice(html.indexOf('<section class="home-section home-reviews"')), /assets\/lifestyle\//);
});

test('each lifestyle image has responsive, lazy-loaded, square local assets and useful alt text', () => {
  const images = [...section.matchAll(/<img\s[^>]+>/g)].map(match => match[0]);
  assert.equal(images.length, 3);
  for (const image of images) {
    assert.match(image, /width="1200" height="1200" loading="lazy" decoding="async"/);
    assert.match(image, /alt="[^"]{30,}"/);
    assert.match(image, /sizes="[^"]+"/);
    assert.doesNotMatch(image, /fetchpriority="high"|\.png/);
    const source = image.match(/src="([^"]+)"/)[1];
    assert.match(image, new RegExp(source.replace(/\.webp$/, '-600.webp') + ' 600w, ' + source + ' 1200w'));
    for (const file of [source, source.replace(/\.webp$/, '-600.webp')]) {
      const bytes = readFileSync(path.join(root, file));
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.ok(statSync(path.join(root, file)).size < (file.includes('-600') ? 80000 : 180000), file);
    }
  }
});

test('lifestyle captions open only the corresponding product color', () => {
  const captions = [...section.matchAll(/<figcaption>(.*?)<\/figcaption>/g)].map(match => match[1]);
  assert.match(captions[0], /product=pureform-4pc-set-grey/);
  assert.match(captions[1], /product=pureform-4pc-set-grey/);
  assert.match(captions[2], /product=pureform-4pc-set-pink/);
});

test('lifestyle photos stay uncropped and support native mobile and keyboard scrolling', () => {
  assert.match(css, /\.home-lifestyle-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.home-lifestyle-shot img\s*\{[^}]*aspect-ratio: 1;[^}]*object-fit: contain;/);
  assert.match(css, /\.home-lifestyle-grid\s*\{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x proximity;/);
  assert.match(css, /\.home-lifestyle-shot\s*\{[^}]*flex: 0 0 min\(360px, calc\(100% - 28px\)\);/);
  assert.match(section, /role="group" aria-label="PureForm lifestyle images" tabindex="0"/);
});

test('image provenance and final prompts are documented without modifying catalog sources', () => {
  const notes = read('assets/lifestyle/README.md');
  assert.match(notes, /built-in image_gen/);
  assert.match(notes, /not customer photographs/);
  for (const prompt of ['Grey Vanity', 'Pink Shower', 'Grey Rinse']) assert.ok(notes.includes('### ' + prompt));
  assert.doesNotMatch(read('assets/pureform-public-catalog.js'), /assets\/lifestyle\//);
});
