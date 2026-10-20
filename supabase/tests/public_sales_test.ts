import assert from 'node:assert/strict';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('public sales are aggregate-only, genuine live payments', async (test) => {
  const db = new PGlite();
  const schema = (await Deno.readTextFile(new URL('../admin-schema.sql', import.meta.url))).replace('create extension if not exists pgcrypto;', '');
  const migration = await Deno.readTextFile(new URL('../migrations/20261020000100_public_sales_totals.sql', import.meta.url));
  const grey = 'pureform-4pc-set-grey';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
    await db.exec(schema);
    await db.exec(await Deno.readTextFile(new URL('../migrations/20261018000100_checkout_limits_refunds.sql', import.meta.url)));
    await db.exec(migration); await db.exec(migration);
    const insert = async (overrides: Record<string, unknown> = {}) => {
      const values = { source: 'website', payment_provider: 'stripe', payment_status: 'paid', payment_session_id: 'cs_live_' + crypto.randomUUID(),
        paid_at: new Date().toISOString(), status: 'confirmed', fulfillment_status: 'reserved', refunded_total: 0,
        line_items: JSON.stringify([{ id: grey, quantity: 2 }]), ...overrides };
      await db.query(`insert into site_orders (${Object.keys(values).join(',')}) values (${Object.keys(values).map((_,i)=>'$'+(i+1)).join(',')})`, Object.values(values));
    };
    await test.step('only paid live orders count, not test, unpaid, cancelled or refunded orders', async () => {
      await insert();
      await insert({ source: 'stripe_sandbox', payment_session_id: 'cs_test_fixture' });
      await insert({ payment_status: 'requires_payment', paid_at: null });
      await insert({ status: 'cancelled' });
      await insert({ fulfillment_status: 'cancelled' });
      await insert({ payment_status: 'refunded', refunded_total: 10, total: 10 });
      await insert({ refunded_total: 1, total: 10 });
      await insert({ payment_session_id: '' });
      const row = (await db.query<{ total_sold: string; sold_this_week: string }>('select * from get_public_sales_totals() where slug=$1',[grey])).rows[0];
      assert.equal(Number(row.total_sold),2); assert.equal(Number(row.sold_this_week),2);
    });
    await test.step('week totals use the UAE calendar while all-time totals retain older sales', async () => {
      await insert({ paid_at: new Date(Date.now()-14*86400000).toISOString() });
      const row = (await db.query<{ total_sold: string; sold_this_week: string }>('select * from get_public_sales_totals() where slug=$1',[grey])).rows[0];
      assert.equal(Number(row.total_sold),4); assert.equal(Number(row.sold_this_week),2);
      assert.match(migration,/date_trunc\('week', now\(\) at time zone 'Asia\/Dubai'\)/);
    });
    await test.step('anonymous visitors get only three visible product totals, never order records', async () => {
      await db.exec('set role anon');
      const rows = (await db.query<Record<string, unknown>>('select * from get_public_sales_totals()')).rows;
      assert.equal(rows.length,3);
      assert.deepEqual(Object.keys(rows[0]).sort(),['slug','sold_this_week','total_sold']);
      await assert.rejects(db.query('select * from site_orders'),/permission denied/);
      await assert.rejects(db.query("update site_listings set inventory_quantity=0"),/permission denied/);
      await db.exec('reset role');
      await db.query('update site_listings set visible=false where slug=$1',[grey]);
      assert.equal((await db.query('select * from get_public_sales_totals()')).rows.length,2);
    });
  } finally { await db.close(); }
});
