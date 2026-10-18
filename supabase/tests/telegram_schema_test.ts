import assert from 'node:assert/strict';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('Telegram intake, confirmed changes and notification outbox', async test => {
  const db = new PGlite();
  const owner = 123456789;
  const customer = 987654321;
  let sequence = 0;
  const slug = 'pureform-4pc-set-grey';
  const call = (command: Record<string, unknown>, sender = owner, id = ++sequence) => db.query(
    'select process_site_telegram_update($1,$2,$2,$3,$4)', [id,sender,owner,JSON.stringify(command)]);
  const product = async () => (await db.query<Record<string, unknown>>('select * from site_listings where slug=$1',[slug])).rows[0];
  const pending = async (kind = 'stock') => (await db.query<{id: string}>("select id from site_telegram_changes where kind=$1 and status='pending' order by created_at desc,id desc limit 1",[kind])).rows[0].id;
  const stockCommand = { kind: 'stock', slug, value: 31 };
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    await db.exec((await Deno.readTextFile(new URL('../admin-schema.sql',import.meta.url))).replace('create extension if not exists pgcrypto;',''));
    await db.exec(await Deno.readTextFile(new URL('../migrations/20261018000100_checkout_limits_refunds.sql',import.meta.url)));
    const migration = await Deno.readTextFile(new URL('../migrations/20261018000200_telegram.sql',import.meta.url));
    await db.exec(migration);
    await db.exec(migration);
    await test.step('customers cannot inspect orders or change stock and discounts', async () => {
      const before = await product();
      for (const kind of ['stock','discount','inventory','discounts','orders','confirm','reply']) await call({ ...stockCommand,kind },customer);
      assert.deepEqual(await product(),before);
      assert.equal((await db.query('select * from site_telegram_changes')).rows.length,0);
      const messages = (await db.query<{message: string}>('select message from site_telegram_outbox')).rows;
      assert(messages.every(row => row.message.includes('owner-only')));
      assert(messages.length<=3);
    });
    await test.step('stock changes require one-use confirmation, with an audit snapshot', async () => {
      const before = await product();
      const id = ++sequence;
      await call(stockCommand,owner,id);
      assert.deepEqual(await product(),before);
      await call(stockCommand,owner,id);
      assert.equal((await db.query('select * from site_telegram_changes')).rows.length,1);
      const change = await pending();
      await call({kind:'confirm',id:change});
      assert.equal((await product()).inventory_quantity,31);
      assert.equal((await product()).inventory_status,'in_stock');
      await db.exec("update site_listings set inventory_quantity=30 where slug='pureform-4pc-set-grey'");
      await call({kind:'confirm',id:change});
      assert.equal((await product()).inventory_quantity,30);
      assert.equal((await db.query<{status: string}>('select status from site_telegram_changes where id=$1',[change])).rows[0].status,'applied');
    });
    await test.step('stale, cancelled, expired and foreign-owner confirmations cannot overwrite stock', async () => {
      await call(stockCommand);
      let id = await pending();
      await db.exec("update site_listings set inventory_quantity=29 where slug='pureform-4pc-set-grey'");
      await call({kind:'confirm',id});
      assert.equal((await product()).inventory_quantity,29);
      assert.equal((await db.query<{status: string}>('select status from site_telegram_changes where id=$1',[id])).rows[0].status,'stale');
      await call(stockCommand); id = await pending();
      await call({kind:'cancel',id}); await call({kind:'confirm',id});
      assert.equal((await product()).inventory_quantity,29);
      await call(stockCommand); id = await pending();
      await db.query("update site_telegram_changes set expires_at=now()-interval '1 minute' where id=$1",[id]);
      await call({kind:'confirm',id});
      assert.equal((await product()).inventory_quantity,29);
      await call(stockCommand); id = await pending();
      await db.query('select process_site_telegram_update($1,$2,$2,$2,$3)',[++sequence,111111111,JSON.stringify({kind:'confirm',id})]);
      assert.equal((await product()).inventory_quantity,29);
    });
    await test.step('confirmed discounts update the canonical listing, not order payment data', async () => {
      await call({kind:'discount',slug,value:15});
      await call({kind:'confirm',id:await pending('discount')});
      const row = await product();
      assert.equal(Number(row.discount),15);
      assert.equal(row.discount_mode,'ongoing');
      assert.equal(row.discount_ends_at,null);
      for (const value of [-1,101,15.123]) await assert.rejects(call({kind:'discount',slug,value}));
      await assert.rejects(call({kind:'stock',slug:'unrelated-product',value:4}));
    });
    await test.step('support routes replies only to a stored private ticket and deduplicates updates', async () => {
      const other = 222222222;
      const id = ++sequence;
      await call({kind:'support',text:'Question about the Grey set'},other,id);
      await call({kind:'support',text:'Question about the Grey set'},other,id);
      const tickets = (await db.query<{id: string}>('select id from site_telegram_support')).rows;
      assert.equal(tickets.length,1);
      await call({kind:'reply',id:tickets[0].id,text:'Yes, UAE delivery is AED 10.'});
      const reply = (await db.query<{chat_id: number,message: string}>("select chat_id,message from site_telegram_outbox where dedupe_key like '%:reply'")).rows[0];
      assert.equal(Number(reply.chat_id),other);
      assert(reply.message.includes('PureForm support:'));
      await assert.rejects(call({kind:'reply',id:crypto.randomUUID(),text:'Must not send'}));
    });
    await test.step('only settled payment and refund transitions queue minimal owner alerts', async () => {
      const id = (await db.query<{id: string}>(`insert into site_orders(source,contact,payment_status,subtotal,total,line_items)
        values('stripe_sandbox','private@example.com','requires_payment',100,100,$1) returning id`,[JSON.stringify([{id:slug,quantity:1}])])).rows[0].id;
      assert.equal((await db.query("select * from site_telegram_outbox where dedupe_key like 'paid:%'")).rows.length,0);
      await db.query("select apply_paid_site_order($1,'cs_tg_test','pi_tg_test',100,'cs_tg_test')",[id]);
      await db.query("select apply_paid_site_order($1,'cs_tg_test','pi_tg_test',100,'cs_tg_test')",[id]);
      let rows = (await db.query<{message: string}>("select message from site_telegram_outbox where dedupe_key like 'paid:%'")).rows;
      assert.equal(rows.length,1);
      assert(rows[0].message.includes('SANDBOX'));
      assert(!rows[0].message.includes('private@example.com'));
      await db.query("select record_site_refund('re_tg_test','pi_tg_test',2500,'aed','succeeded',false,100)");
      await db.query("select record_site_refund('re_tg_test','pi_tg_test',2500,'aed','succeeded',false,100)");
      rows = (await db.query<{message: string}>("select message from site_telegram_outbox where dedupe_key like 'refund:%'")).rows;
      assert.equal(rows.length,1);
      assert(rows[0].message.includes('25.00'));
    });
    await test.step('outbox leases prevent concurrent repeats and ignore stale delivery writes', async () => {
      const jobs = (await db.query<{id: string,lease: string}>('select * from claim_site_telegram_jobs(1)')).rows;
      assert.equal(jobs.length,1);
      const next = (await db.query<{id: string,lease: string}>('select * from claim_site_telegram_jobs(1)')).rows;
      assert.notEqual(next[0]?.id,jobs[0].id);
      await db.query('select finish_site_telegram_job($1,$2,100,null,null)',[jobs[0].id,crypto.randomUUID()]);
      assert.equal((await db.query<{status: string}>('select status from site_telegram_outbox where id=$1',[jobs[0].id])).rows[0].status,'sending');
      await db.query('select finish_site_telegram_job($1,$2,100,null,null)',[jobs[0].id,jobs[0].lease]);
      assert.equal((await db.query<{status: string}>('select status from site_telegram_outbox where id=$1',[jobs[0].id])).rows[0].status,'sent');
      await db.query("select finish_site_telegram_job($1,$2,null,'provider_rate_limit',60)",[next[0].id,next[0].lease]);
    });
    await test.step('public and authenticated clients cannot invoke bot operations or read support', async () => {
      for (const role of ['anon','authenticated']) {
        await db.exec('set role '+role);
        try {
          await assert.rejects(db.query('select * from site_telegram_support'));
          await assert.rejects(db.query('select * from claim_site_telegram_jobs(1)'));
          await assert.rejects(call(stockCommand));
        } finally { await db.exec('reset role'); }
      }
    });
  } finally { await db.close(); }
});
