const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const css = readFileSync(path.join(root, 'assets/pureform-home.css'), 'utf8');
const product = readFileSync(path.join(root, 'pureform-product-detail.html'), 'utf8');
const reviewPage = readFileSync(path.join(root, 'reviews.html'), 'utf8');

test('navigation opens the reviews page while the mobile hero retains the homepage review shortcut', () => {
  assert.match(html, /<li><a href="reviews.html">Reviews<\/a><\/li>/);
  assert.match(html, /class="home-hero-reviews home-text-link" href="#reviews">Customer reviews<\/a>/);
  assert.match(html, /id="reviews" aria-labelledby="reviewsTitle" tabindex="-1"/);
  assert.equal((html.match(/id="reviews"/g) || []).length, 1);
});

test('homepage keeps the existing UAE quote and links to the full review page', () => {
  const reviews = html.slice(html.indexOf('id="reviews"'), html.indexOf('class="home-section home-faq"'));
  assert.match(reviews, /<h2 id="reviewsTitle">Customer reviews<\/h2>/);
  assert.equal((reviews.match(/<blockquote>/g) || []).length, 1);
  assert.match(reviews, /Mariam A\. &middot; Dubai, UAE/);
  assert.match(reviews, /href="reviews.html">Read all reviews<\/a>/);
  assert.doesNotMatch(reviews, /Verified buyer|Verified purchase|aggregateRating/);
});

test('homepage photo reviews keep the product-page image, quote and rating pairings', () => {
  const cards = [...html.matchAll(/<figure class="home-review">([\s\S]*?)<\/figure>/g)].map(match => match[1]);
  const productCards = [...product.matchAll(/<article class="pdp-review-card">([\s\S]*?)<\/article>/g)].map(match => match[1]);
  assert.equal(cards.length, 1);
  assert.equal(productCards.length, cards.length);
  cards.forEach((card, index) => {
    const source = card.match(/src="([^"]+)"/)[1];
    const original = productCards[index].match(/src="([^"]+)"/)[1];
    assert.equal(source.slice(source.indexOf('/v178')), original.slice(original.indexOf('/v178')));
    assert.match(source, /\/f_auto,q_auto,w_480\//);
    assert.match(card, /width="675" height="1200" loading="lazy" decoding="async"/);
    assert.match(card, /alt="Customer photo for [^"]+ PureForm review"/);
    assert.ok(productCards[index].includes(card.match(/<blockquote>(.*?)<\/blockquote>/)[1]));
    const rating = productCards[index].match(/aria-label="(\d out of \d stars)"/)[1];
    assert.ok(card.includes('role="img" aria-label="' + rating + '"'));
  });
});

test('mobile review shortcut is touch-sized and a single card does not need a carousel', () => {
  assert.match(css, /\.home-hero-reviews\s*\{\s*display: none;/);
  const mobile = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.match(mobile, /\.home-hero-reviews\s*\{[\s\S]*?display: flex;[\s\S]*?min-height: 44px;/);
  assert.match(mobile, /\.home-review-grid\s*\{[\s\S]*?display: flex;[\s\S]*?overflow-x: auto;[\s\S]*?scroll-snap-type: x proximity;/);
  assert.match(mobile, /\.home-review\s*\{\s*flex: 0 0 min\(320px, calc\(100% - 28px\)\);/);
  assert.match(css, /\.home-review-grid:has\(> :only-child\)\s*\{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 420px\);[^}]*overflow: visible;/);
  assert.match(html, /class="home-review-grid" role="group" aria-label="UAE customer photo reviews">/);
  assert.match(css, /\.home-review-photo\s*\{[^}]*height: 200px;[^}]*object-fit: contain;/);
});

test('each customer review has its own small local photo fallback, not a generic product image', () => {
  const images = [...html.matchAll(/<img class="home-review-photo"[^>]+>/g)].map(match => match[0]);
  const names = ['mariam'];
  assert.equal(images.length, names.length);
  images.forEach((image, index) => {
    const fallback = image.match(/data-pf-fallback="([^"]+)"/)[1];
    assert.equal(fallback, 'assets/reviews/' + names[index] + '.jpg');
    const bytes = readFileSync(path.join(root, fallback));
    assert.ok(bytes.length > 1000 && bytes.length < 100000, fallback);
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  });
});

test('all public review surfaces preserve the existing UAE review attribution', () => {
  const quote = 'The long handle makes the back brush useful every day. It rinses quickly and feels cleaner than my old sponge.';
  for (const page of [html, product, reviewPage]) {
    assert.doesNotMatch(page, /Sara J\.|Priya S\.|London, UK|Mumbai, India|assets\/reviews\/(?:sara|priya)\.jpg/);
    assert.equal(page.split(quote).length - 1, 1);
    assert.equal((page.match(/Dubai, UAE/g) || []).length >= 1, true);
    assert.doesNotMatch(page, /Verified buyer|Verified purchase|aggregateRating|reviewCount|ratingCount/);
  }
  const cards = [...reviewPage.matchAll(/<article class="review-card">([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length, 1);
  assert.match(cards[0][1], /Mariam A\./);
  assert.match(cards[0][1], /Dubai, UAE/);
  assert.match(cards[0][1], /March 2026/);
  assert.match(cards[0][1], /aria-label="5 out of 5 stars"/);
  assert.match(cards[0][1], /data-pf-fallback="assets\/reviews\/mariam.jpg"/);
  assert.equal(cards[0][1].match(/src="([^"]+)"/)[1], html.match(/<img class="home-review-photo" src="([^"]+)"/)[1]);
  assert.match(product, /href="#productReviews">1 photo review<\/a>/);
  assert.match(reviewPage, /<h2 class="section-title">1 photo review<\/h2>/);
  assert.doesNotMatch(product, /3 photo reviews/);
});

test('review section copy is UAE-wide while the individual customer keeps her actual city', () => {
  assert.match(product, /class="pdp-section-copy">Daily-use feedback from the United Arab Emirates\.<\/p>/);
  const description = reviewPage.match(/<meta name="description" content="([^"]+)"/)[1];
  assert.match(description, /United Arab Emirates/);
  assert.doesNotMatch(description, /Dubai/);
  assert.match(product, /<strong>Mariam A\.<\/strong><span>Dubai, UAE<\/span>/);
});

test('review landmark focus remains visible on its heading instead of outlining the entire section', () => {
  assert.match(css, /\.home-reviews:focus\s*\{\s*outline: none;/);
  assert.match(css, /\.home-reviews:focus-visible #reviewsTitle\s*\{\s*outline: 2px solid var\(--dark\);/);
});
