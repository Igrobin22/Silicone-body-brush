import assert from 'node:assert/strict';
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14';

Deno.test('product-photo migration preserves commerce data and restricts storage writes to store admins', async (test) => {
  const db = new PGlite();
  const schema = (await Deno.readTextFile(new URL('../admin-schema.sql', import.meta.url))).replace('create extension if not exists pgcrypto;', '');
  const photos = await Deno.readTextFile(new URL('../migrations/20261024000100_product_photos.sql', import.meta.url));
  const storage = await Deno.readTextFile(new URL('../migrations/20261024000200_product_photo_uploads.sql', import.meta.url));
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id bigint generated always as identity, bucket_id text, name text);
      create function storage.foldername(text) returns text[] language sql as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
      create function storage.extension(text) returns text language sql as $$ select reverse(split_part(reverse($1),'.',1)) $$;
      grant usage on schema auth, storage to anon, authenticated;
      grant insert,select,update,delete on storage.objects to anon, authenticated;
      grant usage on all sequences in schema storage to anon, authenticated;
      alter table storage.objects enable row level security;`);
    await db.exec(schema);
    await db.query('insert into auth.users values ($1), ($2)', [owner, other]);
    await db.query("insert into admin_profiles (id,email,role) values ($1,'owner@example.test','admin')", [owner]);
    const before = (await db.query('select slug,price,discount,inventory_quantity,visible from site_listings order by slug')).rows;
    await db.exec(photos);
    await db.exec(storage); await db.exec(storage);
    await test.step('only the three ordered galleries change, never prices, stock or visibility', async () => {
      assert.deepEqual((await db.query('select slug,price,discount,inventory_quantity,visible from site_listings order by slug')).rows, before);
      assert.deepEqual((await db.query<{ count: number }>('select cardinality(photo_urls) as count from site_listings order by slug')).rows.map(row => row.count), [7, 5, 9]);
      const bucket = (await db.query<{ public: boolean; file_size_limit: number; allowed_mime_types: string[] }>('select * from storage.buckets')).rows[0];
      assert.equal(bucket.public, true);
      assert.equal(Number(bucket.file_size_limit), 8388608);
      assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    });
    const insert = (name: string, bucket = 'product-photos') => db.query('insert into storage.objects (bucket_id,name) values ($1,$2)', [bucket, name]);
    await test.step('anonymous visitors and ordinary signed-in customers cannot upload', async () => {
      await db.exec('set role anon');
      await assert.rejects(insert(owner + '/pureform-4pc-set-black/test.webp'), /row-level security/);
      await db.exec('reset role; set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
      await assert.rejects(insert(other + '/pureform-4pc-set-black/test.webp'), /row-level security/);
    });
    await test.step('admins can insert only into their product folders, with image extensions', async () => {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
      await insert(owner + '/pureform-4pc-set-black/test.webp');
      for (const name of [other + '/pureform-4pc-set-black/test.webp', owner + '/orders/test.webp', owner + '/pureform-4pc-set-pink/test.svg']) {
        await assert.rejects(insert(name), /row-level security/);
      }
      await assert.rejects(insert(owner + '/pureform-4pc-set-black/test.webp', 'private-documents'), /row-level security/);
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
      assert.equal((await db.query("update storage.objects set name='overwrite.webp' returning *")).rows.length, 0);
      assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 0);
      await db.exec('reset role');
      assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    });
  } finally { await db.close(); }
});
