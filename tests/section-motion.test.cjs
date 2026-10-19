const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source=readFileSync(path.join(__dirname,'../assets/pureform-store-flow.js'),'utf8');
const css=readFileSync(path.join(__dirname,'../assets/pureform-store-flow.css'),'utf8');
const setup=source.slice(source.indexOf('  function setupReveal()'),source.indexOf('  function setupStickyOrder()'));

function element(parent={}){
  const classes=new Set(),attributes=new Map(),styles=new Map();
  return {parentElement:parent,isConnected:true,classes,attributes,styles,
    setAttribute(k,v){attributes.set(k,v);},
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains(n){return classes.has(n);}},
    style:{setProperty(k,v){styles.set(k,v);}}
  };
}

function fixture({reduced=false,observer=true,brokenObserver=false}={}){
  const selectors=new Map(),events={},mediaEvents={},frames=[],observed=new Set();
  let notify;
  const preference={matches:reduced,addEventListener(type,fn){mediaEvents[type]=fn;}};
  const window={requestAnimationFrame(fn){frames.push(fn);return frames.length;},addEventListener(type,fn){events[type]=fn;}};
  if(observer)window.IntersectionObserver=true;
  class IO{
    constructor(fn){if(brokenObserver)throw Error('Observer unavailable');notify=fn;}
    observe(el){observed.add(el);} unobserve(el){observed.delete(el);}
  }
  const document={documentElement:{},querySelectorAll(selector){return [...selectors].filter(([key])=>selector.split(', ').includes(key)).flatMap(([,items])=>items);},addEventListener(type,fn){events[type]=fn;}};
  const context=vm.createContext({window,document,motionPreference:preference,refreshReveal(){},Set,WeakSet,IntersectionObserver:IO});
  return {selectors,preference,events,mediaEvents,frames,observed,
    start(){new vm.Script(setup+'setupReveal();').runInContext(context);},
    refresh(){context.refreshReveal();},flush(){while(frames.length)frames.shift()();},
    enter(...items){notify(items.map(target=>({target,isIntersecting:true})));}
  };
}

test('sections receive distinct entrance styles and capped local stagger delays',()=>{
  const f=fixture(),parent={};
  const headline=element(),heading=element(),cards=Array.from({length:6},()=>element(parent)),tool=element(),review=element();
  f.selectors.set('#heroTitle',[headline]);f.selectors.set('.retail-heading',[heading]);
  f.selectors.set('.pgrid > .pcard',cards);f.selectors.set('.home-tools > div',[tool]);f.selectors.set('.home-review',[review]);
  f.start();
  assert.equal(headline.attributes.get('data-flow-reveal'),'fade');
  assert.equal(heading.attributes.get('data-flow-reveal'),'drop');
  assert.equal(cards[0].attributes.get('data-flow-reveal'),'rise');
  assert.equal(tool.attributes.get('data-flow-reveal'),'zoom');
  assert.equal(review.attributes.get('data-flow-reveal'),'left');
  assert.deepEqual(cards.map(c=>c.styles.get('--pf-flow-delay')),['0ms','55ms','110ms','165ms','0ms','55ms']);
});

test('policy sections alternate slide directions',()=>{
  const f=fixture(),items=[element(),element(),element()];
  f.selectors.set('.policy-card',items);f.start();
  assert.deepEqual(items.map(e=>e.attributes.get('data-flow-reveal')),['left','right','left']);
});

test('intersection reveals once and stops observing the completed target',()=>{
  const f=fixture(),item=element();f.selectors.set('.home-review',[item]);f.start();
  assert.ok(f.observed.has(item));assert.ok(!item.classes.has('is-visible'));
  f.enter(item);assert.ok(item.classes.has('is-visible'));assert.ok(!f.observed.has(item));
  f.refresh();f.flush();assert.ok(!f.observed.has(item));
});

test('canonical cards marked visible by their renderer still get their first entrance',()=>{
  const f=fixture(),item=element();item.classes.add('is-visible');
  f.selectors.set('.collection-grid > .collection-card',[item]);f.start();
  assert.ok(!item.classes.has('is-visible'));f.enter(item);assert.ok(item.classes.has('is-visible'));
});

