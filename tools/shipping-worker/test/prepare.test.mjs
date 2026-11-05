import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePayload,createQueueClient} from '../prepare.mjs';
import {verifiedProfile} from './fixtures.mjs';
const profile=verifiedProfile();
const order={source:'website',payment_status:'paid',currency:'AED',order_number:'PF-261105-TEST',
  first_name:'Test',last_name:'Fixture',country:'United Arab Emirates',address:'Fixture building',apartment:'4',city:'Dubai',
  contact:'fixture@example.test',phone:'+971500000000',customer_notes:'Call on arrival',
  line_items:[{id:'pureform-4pc-set-grey',name:'Grey four-piece set',price:43.89,quantity:1}]};
test('maps only canonical paid UAE orders with immutable item prices and no COD',()=>{
  const result=preparePayload(order,profile);
  assert.equal(result.cod,false);assert.equal(result.currency,'AED');assert.equal(result.preferredCourier,'C3X');
  assert.deepEqual(result.items,[{description:'Grey four-piece set',quantity:1,unitPrice:43.89}]);
  assert.equal(result.parcel.weightKg,.8);assert.equal(result.pickup.city,'Dubai');
  assert.equal(result.origin.email,'owner@example.test');
  assert.equal(preparePayload({...order,city:'Business Bay',emirate:'Dubai'},profile).receiver.city,'Dubai');
});
test('fails closed for sandbox/unpaid/foreign orders and missing required customer details',()=>{
  for(const change of [{source:'stripe_sandbox'},{payment_status:'requires_payment'},{currency:'USD'},{country:'India'},{phone:'123'},{contact:'0500000000'},{line_items:[{id:'unknown',price:1,quantity:1}]}])
    assert.throws(()=>preparePayload({...order,...change},profile));
});
test('does not invent combo parcel dimensions or accept stale/unverified packing profiles',()=>{
  assert.throws(()=>preparePayload({...order,line_items:[{...order.line_items[0],quantity:2}]},profile),{code:'missing_package_profile'});
  assert.throws(()=>preparePayload(order,{...profile,packages:{1:{...profile.packages[1],verified:false}}}),{code:'missing_package_profile'});
  assert.throws(()=>preparePayload(order,{...profile,pickup:{...profile.pickup,verified:false}}),{code:'missing_verified_profile'});
  assert.throws(()=>preparePayload(order,{...profile,origin:{...profile.origin,mapPinVerified:false}}),{code:'missing_verified_profile'});
  assert.throws(()=>preparePayload(order,{...profile,origin:{...profile.origin,email:'<redacted>'}}),{code:'missing_verified_profile'});
});
test('worker credentials never follow redirects or travel to a configurable third-party host',async()=>{
  const secret='fixture_shipping_secret_123456789012345';
  for(const endpoint of ['https://evil.example/functions/v1/shipping-worker','http://hibfipskhksboubibwbz.supabase.co/functions/v1/shipping-worker'])assert.throws(()=>createQueueClient(endpoint,secret));
  let requests=0;
  const request=createQueueClient(profile.endpoint,secret,async(url,options)=>{
    requests++;assert.equal(options.redirect,'error');assert.equal(options.headers['x-shipping-worker-secret'],secret);
    return new Response('{"job":null}',{headers:{'Content-Type':'application/json'}});
  });
  assert.deepEqual(await request({action:'claim'}),{job:null});assert.equal(requests,1);
});
