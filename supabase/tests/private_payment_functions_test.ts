import assert from 'node:assert/strict';
import {PGlite} from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('payment functions stay private even with Supabase-style direct default grants',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
    const read=(file:string)=>Deno.readTextFile(new URL('../'+file,import.meta.url));
    await db.exec((await read('admin-schema.sql')).replace('create extension if not exists pgcrypto;',''));
    await db.exec(await read('migrations/20261018000100_checkout_limits_refunds.sql'));
    const functions=['apply_paid_site_order(uuid,text,text,numeric,text)','reserve_site_order(uuid)',
      'release_site_order(uuid,text)','check_site_checkout_limit(text,text)',
      'refresh_site_order_refunds(uuid)','record_site_refund(text,text,bigint,text,text,boolean,bigint)'];
    const access=async(role:string,fn:string)=>(await db.query<{allowed:boolean}>('select has_function_privilege($1,$2,\'execute\') allowed',[role,'public.'+fn])).rows[0].allowed;
    assert.equal(await access('anon',functions[0]),true,'Fixture reproduces the deployed default-grant gap');
    const fix=await read('migrations/20261105000200_private_payment_functions.sql');await db.exec(fix);await db.exec(fix);
    for(const fn of functions){assert.equal(await access('anon',fn),false);assert.equal(await access('authenticated',fn),false);assert.equal(await access('service_role',fn),true);}
  }finally{await db.close();}
});
