const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => readFileSync(path.join(__dirname, '..', file), 'utf8');
const files = ['index.html', 'products.html', 'pureform-product-detail.html', 'reviews.html', 'about.html', 'policy.html', 'cart.html', 'checkout.html', 'contact.html'];
const expected = [
  ['index.html', 'Home'], ['products.html', 'Shop'], ['reviews.html', 'Reviews'],
  ['about.html', 'About'], ['policy.html', 'Policies & FAQ'],
];

test('all storefront headers follow Home, Shop, Reviews, About, Policies & FAQ', () => {
  for(const file of files){
    const nav = read(file).match(/<ul class="nav-links">([\s\S]*?)<\/ul>/)[1];
    const links = [...nav.matchAll(/<a\b([^>]+)>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(m=>[m[1].match(/href="([^"]+)"/)[1],m[2].replace(/&amp;/g,'&')]),expected,file);
    const current = links.filter(m=>m[1].includes('aria-current="page"'));
    const target = file === 'pureform-product-detail.html' ? 'products.html' : file;
    assert.equal(current.length,expected.some(([href])=>href===target)?1:0,file);
    if(current.length)assert.ok(current[0][1].includes('href="'+target+'"'),file);
    assert.doesNotMatch(nav,/The set|href="faq.html"/);
  }
});

test('FAQ and policies have one canonical page and every existing topic remains present', () => {
  const html=read('policy.html');
  assert.match(html,/<h1>Policies &amp; FAQ<\/h1>/);
  assert.equal((html.match(/class="retail-question"/g)||[]).length,12);
  for(const id of ['faq','faq-product','faq-orders','faq-delivery','delivery','shipping','returns','return-process','refund','privacy','terms','support']){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  for(const file of files)assert.doesNotMatch(read(file),/href="faq.html(?:["#])/);
});

test('old FAQ URLs redirect locally, preserve topic fragments and drop unrelated queries', () => {
  const html=read('faq.html');
  assert.match(html,/http-equiv="refresh" content="0; url=policy.html#faq"/);
  assert.match(html,/rel="canonical" href="policy.html"/);
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for(const hash of ['', '#faq-orders', '#faq-delivery', '#//external.example']){
    let destination;
    const location={href:'https://pureform.example/faq.html?unused=1'+hash,hash,replace(value){destination=value;}};
    new vm.Script(script).runInNewContext({URL,window:{location}});
    const result=new URL(destination);
    assert.equal(result.origin,'https://pureform.example');
    assert.equal(result.pathname,'/policy.html');
    assert.equal(result.search,'');
    assert.equal(result.hash,hash||'#faq');
  }
});

test('mobile links inherit desktop destinations, order and current-page semantics', () => {
  const script=read('assets/pureform-mobile-menu.js');
  assert.match(script,/nav\.querySelectorAll\('\.nav-links a'\)/);
  assert.match(script,/item\.href = link\.getAttribute\('href'\)/);
  assert.match(script,/item\.textContent = link\.textContent\.trim\(\)/);
  assert.match(script,/item\.setAttribute\('aria-current', link\.getAttribute\('aria-current'\)\)/);
});
