-- PureForm admin dashboard schema for Supabase.
-- Run this in the Supabase SQL editor before using /admin/.
--
-- Bootstrap:
-- 1. Create an auth user in Supabase Authentication.
-- 2. Replace the values below and run it once:
--    insert into public.admin_profiles (id, email, role)
--    values ('AUTH_USER_UUID', 'owner@example.com', 'admin');

begin;

create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_profiles_role_check check (role in ('admin'))
);

create table if not exists public.site_listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price numeric(10, 2) not null default 0,
  discount numeric(5, 2) not null default 0,
  discount_mode text not null default 'ongoing',
  discount_starts_at timestamptz,
  discount_ends_at timestamptz,
  inventory_quantity integer not null default 0,
  inventory_status text not null default 'in_stock',
  inventory_note text not null default '',
  visible boolean not null default true,
  photo_urls text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_listings_price_check check (price >= 0),
  constraint site_listings_discount_check check (discount >= 0 and discount <= 100),
  constraint site_listings_discount_mode_check check (discount_mode in ('ongoing', 'fixed')),
  constraint site_listings_discount_dates_check check (
    discount_mode = 'ongoing'
    or discount_ends_at is null
    or discount_starts_at is null
    or discount_ends_at >= discount_starts_at
  ),
  constraint site_listings_inventory_quantity_check check (inventory_quantity >= 0),
  constraint site_listings_inventory_status_check check (
    inventory_status in ('in_stock', 'low_stock', 'out_of_stock', 'preorder')
  )
);

