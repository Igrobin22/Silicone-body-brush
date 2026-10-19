const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const files = ['index.html', 'products.html', 'pureform-product-detail.html', 'cart.html', 'checkout.html', 'about.html', 'reviews.html', 'contact.html', 'policy.html'];
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
const css = read('assets/pureform-retail.css');

test('storefront pages share one complete static footer and lightweight layout stylesheet', () => {
  const footer = read('index.html').match(/<footer class="retail-footer">[\s\S]*?<\/footer>/)[0];
  for (const file of files) {
    const html = read(file);
    assert.equal(html.match(/<footer class="retail-footer">[\s\S]*?<\/footer>/)[0], footer, file);
    assert.equal((html.match(/<footer /g) || []).length, 1, file);
    assert.ok(html.includes('href="assets/pureform-retail.css"'), file);
  }
  for (const link of ['products.html', 'policy.html#faq', 'contact.html', 'policy.html#delivery', 'policy.html#returns', 'policy.html#privacy', 'https://t.me/Pureforbot', 'mailto:buyx.dxb@gmail.com']) {
    assert.ok(footer.includes('href="' + link + '"'), link);
  }
});

test('shared retail styles do not target or replace the homepage hero', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /\.home-hero|#hero|\.home-page\s+(?:main|h1|\*)\s*\{/);
  assert.match(read('index.html'), /<section class="home-hero" id="hero" aria-labelledby="heroTitle">/);
  assert.match(read('index.html'), /<span>Soft touch\.<\/span><span><em>Deep clean\.<\/em><\/span><span>Every day\.<\/span>/);
});

test('secondary pages have breadcrumbs and exactly one visible main title', () => {
  for (const file of files.filter(file=>file!=='index.html')) {
    const html=read(file);
    assert.ok(html.includes('aria-label="Breadcrumb"'),file);
    const headings=[...html.matchAll(/<h1\b[^>]*>/g)].map(m=>m[0]);
    assert.equal(headings.length,1,file);
    assert.ok(!headings[0].includes('sr-only'),file);
  }
});

test('FAQ disclosures are grouped with matching topic navigation and policies retain anchors', () => {
  const faq=read('policy.html');
  assert.equal((faq.match(/<details class="retail-question"/g)||[]).length,12);
  for(const id of ['faq-product','faq-orders','faq-delivery']) {
    assert.ok(faq.includes('href="#'+id+'"'));
    assert.ok(faq.includes('id="'+id+'"'));
  }
  const policy=read('policy.html');
  for(const id of ['delivery','shipping','returns','return-process','refund','privacy','terms','support']) {
    assert.ok(policy.includes('href="#'+id+'"'));
    assert.equal((policy.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  }
});

test('cart and checkout show progress without changing secure checkout fields', () => {
  for(const file of ['cart.html','checkout.html']) {
    const html=read(file);
    assert.match(html,/aria-label="Order progress"/);
    assert.equal((html.match(/aria-current="step"/g)||[]).length,1);
  }
  const checkout=read('checkout.html');
  for(const id of ['checkoutForm','checkoutSubtotal','checkoutShipping','checkoutTotal','checkoutMobileTotal','checkoutSubmit','checkoutVerifyPayment']) assert.ok(checkout.includes('id="'+id+'"'));
  assert.doesNotMatch(checkout, /autocomplete="cc-(?:number|csc)"/);
  assert.match(css,/\.retail-page \.cart-quantity-control input \{ font-size: 16px;/);
});

test('support does not advertise stale bundle prices or an unconfigured combo discount', () => {
  const html=read('contact.html');
  assert.match(html, /<label for="order-bundle">Number of sets<\/label>/);
  assert.doesNotMatch(html, /Single Set - AED|Two Sets - AED|Three Sets - AED|Family Bundle/);
  assert.match(html,/action="mailto:buyx.dxb@gmail.com"/);
  assert.match(html,/href="https:\/\/t.me\/Pureforbot"/);
  assert.match(html,/Your email app will open/);
});
