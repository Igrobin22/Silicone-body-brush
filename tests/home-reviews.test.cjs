const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const css = readFileSync(path.join(root, 'assets/pureform-home.css'), 'utf8');
const product = readFileSync(path.join(root, 'pureform-product-detail.html'), 'utf8');
const reviewPage = readFileSync(path.join(root, 'reviews.html'), 'utf8');

test('reviews stay available through the homepage shortcut and footer', () => {
  assert.match(html, /href="reviews.html">Customer reviews<\/a>/);
  assert.match(html, /class="home-hero-reviews home-text-link" href="#reviews">Customer reviews<\/a>/);
  assert.match(html, /id="reviews" aria-labelledby="reviewsTitle" tabindex="-1"/);
  assert.equal((html.match(/id="reviews"/g) || []).length, 1);
});

test('homepage shows four reviews and links to the full review page', () => {
  const reviews = html.slice(html.indexOf('id="reviews"'), html.indexOf('class="home-section home-faq"'));
  assert.match(reviews, /<h2 id="reviewsTitle">Customer reviews<\/h2>/);
  assert.equal((reviews.match(/<blockquote>/g) || []).length, 4);
  assert.match(reviews, /Mariam A\. &middot; Dubai, UAE/);
  assert.match(reviews, /href="reviews.html">Read all reviews<\/a>/);
  assert.doesNotMatch(reviews, /Verified buyer|Verified purchase|aggregateRating/);
});

test('homepage photo reviews keep the review-page image, quote and rating pairings', () => {
  const cards = [...html.matchAll(/<figure class="home-review">([\s\S]*?)<\/figure>/g)].map(match => match[1]);
  const fullReviewCards = [...reviewPage.matchAll(/<article class="review-card">([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.equal(cards.length, 4);
  cards.forEach((card, index) => {
    const source = card.match(/src="([^"]+)"/)[1];
    const original = fullReviewCards[index];
    assert.equal(source, original.match(/src="([^"]+)"/)[1]);
    assert.match(card, /width="\d+" height="\d+" loading="lazy" decoding="async"/);
    assert.match(card, /alt="Customer photo for [^"]+"/);
    assert.ok(original.includes(card.match(/<blockquote>(.*?)<\/blockquote>/)[1]));
    const rating = original.match(/aria-label="(\d out of \d stars)"/)[1];
    assert.ok(card.includes('role="img" aria-label="' + rating + '"'));
  });
});

test('mobile review shortcut is touch-sized and the four cards wrap into two columns', () => {
  assert.match(css, /\.home-hero-reviews\s*\{\s*display: none;/);
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.home-hero-reviews\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 44px;/);
  assert.match(css, /\.home-review-grid\s*\{[^}]*display: grid;[^}]*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 1000px\)\s*\{\s*\.home-review-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html, /class="home-review-grid" role="group" aria-label="Featured customer photo reviews">/);
  assert.match(css, /\.home-review-photo\s*\{[^}]*height: 200px;[^}]*object-fit: contain;/);
});

test('each featured review has its own local photo or matching fallback', () => {
  const images = [...html.matchAll(/<img class="home-review-photo"[^>]+>/g)].map(match => match[0]);
  const names = ['mariam.jpg', 'sara.jpg', 'priya.jpg', 'gift-set.webp'];
  assert.equal(images.length, names.length);
  images.forEach((image, index) => {
    const local = (image.match(/data-pf-fallback="([^"]+)"/) || image.match(/src="([^"]+)"/))[1];
    assert.equal(local, 'assets/reviews/' + names[index]);
    const bytes = readFileSync(path.join(root, local));
    assert.ok(bytes.length > 1000 && bytes.length < 100000, local);
  });
});

test('the full review page keeps the original attributions and one card per photo', () => {
  const quote = 'The long handle makes the back brush useful every day. It rinses quickly and feels cleaner than my old sponge.';
  for (const page of [html, reviewPage]) {
    assert.equal(page.split(quote).length - 1, 1);
    assert.equal((page.match(/Dubai, UAE/g) || []).length >= 1, true);
    assert.doesNotMatch(page, /Verified buyer|Verified purchase|aggregateRating|reviewCount|ratingCount/);
  }
  const cards = [...reviewPage.matchAll(/<article class="review-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length, 11);
  assert.equal(new Set(cards.map(card => card[1].match(/src="([^"]+)"/)[1])).size, cards.length);
  assert.match(cards[0][1], /Mariam A\./);
  assert.match(cards[0][1], /Dubai, UAE/);
  assert.match(cards[0][1], /March 2026/);
  assert.match(cards[0][1], /aria-label="5 out of 5 stars"/);
  assert.match(cards[0][1], /data-pf-fallback="assets\/reviews\/mariam.jpg"/);
  assert.equal(cards[0][1].match(/src="([^"]+)"/)[1], html.match(/<img class="home-review-photo" src="([^"]+)"/)[1]);
  assert.match(cards[1][1], /Sara J\.[\s\S]*London, UK[\s\S]*February 2026/);
  assert.match(cards[2][1], /Priya S\.[\s\S]*Mumbai, India[\s\S]*January 2026/);
  for (const [, card] of cards.slice(3)) {
    assert.doesNotMatch(card, /review-location|review-date/);
    const photo = card.match(/src="(assets\/reviews\/[^"]+\.webp)"/)[1];
    const bytes = readFileSync(path.join(root, photo));
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.match(card, /width="\d+" height="\d+" loading="lazy"/);
  }
  assert.match(product, /href="reviews.html">Read customer reviews<\/a>/);
  assert.doesNotMatch(product, /class="pdp-review-photo"/);
  assert.match(reviewPage, /<h2 class="section-title">11 photo reviews<\/h2>/);
});

test('the product links to all reviews without implying they come from one market', () => {
  assert.match(product, /href="reviews.html">Read all customer reviews<\/a>/);
  const reviewHeader = reviewPage.match(/<header class="retail-heading retail-wrap">([\s\S]*?)<\/header>/)[1];
  assert.doesNotMatch(reviewHeader, /United Arab Emirates|Dubai|UAE/);
  assert.match(reviewPage, /<p class="review-location">Dubai, UAE<\/p>/);
});

test('review landmark focus remains visible on its heading instead of outlining the entire section', () => {
  assert.match(css, /\.home-reviews:focus\s*\{\s*outline: none;/);
  assert.match(css, /\.home-reviews:focus-visible #reviewsTitle\s*\{\s*outline: 2px solid var\(--dark\);/);
});
