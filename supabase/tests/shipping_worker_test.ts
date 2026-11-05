import assert from 'node:assert/strict';
import {handler} from '../functions/shipping-worker/handler.ts';

Deno.test('shipping endpoint authenticates a limited laptop worker',async test=>{
  const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const prior=Object.fromEntries(names.map(n=>[n,Deno.env.get(n)]));const fetchBefore=globalThis.fetch;
  const secret='shipping_fixture_secret_123456789012345';
  Deno.env.set('SUPABASE_URL','https://fixture.supabase.co');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','service_fixture');
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret))),b=>b.toString(16).padStart(2,'0')).join('');
  const calls:{path:string;body:unknown}[]=[];let databaseError=false,configured=true,result:unknown=null;
  globalThis.fetch=async(input,options)=>{const path=new URL(String(input)).pathname;calls.push({path,body:JSON.parse(String((options as RequestInit|undefined)?.body||'{}'))});const value=path.endsWith('/get_site_shipping_worker_digest')?(configured?digest:null):result;return new Response(JSON.stringify(databaseError?{message:'private details'}:value),{status:databaseError?500:200,headers:{'Content-Type':'application/json'}});};
  const request=(body:unknown,key=secret,extra:Record<string,string>={})=>new Request('https://fixture.supabase.co/functions/v1/shipping-worker',{
    method:'POST',headers:{'Content-Type':'application/json','x-shipping-worker-secret':key,...extra},body:JSON.stringify(body)});
  try{
    await test.step('rejects browsers, missing or invalid keys, unconfigured auth and invalid actions without claiming jobs',async()=>{
      assert.equal((await handler(request({action:'claim'},''))).status,401);
      assert.equal((await handler(request({action:'claim'},secret,{Origin:'https://siliconebodybrush2.pages.dev'}))).status,401);
      assert.equal(calls.length,0);
      assert.equal((await handler(request({action:'claim'},'wrong_but_well_formed_secret_1234567890'))).status,401);
      configured=false;assert.equal((await handler(request({action:'claim'}))).status,503);configured=true;
      for(const body of [{action:'created'}, {action:'claim',order_id:'arbitrary'}, {action:'finish',status:'created'}, {action:'claim',padding:'x'.repeat(3000)}])
        assert.equal((await handler(request(body))).status,400);
      assert(calls.every(call=>call.path.endsWith('/get_site_shipping_worker_digest')));
    });
    await test.step('claims minimal jobs and saves only lease-bound bounded outcomes',async()=>{
      calls.length=0;assert.deepEqual(await(await handler(request({action:'ping'}))).json(),{authenticated:true,mode:'preparation_only'});
      assert(calls.every(call=>call.path.endsWith('/get_site_shipping_worker_digest')));
      result=null;assert.deepEqual(await(await handler(request({action:'claim'}))).json(),{job:null});
      assert(calls.some(call=>call.path==='/rest/v1/rpc/claim_site_shipping_job'));
      result=true;const body={action:'finish',id:'11111111-1111-4111-8111-111111111111',lease:'22222222-2222-4222-8222-222222222222',status:'needs_review',error:'prepared_for_review'};
      assert.equal((await handler(request(body))).status,200);
      assert.deepEqual(calls.at(-1)?.body,{p_id:body.id,p_lease:body.lease,p_status:body.status,p_error:body.error});
      result=false;assert.equal((await handler(request(body))).status,409);
      databaseError=true;const response=await handler(request({action:'claim'}));assert.equal(response.status,503);assert(!(await response.text()).includes('private details'));
    });
  }finally{globalThis.fetch=fetchBefore;for(const name of names){if(prior[name]===undefined)Deno.env.delete(name);else Deno.env.set(name,prior[name]!);}}
});
