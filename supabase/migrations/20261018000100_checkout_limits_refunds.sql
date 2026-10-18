begin;

create table if not exists public.site_checkout_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.site_checkout_limits enable row level security;
revoke all on public.site_checkout_limits from public, anon, authenticated;

create or replace function public.check_site_checkout_limit(p_phone_hash text, p_contact_hash text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  entry record;
  retry_after integer := 0;
begin
  if p_phone_hash !~ '^[a-f0-9]{64}$' or p_contact_hash !~ '^[a-f0-9]{64}$'
     or p_phone_hash is null or p_contact_hash is null then
    raise exception 'Invalid checkout fingerprint';
  end if;
  delete from site_checkout_limits where window_started_at < now() - interval '1 day';
  insert into site_checkout_limits (key)
  select value from unnest(array['global', 'phone:' || p_phone_hash, 'contact:' || p_contact_hash]) value
  order by value on conflict do nothing;
  -- Lock every bucket in a stable order; concurrent workers share the same limits.
  for entry in select * from site_checkout_limits
    where key in ('global', 'phone:' || p_phone_hash, 'contact:' || p_contact_hash)
    order by key for update
  loop
    if entry.window_started_at > now() - interval '10 minutes'
       and entry.attempts >= (case when entry.key = 'global' then 60 else 4 end) then
      retry_after := greatest(retry_after, ceil(extract(epoch from entry.window_started_at + interval '10 minutes' - now()))::integer);
    end if;
  end loop;
  if retry_after > 0 then return retry_after; end if;
  update site_checkout_limits set
    attempts = case when window_started_at <= now() - interval '10 minutes' then 1 else attempts + 1 end,
    window_started_at = case when window_started_at <= now() - interval '10 minutes' then now() else window_started_at end
  where key in ('global', 'phone:' || p_phone_hash, 'contact:' || p_contact_hash);
  return 0;
end;
$$;
revoke all on function public.check_site_checkout_limit(text, text) from public;
grant execute on function public.check_site_checkout_limit(text, text) to service_role;

alter table public.site_orders
  add column if not exists refunded_total numeric(10,2) not null default 0 check (refunded_total >= 0),
  add column if not exists refund_pending_total numeric(10,2) not null default 0 check (refund_pending_total >= 0),
  add column if not exists refund_attention_required boolean not null default false;

create table if not exists public.site_gateway_payments (
  payment_intent_id text primary key check (payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  order_id uuid unique references public.site_orders(id),
  created_at timestamptz not null default now()
);
create table if not exists public.site_payment_refunds (
  refund_id text primary key check (refund_id ~ '^re_[A-Za-z0-9_]+$'),
  payment_intent_id text not null references public.site_gateway_payments(payment_intent_id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency = 'aed'),
  status text not null check (status in ('pending','requires_action','succeeded','failed','canceled')),
  livemode boolean not null,
  event_created bigint not null check (event_created > 0),
  updated_at timestamptz not null default now()
);
create index if not exists site_payment_refunds_intent_idx on public.site_payment_refunds(payment_intent_id);
alter table public.site_gateway_payments enable row level security;
alter table public.site_payment_refunds enable row level security;
revoke all on public.site_gateway_payments, public.site_payment_refunds from public, anon, authenticated;

create or replace function public.refresh_site_order_refunds(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  saved public.site_orders%rowtype;
  refunded numeric;
  pending numeric;
  attention boolean;
begin
  select * into saved from site_orders where id = p_order_id for update;
  if not found or saved.paid_at is null then return; end if;
  if exists (select 1 from site_payment_refunds where payment_intent_id = saved.payment_intent_id
    and livemode <> (saved.source <> 'stripe_sandbox')) then raise exception 'Refund environment mismatch'; end if;
  select coalesce(sum(amount_minor) filter (where status = 'succeeded'), 0) / 100.0,
         coalesce(sum(amount_minor) filter (where status in ('pending','requires_action')), 0) / 100.0,
         coalesce(bool_or(status in ('failed','requires_action')), false)
  into refunded, pending, attention from site_payment_refunds where payment_intent_id = saved.payment_intent_id;
  if refunded + pending > saved.total then raise exception 'Refund exceeds the paid total'; end if;
  update site_orders set refunded_total = refunded, refund_pending_total = pending,
    refund_attention_required = attention and refunded < saved.total,
    payment_status = case when saved.payment_status = 'refunded' and saved.refunded_total = 0 then 'refunded'
      when refunded >= saved.total and saved.total > 0 then 'refunded' else 'paid' end
  where id = p_order_id;
  -- Refunds never imply a physical return or restore inventory.
end;
$$;
revoke all on function public.refresh_site_order_refunds(uuid) from public;
grant execute on function public.refresh_site_order_refunds(uuid) to service_role;

create or replace function public.record_site_refund(
  p_refund_id text, p_payment_intent_id text, p_amount_minor bigint, p_currency text,
  p_status text, p_livemode boolean, p_event_created bigint
)
returns void language plpgsql security definer set search_path = public as $$
declare
  previous public.site_payment_refunds%rowtype;
  linked_order uuid;
  statuses text[] := array['pending','requires_action','succeeded','canceled','failed'];
begin
  if p_refund_id is null or p_refund_id !~ '^re_[A-Za-z0-9_]+$'
     or p_payment_intent_id is null or p_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
     or p_amount_minor is null or p_amount_minor <= 0 or p_currency is distinct from 'aed'
     or p_status is null or not p_status = any(statuses) or p_livemode is null
     or p_event_created is null or p_event_created <= 0 then raise exception 'Invalid refund'; end if;
  insert into site_gateway_payments(payment_intent_id) values (p_payment_intent_id) on conflict do nothing;
  select order_id into linked_order from site_gateway_payments where payment_intent_id = p_payment_intent_id for update;
  -- Attach older paid orders too, without requiring a new checkout.
  if linked_order is null then
    if (select count(*) from site_orders where payment_intent_id = p_payment_intent_id) > 1 then
      raise exception 'Payment intent belongs to multiple orders';
    end if;
    select id into linked_order from site_orders where payment_intent_id = p_payment_intent_id limit 1;
    if linked_order is not null then
      update site_gateway_payments set order_id = linked_order where payment_intent_id = p_payment_intent_id;
    end if;
  end if;
  select * into previous from site_payment_refunds where refund_id = p_refund_id for update;
  if found then
    if previous.payment_intent_id <> p_payment_intent_id or previous.amount_minor <> p_amount_minor
       or previous.currency <> p_currency or previous.livemode <> p_livemode then raise exception 'Refund identity mismatch'; end if;
    if p_event_created < previous.event_created then return; end if;
    if previous.status in ('succeeded','canceled','failed') and p_status in ('pending','requires_action') then return; end if;
    if p_event_created = previous.event_created and array_position(statuses,p_status) <= array_position(statuses,previous.status) then return; end if;
  end if;
  insert into site_payment_refunds(refund_id,payment_intent_id,amount_minor,currency,status,livemode,event_created)
    values(p_refund_id,p_payment_intent_id,p_amount_minor,p_currency,p_status,p_livemode,p_event_created)
  on conflict(refund_id) do update set status=excluded.status,event_created=excluded.event_created,updated_at=now();
  if linked_order is not null then perform refresh_site_order_refunds(linked_order); end if;
end;
$$;
revoke all on function public.record_site_refund(text,text,bigint,text,text,boolean,bigint) from public;
grant execute on function public.record_site_refund(text,text,bigint,text,text,boolean,bigint) to service_role;

create or replace function public.apply_paid_site_order(
  p_order_id uuid, p_payment_session_id text, p_payment_intent_id text,
  p_paid_total numeric, p_payment_reference text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  order_record public.site_orders%rowtype;
  linked_order uuid;
begin
  if coalesce(p_payment_intent_id,'') = '' then raise exception 'Payment intent is required'; end if;
  insert into site_gateway_payments(payment_intent_id) values(p_payment_intent_id) on conflict do nothing;
  -- Payment and refund events take this same lock before the order lock.
  select order_id into linked_order from site_gateway_payments where payment_intent_id=p_payment_intent_id for update;
  if linked_order is not null and linked_order <> p_order_id then raise exception 'Payment intent belongs to another order'; end if;
  select * into order_record from site_orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if coalesce(p_payment_session_id,'')='' then raise exception 'Payment session is required'; end if;
  if order_record.payment_session_id<>'' and order_record.payment_session_id<>p_payment_session_id then raise exception 'Payment session does not match the order'; end if;
  if order_record.payment_intent_id<>'' and order_record.payment_intent_id<>p_payment_intent_id then raise exception 'Payment intent does not match the order'; end if;
  if order_record.currency<>'AED' or p_paid_total is null or p_paid_total<order_record.shipping_total
     or p_paid_total>order_record.subtotal+order_record.shipping_total then raise exception 'Invalid payment total or currency'; end if;
  update site_gateway_payments set order_id=p_order_id where payment_intent_id=p_payment_intent_id;
  if order_record.paid_at is not null or order_record.payment_status in ('paid','refunded') then return; end if;
  if not order_record.stock_deducted then perform reserve_site_order(p_order_id); end if;
  update site_orders set status=case when status='new' then 'confirmed' else status end,
    payment_status='paid', fulfillment_status=case when fulfillment_status='unfulfilled' then 'reserved' else fulfillment_status end,
    payment_provider='stripe', payment_session_id=p_payment_session_id, payment_intent_id=p_payment_intent_id,
    payment_reference=coalesce(nullif(p_payment_reference,''),payment_reference), total=p_paid_total, paid_at=now()
  where id=p_order_id;
  if exists(select 1 from site_payment_refunds where payment_intent_id=p_payment_intent_id) then
    perform refresh_site_order_refunds(p_order_id);
  end if;
end;
$$;
revoke all on function public.apply_paid_site_order(uuid,text,text,numeric,text) from public;
grant execute on function public.apply_paid_site_order(uuid,text,text,numeric,text) to service_role;

commit;
