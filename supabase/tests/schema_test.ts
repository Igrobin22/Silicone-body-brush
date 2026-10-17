import assert from 'node:assert/strict';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('order schema, inventory transactions and access control', async (test) => {
  const db = new PGlite();
  // PGlite has built-in gen_random_uuid but does not bundle the pgcrypto extension.
  const sql = (await Deno.readTextFile(new URL('../admin-schema.sql', import.meta.url)))
    .replace('create extension if not exists pgcrypto;', '');
  const shippingMigration = await Deno.readTextFile(new URL('../migrations/20261017000100_uae_shipping.sql', import.meta.url));
  const grey = 'pureform-4pc-set-grey';
  const pink = 'pureform-4pc-set-pink';
  async function stock(slug = grey) {
    return Number((await db.query<{ inventory_quantity: number }>('select inventory_quantity from site_listings where slug = $1', [slug])).rows[0].inventory_quantity);
  }
  async function order(items = [{ id: grey, quantity: 2 }]) {
    return (await db.query<{ id: string }>(`insert into site_orders (payment_status, line_items, subtotal, total)
      values ('requires_payment', $1, 100, 100) returning id`, [JSON.stringify(items)])).rows[0].id;
  }
  const reserve = (id: string) => db.query('select reserve_site_order($1)', [id]);
  const release = (id: string) => db.query("select release_site_order($1, 'cancelled')", [id]);
  const pay = (id: string, session = 'cs_test_schema', amount = 75) => db.query("select apply_paid_site_order($1, $2, 'pi_fixture', $3, $2)", [id, session, amount]);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
    await db.exec(sql);
    await test.step('schema can be rerun without overwriting admin product or content data', async () => {
      await db.query('update site_listings set price = 123 where slug = $1', [pink]);
      await db.exec("update site_content_blocks set value = 'Custom owner copy' where key = 'home.hero.title'");
      const historicalOrder = (await db.query<{ id: string }>("insert into site_orders (currency, total, subtotal) values ('USD', 10, 10) returning id")).rows[0].id;
      await db.exec(sql);
      assert.equal(Number((await db.query<{ price: string }>('select price from site_listings where slug = $1', [pink])).rows[0].price), 123);
      assert.equal((await db.query<{ value: string }>("select value from site_content_blocks where key = 'home.hero.title'")).rows[0].value, 'Custom owner copy');
      assert.equal((await db.query<{ currency: string }>('select currency from site_orders where id = $1', [historicalOrder])).rows[0].currency, 'USD');
    });
    await test.step('shipping migration is repeatable and preserves historical orders', async () => {
      const id = await order([{ id: grey, quantity: 1 }]);
      // Exercise the upgrade from the deployed pre-shipping schema as well as reruns.
      await db.exec('alter table site_orders drop column shipping_total');
      await db.exec(shippingMigration);
      await db.exec(shippingMigration);
      const saved = (await db.query<{ total: string; shipping_total: string }>('select total, shipping_total from site_orders where id = $1', [id])).rows[0];
      assert.equal(Number(saved.total), 100);
      assert.equal(Number(saved.shipping_total), 0);
      assert.equal(sql.match(/create or replace function public\.apply_paid_site_order\([\s\S]*?\n\$\$;/)![0],
        shippingMigration.match(/create or replace function public\.apply_paid_site_order\([\s\S]*?\n\$\$;/)![0]);
    });
    await test.step('failed multi-product reservations roll back every stock change', async () => {
      await db.query('update site_listings set inventory_quantity = 2, inventory_status = \'in_stock\' where slug = $1', [grey]);
      await db.query('update site_listings set inventory_quantity = 1 where slug = $1', [pink]);
      const id = await order([{ id: grey, quantity: 2 }, { id: pink, quantity: 2 }]);
      await assert.rejects(reserve(id), /Not enough available stock/);
      assert.equal(await stock(), 2); assert.equal(await stock(pink), 1);
    });
    await test.step('competing orders cannot reserve the same last units', async () => {
      const first = await order(), second = await order();
      await reserve(first);
      await assert.rejects(reserve(second), /Not enough available stock/);
      assert.equal(await stock(), 0);
      await release(first); await release(first);
      assert.equal(await stock(), 2);
    });
    await test.step('payment and webhook retries deduct once, including after a refund', async () => {
      const id = await order();
      await reserve(id); await reserve(id); await pay(id); await pay(id); await release(id);
      assert.equal(await stock(), 0);
      await db.query("update site_orders set payment_status = 'refunded' where id = $1", [id]);
      await pay(id);
      assert.equal((await db.query<{ payment_status: string }>('select payment_status from site_orders where id = $1', [id])).rows[0].payment_status, 'refunded');
      assert.equal(await stock(), 0);
      await assert.rejects(pay(id, 'cs_test_wrong_session'), /does not match/);
    });
    await test.step('paid totals include delivery, while promotions cannot remove the delivery fee', async () => {
      await db.query('update site_listings set inventory_quantity = 6, inventory_status = \'in_stock\' where slug = $1', [grey]);
      for (const amount of [110, 85, 10]) {
        const id = await order([{ id: grey, quantity: 1 }]);
        await db.query('update site_orders set shipping_total = 10, total = 110 where id = $1', [id]);
        await assert.rejects(pay(id, 'cs_shipping_' + amount, 9.99), /Invalid payment total/);
        await assert.rejects(pay(id, 'cs_shipping_' + amount, 110.01), /Invalid payment total/);
        await pay(id, 'cs_shipping_' + amount, amount);
        await pay(id, 'cs_shipping_' + amount, amount);
        assert.equal(Number((await db.query<{ total: string }>('select total from site_orders where id = $1', [id])).rows[0].total), amount);
      }
      assert.equal(await stock(), 3);
    });
    await test.step('anonymous users cannot read orders or invoke payment functions', async () => {
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from site_orders'), /permission denied/);
      await assert.rejects(reserve(crypto.randomUUID()), /permission denied/);
      await db.exec('reset role');
    });
    await test.step('admin may manage fulfillment but cannot forge Stripe payment status', async () => {
      const id = (await db.query<{ id: string }>('insert into auth.users values (gen_random_uuid()) returning id')).rows[0].id;
      await db.query("insert into admin_profiles (id, email, role) values ($1, 'admin@example.test', 'admin')", [id]);
      await db.exec('grant select on admin_profiles to authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      await db.exec('set role authenticated');
      assert((await db.query('select * from site_orders')).rows.length > 0);
      await db.exec("update site_orders set admin_notes = 'Test fulfillment note'");
      await assert.rejects(db.query("update site_orders set payment_status = 'paid'"), /permission denied/);
      await assert.rejects(db.query('update site_orders set shipping_total = 0'), /permission denied/);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});
