import assert from 'node:assert/strict';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('checkout limits and refund ledger', async (test) => {
  const db = new PGlite();
  const schema = (await Deno.readTextFile(new URL('../admin-schema.sql', import.meta.url))).replace('create extension if not exists pgcrypto;', '');
  const migration = await Deno.readTextFile(new URL('../migrations/20261018000100_checkout_limits_refunds.sql', import.meta.url));
  const slug = 'pureform-4pc-set-grey';
  const refund = (id: string, intent: string, amount = 2500, status = 'succeeded', time = 100, live = false) => db.query(
    'select record_site_refund($1,$2,$3,\'aed\',$4,$5,$6)', [id, intent, amount, status, live, time]);
  const get = async (id: string) => (await db.query<Record<string, unknown>>('select * from site_orders where id=$1', [id])).rows[0];
  async function newOrder(intent: string, paid = true) {
    const id = (await db.query<{id: string}>(`insert into site_orders(source,payment_status,line_items,subtotal,total)
      values('stripe_sandbox','requires_payment',$1,100,100) returning id`, [JSON.stringify([{ id: slug, quantity: 1 }])])).rows[0].id;
    if (paid) await db.query('select apply_paid_site_order($1,$2,$3,100,$2)', [id, 'cs_' + intent, intent]);
    return id;
  }
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    await db.exec(schema);
    await db.exec(migration);
    await db.exec(migration);
    await db.query('update site_listings set inventory_quantity=100 where slug=$1', [slug]);
    await test.step('durable buckets reject a fifth attempt and expire after ten minutes', async () => {
      const args = ['a'.repeat(64), 'b'.repeat(64)];
      for (let n = 0; n < 4; n++) assert.equal((await db.query<{wait: number}>('select check_site_checkout_limit($1,$2) as wait', args)).rows[0].wait, 0);
      assert((await db.query<{wait: number}>('select check_site_checkout_limit($1,$2) as wait', args)).rows[0].wait > 0);
      await db.exec("update site_checkout_limits set window_started_at=now()-interval '11 minutes'");
      assert.equal((await db.query<{wait: number}>('select check_site_checkout_limit($1,$2) as wait', args)).rows[0].wait, 0);
      await assert.rejects(db.query("select check_site_checkout_limit('raw-phone','raw-email')"), /Invalid checkout fingerprint/);
    });
    await test.step('partial refunds, duplicate deliveries and old events never double-count or restore stock', async () => {
      const id = await newOrder('pi_partial');
      const before = (await db.query('select inventory_quantity from site_listings where slug=$1', [slug])).rows[0];
      await refund('re_partial','pi_partial');
      await refund('re_partial','pi_partial');
      await refund('re_partial','pi_partial',2500,'pending',99);
      const order = await get(id);
      assert.equal(Number(order.refunded_total),25);
      assert.equal(order.payment_status,'paid');
      assert.deepEqual((await db.query('select inventory_quantity from site_listings where slug=$1', [slug])).rows[0],before);
      await assert.rejects(refund('re_partial','pi_partial',3000), /Refund identity mismatch/);
    });
    await test.step('pending and failed refunds do not pretend money was returned', async () => {
      const id = await newOrder('pi_pending');
      await refund('re_pending','pi_pending',4000,'pending');
      assert.equal(Number((await get(id)).refund_pending_total),40);
      assert.equal(Number((await get(id)).refunded_total),0);
      await refund('re_pending','pi_pending',4000,'failed',101);
      const order = await get(id);
      assert.equal(Number(order.refund_pending_total),0);
      assert.equal(order.refund_attention_required,true);
      assert.equal(order.payment_status,'paid');
    });
    await test.step('full refunds preserve original total and cannot be undone by a paid webhook retry', async () => {
      const id = await newOrder('pi_full');
      await refund('re_full','pi_full',10000);
      await db.query('select apply_paid_site_order($1,\'cs_pi_full\',\'pi_full\',100,\'cs_pi_full\')', [id]);
      const order = await get(id);
      assert.equal(order.payment_status,'refunded');
      assert.equal(Number(order.total),100);
      assert.equal(Number(order.refunded_total),100);
      assert.equal(order.stock_deducted,true);
    });
    await test.step('refund arriving before payment is queued and reconciled when payment settles', async () => {
      await refund('re_early','pi_early',10000);
      const id = await newOrder('pi_early');
      assert.equal((await get(id)).payment_status,'refunded');
      assert.equal(Number((await get(id)).refunded_total),100);
    });
    await test.step('over-refunds and test/live mismatches roll back the refund write', async () => {
      const id = await newOrder('pi_bounds');
      await assert.rejects(refund('re_too_much','pi_bounds',10001), /exceeds/);
      await assert.rejects(refund('re_wrong_mode','pi_bounds',2500,'succeeded',100,true), /environment mismatch/);
      assert.equal(Number((await get(id)).refunded_total),0);
      assert.equal((await db.query("select * from site_payment_refunds where refund_id in ('re_too_much','re_wrong_mode')")).rows.length,0);
    });
    await test.step('migration reruns preserve settled refunds and admin cannot forge them', async () => {
      await db.exec(migration);
      assert.equal((await db.query<{status:string}>("select status from site_payment_refunds where refund_id='re_full'")).rows[0].status,'succeeded');
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from site_payment_refunds'), /permission denied/);
      await assert.rejects(db.query("select check_site_checkout_limit('a','b')"), /permission denied/);
      await db.exec('reset role; set role authenticated');
      await assert.rejects(db.query('update site_orders set refunded_total=0'), /permission denied/);
      await assert.rejects(refund('re_forged','pi_full'), /permission denied/);
      await db.exec('reset role');
    });
  } catch (error) {
    const details = error as { message?: string; position?: string; internalPosition?: string; internalQuery?: string; where?: string };
    console.error({ message: details.message, position: details.position, internalPosition: details.internalPosition, internalQuery: details.internalQuery, where: details.where });
    throw error;
  } finally { await db.close(); }
});