alter table public.site_listings
  add column if not exists discount_mode text not null default 'ongoing',
  add column if not exists discount_starts_at timestamptz,
  add column if not exists discount_ends_at timestamptz,
  add column if not exists inventory_note text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'site_listings_discount_mode_check'
      and conrelid = 'public.site_listings'::regclass
  ) then
    alter table public.site_listings
      add constraint site_listings_discount_mode_check
      check (discount_mode in ('ongoing', 'fixed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'site_listings_discount_dates_check'
      and conrelid = 'public.site_listings'::regclass
  ) then
    alter table public.site_listings
      add constraint site_listings_discount_dates_check
      check (
        discount_mode = 'ongoing'
        or discount_ends_at is null
        or discount_starts_at is null
        or discount_ends_at >= discount_starts_at
      );
  end if;
end;
$$;

create table if not exists public.site_content_blocks (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  value text not null default '',
  block_type text not null default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_content_blocks_type_check check (
    block_type in ('text', 'rich_text', 'url', 'json')
  )
);

create table if not exists public.site_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('PF-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  status text not null default 'new',
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'unfulfilled',
  contact text not null default '',
  phone text not null default '',
  first_name text not null default '',
  last_name text not null default '',
  country text not null default 'United Arab Emirates',
  address text not null default '',
  apartment text not null default '',
  city text not null default '',
  emirate text not null default '',
  payment_preference text not null default '',
  payment_provider text not null default 'stripe',
  payment_session_id text not null default '',
  payment_intent_id text not null default '',
  payment_reference text not null default '',
  discount_code text not null default '',
  customer_notes text not null default '',
  admin_notes text not null default '',
  line_items jsonb not null default '[]'::jsonb,
  subtotal numeric(10, 2) not null default 0,
  shipping_total numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  currency text not null default 'AED',
  source text not null default 'website',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_orders_status_check check (
    status in ('new', 'confirmed', 'packing', 'shipped', 'completed', 'cancelled')
  ),
  constraint site_orders_payment_status_check check (
    payment_status in ('pending', 'requires_payment', 'paid', 'failed', 'refunded', 'cancelled')
  ),
  constraint site_orders_fulfillment_status_check check (
    fulfillment_status in ('unfulfilled', 'reserved', 'packed', 'shipped', 'delivered', 'cancelled')
  ),
  constraint site_orders_line_items_check check (jsonb_typeof(line_items) = 'array'),
  constraint site_orders_subtotal_check check (subtotal >= 0),
  constraint site_orders_shipping_total_check check (shipping_total >= 0),
  constraint site_orders_total_check check (total >= 0)
);

alter table public.site_orders
  add column if not exists order_number text not null default ('PF-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  add column if not exists status text not null default 'new',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists contact text not null default '',
  add column if not exists phone text not null default '',
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists country text not null default 'United Arab Emirates',
  add column if not exists address text not null default '',
  add column if not exists apartment text not null default '',
  add column if not exists city text not null default '',
  add column if not exists emirate text not null default '',
  add column if not exists payment_preference text not null default '',
  add column if not exists payment_provider text not null default 'stripe',
  add column if not exists payment_session_id text not null default '',
  add column if not exists payment_intent_id text not null default '',
  add column if not exists payment_reference text not null default '',
  add column if not exists discount_code text not null default '',
  add column if not exists customer_notes text not null default '',
  add column if not exists admin_notes text not null default '',
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(10, 2) not null default 0,
  add column if not exists shipping_total numeric(10, 2) not null default 0 check (shipping_total >= 0),
  add column if not exists total numeric(10, 2) not null default 0,
  add column if not exists currency text not null default 'AED',
  add column if not exists source text not null default 'website',
  add column if not exists paid_at timestamptz;

alter table public.site_orders
  add column if not exists stock_deducted boolean not null default false;

update public.site_orders
set
  payment_status = case
    when payment_status in ('cod_pending', 'payment_link_sent') then 'pending'
    else payment_status
  end,
  payment_provider = coalesce(nullif(payment_provider, ''), 'stripe')
where payment_status in ('cod_pending', 'payment_link_sent')
  or coalesce(payment_provider, '') = '';

alter table public.site_orders
  drop constraint if exists site_orders_payment_status_check;

alter table public.site_orders
  add constraint site_orders_payment_status_check check (
    payment_status in ('pending', 'requires_payment', 'paid', 'failed', 'refunded', 'cancelled')
  );

create index if not exists admin_profiles_email_idx on public.admin_profiles (email);
create index if not exists site_listings_visible_sort_idx on public.site_listings (visible, sort_order);
create index if not exists site_listings_inventory_status_idx on public.site_listings (inventory_status);
create index if not exists site_listings_discount_window_idx on public.site_listings (discount_mode, discount_starts_at, discount_ends_at);
create index if not exists site_listings_updated_at_idx on public.site_listings (updated_at desc);
create index if not exists site_content_blocks_key_idx on public.site_content_blocks (key);
create index if not exists site_orders_status_created_idx on public.site_orders (status, created_at desc);
create index if not exists site_orders_created_idx on public.site_orders (created_at desc);
create index if not exists site_orders_city_idx on public.site_orders (city);
create index if not exists site_orders_payment_status_idx on public.site_orders (payment_status, created_at desc);
create unique index if not exists site_orders_payment_session_id_idx
on public.site_orders (payment_session_id)
where payment_session_id <> '';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists admin_profiles_set_updated_at on public.admin_profiles;
create trigger admin_profiles_set_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists site_listings_set_updated_at on public.site_listings;
create trigger site_listings_set_updated_at
before update on public.site_listings
for each row execute function public.set_updated_at();

drop trigger if exists site_content_blocks_set_updated_at on public.site_content_blocks;
create trigger site_content_blocks_set_updated_at
before update on public.site_content_blocks
for each row execute function public.set_updated_at();

drop trigger if exists site_orders_set_updated_at on public.site_orders;
create trigger site_orders_set_updated_at
before update on public.site_orders
for each row execute function public.set_updated_at();

create or replace function public.reserve_site_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.site_orders%rowtype;
  item jsonb;
  item_quantity integer;
begin
  select * into order_record from public.site_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_record.payment_status <> 'requires_payment' or order_record.currency <> 'AED' then
    raise exception 'Order cannot reserve stock';
  end if;
  if order_record.stock_deducted then return; end if;
  if jsonb_array_length(order_record.line_items) not between 1 and 3 then
    raise exception 'Invalid order items';
  end if;

  -- Every stock operation locks products in the same order to avoid deadlocks.
  for item in select value from jsonb_array_elements(order_record.line_items) order by value ->> 'id'
  loop
    item_quantity = (item ->> 'quantity')::integer;
    if item_quantity is null or item_quantity not between 1 and 20 then raise exception 'Invalid quantity'; end if;
    update public.site_listings
    set inventory_quantity = inventory_quantity - item_quantity,
        inventory_status = case
          when inventory_quantity - item_quantity = 0 then 'out_of_stock'
          when inventory_quantity - item_quantity <= 5 then 'low_stock'
          else 'in_stock' end
    where slug = item ->> 'id'
      and slug in ('pureform-4pc-set-grey', 'pureform-4pc-set-black', 'pureform-4pc-set-pink')
      and visible and inventory_status <> 'out_of_stock' and inventory_quantity >= item_quantity;
    if not found then raise exception 'Not enough available stock'; end if;
  end loop;

  update public.site_orders set stock_deducted = true, fulfillment_status = 'reserved' where id = p_order_id;
end;
$$;

create or replace function public.release_site_order(p_order_id uuid, p_payment_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.site_orders%rowtype;
  item jsonb;
  item_quantity integer;
begin
  if p_payment_status is null or p_payment_status not in ('failed', 'cancelled') then raise exception 'Invalid release status'; end if;
  select * into order_record from public.site_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if order_record.paid_at is not null or order_record.payment_status in ('paid', 'refunded') then return; end if;

  if order_record.stock_deducted then
    for item in select value from jsonb_array_elements(order_record.line_items) order by value ->> 'id'
    loop
      item_quantity = (item ->> 'quantity')::integer;
      update public.site_listings
      set inventory_quantity = inventory_quantity + item_quantity,
          inventory_status = case when inventory_quantity + item_quantity <= 5 then 'low_stock' else 'in_stock' end
      where slug = item ->> 'id';
    end loop;
  end if;

  update public.site_orders
  set stock_deducted = false, status = 'cancelled', payment_status = p_payment_status, fulfillment_status = 'cancelled'
  where id = p_order_id;
end;
$$;

revoke all on function public.reserve_site_order(uuid) from public;
revoke all on function public.release_site_order(uuid, text) from public;
grant execute on function public.reserve_site_order(uuid) to service_role;
grant execute on function public.release_site_order(uuid, text) to service_role;

create or replace function public.apply_paid_site_order(
  p_order_id uuid,
  p_payment_session_id text,
  p_payment_intent_id text,
  p_paid_total numeric,
  p_payment_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.site_orders%rowtype;
begin
  select *
  into order_record
  from public.site_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'site order % was not found', p_order_id;
  end if;
  if coalesce(p_payment_session_id, '') = '' then raise exception 'Payment session is required'; end if;
  if order_record.payment_session_id <> '' and order_record.payment_session_id <> p_payment_session_id then
    raise exception 'Payment session does not match the order';
  end if;
  if order_record.currency <> 'AED' or p_paid_total is null or p_paid_total < order_record.shipping_total
     or p_paid_total > order_record.subtotal + order_record.shipping_total then
    raise exception 'Invalid payment total or currency';
  end if;
  -- A webhook retry must not deduct stock again or reverse a later refund.
  if order_record.paid_at is not null or order_record.payment_status in ('paid', 'refunded') then return; end if;
  if not order_record.stock_deducted then perform public.reserve_site_order(p_order_id); end if;

  update public.site_orders
  set
    status = case when status = 'new' then 'confirmed' else status end,
    payment_status = 'paid',
    fulfillment_status = case when fulfillment_status = 'unfulfilled' then 'reserved' else fulfillment_status end,
    payment_provider = 'stripe',
    payment_session_id = coalesce(nullif(p_payment_session_id, ''), payment_session_id),
    payment_intent_id = coalesce(nullif(p_payment_intent_id, ''), payment_intent_id),
    payment_reference = coalesce(nullif(p_payment_reference, ''), payment_reference),
    total = p_paid_total,
    paid_at = coalesce(paid_at, now())
  where id = p_order_id;

end;
$$;

revoke all on function public.apply_paid_site_order(uuid, text, text, numeric, text) from public;
grant execute on function public.apply_paid_site_order(uuid, text, text, numeric, text) to service_role;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.admin_profiles enable row level security;
alter table public.site_listings enable row level security;
alter table public.site_content_blocks enable row level security;
alter table public.site_orders enable row level security;

drop policy if exists admin_profiles_select_own on public.admin_profiles;
drop policy if exists admin_profiles_select_own_or_admin on public.admin_profiles;
create policy admin_profiles_select_own
on public.admin_profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists admin_profiles_admin_insert on public.admin_profiles;
create policy admin_profiles_admin_insert
on public.admin_profiles
for insert
to authenticated
with check (public.is_admin());

drop policy if exists admin_profiles_admin_update on public.admin_profiles;
create policy admin_profiles_admin_update
on public.admin_profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists admin_profiles_admin_delete on public.admin_profiles;
create policy admin_profiles_admin_delete
on public.admin_profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists site_listings_public_visible_select on public.site_listings;
create policy site_listings_public_visible_select
on public.site_listings
for select
to anon, authenticated
using (visible = true or public.is_admin());

drop policy if exists site_listings_admin_insert on public.site_listings;
create policy site_listings_admin_insert
on public.site_listings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists site_listings_admin_update on public.site_listings;
create policy site_listings_admin_update
on public.site_listings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists site_listings_admin_delete on public.site_listings;
create policy site_listings_admin_delete
on public.site_listings
for delete
to authenticated
using (public.is_admin());

drop policy if exists site_content_blocks_public_select on public.site_content_blocks;
create policy site_content_blocks_public_select
on public.site_content_blocks
for select
to anon, authenticated
using (true);

drop policy if exists site_content_blocks_admin_insert on public.site_content_blocks;
create policy site_content_blocks_admin_insert
on public.site_content_blocks
for insert
to authenticated
with check (public.is_admin());

drop policy if exists site_content_blocks_admin_update on public.site_content_blocks;
create policy site_content_blocks_admin_update
on public.site_content_blocks
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists site_content_blocks_admin_delete on public.site_content_blocks;
create policy site_content_blocks_admin_delete
on public.site_content_blocks
for delete
to authenticated
using (public.is_admin());

drop policy if exists site_orders_public_insert on public.site_orders;

drop policy if exists site_orders_admin_select on public.site_orders;
create policy site_orders_admin_select
on public.site_orders
for select
to authenticated
using (public.is_admin());

drop policy if exists site_orders_admin_update on public.site_orders;
create policy site_orders_admin_update
on public.site_orders
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists site_orders_admin_delete on public.site_orders;
create policy site_orders_admin_delete
on public.site_orders
for delete
to authenticated
using (public.is_admin());

-- Payment fields and stock reservations are written by verified server functions only.
revoke all on public.site_orders from anon, authenticated;
grant select on public.site_orders to authenticated;
grant update (status, fulfillment_status, admin_notes) on public.site_orders to authenticated;

with slug_map as (
  select *
  from (values
    ('grey-4-piece-silicone-brush-set', 'pureform-4pc-set-grey'),
    ('black-4-piece-silicone-brush-set', 'pureform-4pc-set-black'),
    ('pink-4-piece-silicone-brush-set', 'pureform-4pc-set-pink')
  ) as mapped(legacy_slug, canonical_slug)
)
update public.site_listings target
set slug = slug_map.canonical_slug
from slug_map
where target.slug = slug_map.legacy_slug
  and not exists (
    select 1
    from public.site_listings existing
    where existing.slug = slug_map.canonical_slug
  );

insert into public.site_listings (
  slug,
  name,
  description,
  price,
  discount,
  discount_mode,
  discount_starts_at,
  discount_ends_at,
  inventory_quantity,
  inventory_status,
  inventory_note,
  visible,
  photo_urls,
  sort_order
)
values
  (
    'pureform-4pc-set-grey',
    'Grey 4-Piece Silicone Brush Set',
    'A complete silicone brush set with a back scrubber, body brush, scalp massager, and face brush.',
    87.78,
    50,
    'ongoing',
    null,
    null,
    24,
    'in_stock',
    'Ready to ship. Includes back scrubber, body brush, scalp massager, and face brush.',
    true,
    array[
      'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553521/Main_with_background_anlah0.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553519/grey_transparent_all_4_piece_med27b.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553513/grey_white_bg_irnzyc.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/v1779553535/grey_Head_h1duwj.png'
    ],
    10
  ),
  (
    'pureform-4pc-set-black',
    'Black 4-Piece Silicone Brush Set',
    'The same four-piece PureForm routine in Black.',
    87.78,
    50,
    'ongoing',
    null,
    null,
    18,
    'in_stock',
    'Black set listing. Keep stock count synced with available black inventory.',
    true,
    array[
      '/assets/pureform-body-brush.png'
    ],
    20
  ),
  (
    'pureform-4pc-set-pink',
    'Pink 4-Piece Silicone Brush Set',
    'A softer Pink finish for the same face, scalp, body, and back care routine.',
    42,
    10,
    'ongoing',
    null,
    null,
    12,
    'low_stock',
    'Low stock alert. Uses dedicated pink product photography.',
    true,
    array[
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/main_img_voei63.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227618/main_img_without_bg_mbrxsg.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227616/p_body_1_kgg059.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/p_body_2_lv1x37.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227617/p_face_1_f4vdyz.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_face_2_yoirlr.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_head_1_yquyts.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227620/p_head_2_vtl4pl.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_handle_1_crtic9.png',
      'https://res.cloudinary.com/dqjilscgl/image/upload/q_auto/f_auto/v1780227619/p_handle_2_komo0m.png'
    ],
    30
  )
on conflict (slug) do nothing;

insert into public.site_content_blocks (key, label, value, block_type)
values
  ('home.hero.title', 'Home hero title', 'Soft touch. Deep clean. Every day.', 'text'),
  ('home.hero.body', 'Home hero body', 'A complete silicone brush set made for smoother cleansing, easier reach, and a fresher post-shower feel.', 'text'),
  ('site.announcement', 'Announcement bar', 'UAE delivery and secure card checkout on PureForm orders', 'text'),
  ('sidebar.announcement', 'Sidebar announcement', 'Need help choosing a set? Support can confirm color, stock, UAE delivery, and secure card checkout.', 'text'),
  ('popup.message', 'Popup message', 'Add the exact popup copy here once the popup purpose is confirmed.', 'text')
on conflict (key) do nothing;

commit;
