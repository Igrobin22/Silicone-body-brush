import assert from 'node:assert/strict';
import {PGlite} from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('durable owner-requested shipping queue excludes unsafe orders',async test=>{
  const db=new PGlite(); const owner=123456789; let update=50000;
  const file=(name:string)=>Deno.readTextFile(new URL('../'+name,import.meta.url));
  const command=(kind='process_all',sender=owner,id=++update)=>db.query('select process_site_shipping_update($1,$2,$2,$3,$4)',[id,sender,owner,JSON.stringify({kind})]);
  const claim=async()=> (await db.query<{job:Record<string,any>|null}>('select claim_site_shipping_job() job')).rows[0].job;
  const order=async(overrides:Record<string,unknown>={})=>{
    const values={payment_status:'paid',paid_at:new Date().toISOString(),payment_session_id:'cs_live_'+crypto.randomUUID().replaceAll('-',''),source:'website',
      first_name:'Shipping',last_name:'Fixture',contact:'fixture@example.test',phone:'+971500000000',address:'Test building',
      city:'Dubai',emirate:'Dubai',line_items:JSON.stringify([{id:'pureform-4pc-set-grey',name:'Grey set',price:43.89,quantity:1}]),...overrides};
    const keys=Object.keys(values);return(await db.query<{id:string}>(`insert into site_orders(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning id`,Object.values(values))).rows[0].id;
  };
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    await db.exec((await file('admin-schema.sql')).replace('create extension if not exists pgcrypto;',''));
    await db.exec(await file('migrations/20261018000100_checkout_limits_refunds.sql'));
    await db.exec(await file('migrations/20261018000200_telegram.sql'));
    const migration=await file('migrations/20261105000100_shipping_queue.sql');await db.exec(migration);await db.exec(migration);
    await test.step('queues only new paid live orders and never backfills or duplicates',async()=>{
      for(const values of [
        {source:'stripe_sandbox',payment_session_id:'cs_test_no_ship'}, {payment_status:'requires_payment',paid_at:null},
        {payment_status:'failed'}, {status:'cancelled'}, {fulfillment_status:'shipped'},
        {refunded_total:1}, {refund_pending_total:1}, {refund_attention_required:true},
        {payment_session_id:'csXliveXfake'},{currency:'USD'},
      ])await order(values);
      assert.equal((await db.query('select * from site_shipping_jobs')).rows.length,0);
      const id=await order();await db.query('update site_orders set paid_at=paid_at where id=$1',[id]);
      assert.equal((await db.query('select * from site_shipping_jobs')).rows.length,1);
      assert.equal(await claim(),null,'Laptop cannot consume jobs before owner request');
    });
    await test.step('non-owners cannot start batches or inspect order counts',async()=>{
      await command('process_all',99999999);await command('shipping',99999999);
      assert.equal((await db.query('select * from site_shipping_runs')).rows.length,0);
      assert((await db.query<{message:string}>("select message from site_telegram_outbox where dedupe_key like 'update:%'")).rows.every(r=>r.message.includes('owner-only')));
    });
    await test.step('deduplicates owner requests and bounds a batch to its existing orders',async()=>{
      const id=++update;await command('process_all',owner,id);await command('process_all',owner,id);await command();
      assert.equal((await db.query('select * from site_shipping_runs')).rows.length,1);
      const later=await order();
      const job=await claim();assert(job);assert.notEqual(job.order.id,later);assert.equal(job.order.currency,'AED');
      assert(!('payment_session_id' in job.order));assert(!('admin_notes' in job.order));
      assert.equal(await claim(),null,'No duplicate claim and future orders stay pending');
      const finish=await db.query<{ok:boolean}>('select finish_site_shipping_job($1,$2,$3,$4) ok',[job.id,job.lease,'needs_review','prepared_for_review']);
      assert.equal(finish.rows[0].ok,true);
      assert.equal((await db.query<{ok:boolean}>('select finish_site_shipping_job($1,$2,$3,$4) ok',[job.id,job.lease,'failed','form_changed'])).rows[0].ok,false);
      await command();const second=await claim();assert(second);assert.equal(second.order.id,later);
      await db.query("update site_shipping_jobs set locked_until=now()-interval '1 minute' where id=$1",[second.id]);
      assert.equal(await claim(),null);
      const interrupted=(await db.query<{status:string;last_error:string}>('select status,last_error from site_shipping_jobs where id=$1',[second.id])).rows[0];
      assert.equal(interrupted.status,'needs_review');assert.equal(interrupted.last_error,'worker_interrupted');
    });
    await test.step('payment cancellation invalidates a worker lease and never changes stock or payment',async()=>{
      const id=await order();await command();const job=await claim();assert(job);
      await db.query('update site_orders set refund_pending_total=10 where id=$1',[id]);
      assert.equal((await db.query<{status:string}>('select status from site_shipping_jobs where order_id=$1',[id])).rows[0].status,'cancelled');
      assert.equal((await db.query<{ok:boolean}>('select finish_site_shipping_job($1,$2,$3,$4) ok',[job.id,job.lease,'needs_review','prepared_for_review'])).rows[0].ok,false);
      const saved=(await db.query<{payment_status:string;fulfillment_status:string}>('select payment_status,fulfillment_status from site_orders where id=$1',[id])).rows[0];
      assert.equal(saved.payment_status,'paid');assert.equal(saved.fulfillment_status,'unfulfilled');
    });
    await test.step('public users have no queue access and admins cannot forge worker outcomes',async()=>{
      await db.exec('set role anon');await assert.rejects(db.query('select * from site_shipping_jobs'));
      await assert.rejects(db.query('select * from site_shipping_worker_auth'));
      await assert.rejects(db.query('select get_site_shipping_worker_digest()'));
      await assert.rejects(db.query('select claim_site_shipping_job()'));await db.exec('reset role');
      await db.exec('set role authenticated');
      await assert.rejects(db.query('select get_site_shipping_worker_digest()'));
      assert.equal((await db.query('select * from site_shipping_jobs')).rows.length,0);
      await assert.rejects(db.query('select claim_site_shipping_job()'));
      await assert.rejects(db.query("update site_shipping_jobs set status='created'"));await db.exec('reset role');
      await assert.rejects(db.query("update site_shipping_jobs set status='created',shipment_id=null,tracking_number=null"));
    });
    await test.step('only an actual admin records existing C3X tracking, with stale-write protection',async()=>{
      const id=await order();
      const current=async()=>(await db.query<{id:string;updated_at:Date;status:string;shipment_id:string|null}>('select * from site_shipping_jobs where order_id=$1',[id])).rows[0];
      const job=await current();
      await assert.rejects(db.query("select record_site_shipment($1,$2,'SM1000123456','C3X123456','C3X')",[job.id,job.updated_at]));
      const admin='11111111-1111-4111-8111-111111111111';
      await db.query('insert into auth.users values($1)',[admin]);
      await db.query("insert into admin_profiles(id,email,role) values($1,'owner@example.test','admin')",[admin]);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
      await db.exec('set role authenticated');
      assert((await db.query('select * from site_shipping_jobs')).rows.length>0);
      await assert.rejects(db.query("select record_site_shipment($1,$2,'SM1000123456','C3X123456','Other courier')",[job.id,job.updated_at]));
      await db.query("select record_site_shipment($1,$2,'SM1000123456','C3X123456','C3X')",[job.id,job.updated_at]);
      assert.equal((await current()).status,'created');
      await assert.rejects(db.query('select retry_site_shipping_job($1,$2)',[job.id,job.updated_at]));
      await assert.rejects(db.query("select record_site_shipment($1,$2,'SM1000654321','C3X654321','C3X')",[job.id,job.updated_at]));
      await db.exec('reset role');
      const saved=(await db.query<{fulfillment_status:string;payment_status:string}>('select fulfillment_status,payment_status from site_orders where id=$1',[id])).rows[0];
      assert.equal(saved.fulfillment_status,'unfulfilled');assert.equal(saved.payment_status,'paid');
      // Ordinary collection updates must not raise a refund/cancellation warning.
      await db.query("update site_orders set fulfillment_status='shipped',status='shipped' where id=$1",[id]);
      assert.equal((await db.query("select * from site_telegram_outbox where order_id=$1 and dedupe_key like 'shipping-review:%'",[id])).rows.length,0);
      await db.query('update site_orders set refunded_total=1 where id=$1',[id]);
      assert.equal((await db.query("select * from site_telegram_outbox where order_id=$1 and dedupe_key like 'shipping-review:%'",[id])).rows.length,1);
      const retryOrder=await order();
      await db.query("update site_shipping_jobs set status='needs_review',last_error='missing_customer_email' where order_id=$1",[retryOrder]);
      const retryJob=(await db.query<{id:string;updated_at:Date}>('select id,updated_at from site_shipping_jobs where order_id=$1',[retryOrder])).rows[0];
      await db.exec('set role authenticated');
      await db.query('select retry_site_shipping_job($1,$2)',[retryJob.id,retryJob.updated_at]);
      assert.equal((await db.query<{status:string}>('select status from site_shipping_jobs where id=$1',[retryJob.id])).rows[0].status,'pending');
      await db.exec('reset role');
    });
  }finally{await db.close();}
});