test('catalog updates and filters do not replay an already-seen product row',()=>{
  const f=fixture(),parent={},old=element(parent);f.selectors.set('.collection-grid > .collection-card',[old]);f.start();f.enter(old);
  old.isConnected=false;const replacement=element(parent);f.selectors.set('.collection-grid > .collection-card',[replacement]);
  f.refresh();f.flush();assert.ok(replacement.classes.has('is-visible'));assert.ok(replacement.classes.has('pf-motion-instant'));assert.ok(!f.observed.has(replacement));
});

test('offscreen catalog replacements keep their first reveal pending and refreshes are batched',()=>{
  const f=fixture(),parent={},old=element(parent);f.selectors.set('.pgrid > .pcard',[old]);f.start();
  old.isConnected=false;const item=element(parent);f.selectors.set('.pgrid > .pcard',[item]);
  f.refresh();f.refresh();assert.equal(f.frames.length,1);f.flush();
  assert.ok(f.observed.has(item));assert.ok(!f.observed.has(old));assert.ok(!item.classes.has('is-visible'));
});

test('missing or unavailable observers fail open',()=>{
  for(const options of [{observer:false},{brokenObserver:true}]){
    const f=fixture(options),item=element();f.selectors.set('.home-review',[item]);f.start();
    assert.ok(item.classes.has('is-visible'));assert.ok(item.classes.has('pf-motion-instant'));
  }
});

test('reduced motion starts with visible content and handles preference changes without replay',()=>{
  for(const reduced of [false,true]){
    const f=fixture({reduced}),item=element();f.selectors.set('.home-review',[item]);f.start();
    if(!reduced){assert.ok(!item.classes.has('is-visible'));f.preference.matches=true;f.mediaEvents.change();}
    assert.ok(item.classes.has('is-visible'));assert.ok(item.classes.has('pf-motion-instant'));
    f.preference.matches=false;f.mediaEvents.change();assert.ok(item.classes.has('is-visible'));
  }
});

test('keyboard focus reveals and stops every animated ancestor immediately',()=>{
  const f=fixture(),parent=element(),item=element(parent),button=element(item);
  f.selectors.set('.home-faq > div:first-child',[parent]);f.selectors.set('.home-review',[item]);f.start();
  f.events.focusin({target:button});
  for(const el of [item,parent]){assert.ok(el.classes.has('is-visible'));assert.ok(el.classes.has('pf-motion-instant'));}
});

test('back/forward-cache restoration shows pending content without a second animation',()=>{
  const f=fixture(),item=element();f.selectors.set('.home-review',[item]);f.start();
  f.events.pageshow({persisted:false});assert.ok(!item.classes.has('is-visible'));
  f.events.pageshow({persisted:true});assert.ok(item.classes.has('pf-motion-instant'));assert.ok(item.classes.has('is-visible'));
});

test('hero artwork and critical shopping controls are never motion targets',()=>{
  for(const selector of ['.home-hero-media','.home-hero-actions','.pdp-buy','.cart-item','.cart-summary','.checkout-field','.checkout-actions','.form-grid','.site-header']){
    assert.ok(!setup.includes("['"+selector+"'"),selector);
  }
  assert.ok(!source.includes("'main .form-grid'"));
  assert.doesNotMatch(readFileSync(path.join(__dirname,'../cart.html'),'utf8'),/animatedItems|data-animate/);
});

test('six lightweight keyframes settle naturally and reduced motion removes them',()=>{
  for(const variant of ['fade','rise','drop','left','right','zoom'])assert.ok(css.includes('@keyframes pf-flow-'+variant));
  assert.match(css,/520ms[\s\S]*?backwards/);
  assert.match(css,/translate: 0 0;[\s\S]*?scale: 1;/);
  assert.match(css,/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none;/);
  assert.doesNotMatch(css,/will-change:|\bfilter:\s*blur|\binfinite\b/);
});
