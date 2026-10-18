const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const css = readFileSync(path.join(root, 'assets/pureform-home.css'), 'utf8');

test('homepage reviews are reachable directly from navigation and the mobile hero', () => {
  assert.match(html, /<li><a href="#reviews">Reviews<\/a><\/li>/);
  assert.match(html, /class="home-hero-reviews home-text-link" href="#reviews">Customer reviews<\/a>/);
  assert.match(html, /id="reviews" aria-labelledby="reviewsTitle" tabindex="-1"/);
  assert.equal((html.match(/id="reviews"/g) || []).length, 1);
});

test('homepage keeps the existing three quotes and links to the full review page', () => {
  const reviews = html.slice(html.indexOf('id="reviews"'), html.indexOf('class="home-section home-faq"'));
  assert.match(reviews, /<h2 id="reviewsTitle">Customer reviews<\/h2>/);
  assert.equal((reviews.match(/<blockquote>/g) || []).length, 3);
  assert.match(reviews, /href="reviews.html">Read all reviews<\/a>/);
  assert.doesNotMatch(reviews, /Verified buyer|Verified purchase|aggregateRating|out of 5 stars/);
});

test('mobile review shortcut is touch-sized without changing desktop hero controls', () => {
  assert.match(css, /\.home-hero-reviews\s*\{\s*display: none;/);
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.home-hero-reviews\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 44px;/);
  assert.match(mobile, /\.home-benefits,\s*\.home-review-grid,\s*\.home-faq\s*\{\s*grid-template-columns: 1fr;/);
});
