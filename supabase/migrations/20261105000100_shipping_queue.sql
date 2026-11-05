begin;

-- Store only a verifier for the high-entropy, Windows-encrypted laptop key.
create table if not exists public.site_shipping_worker_auth (
  singleton boolean primary key default true check(singleton),
  token_sha256 text not null check(token_sha256 ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.site_shipping_worker_auth enable row level security;
revoke all on public.site_shipping_worker_auth from public,anon,authenticated;
create or replace function public.get_site_shipping_worker_digest()
returns text language sql security definer set search_path=public as $$
  select token_sha256 from site_shipping_worker_auth where singleton and active;
$$;
revoke all on function public.get_site_shipping_worker_digest() from public,anon,authenticated;
grant execute on function public.get_site_shipping_worker_digest() to service_role;

-- Shipment preparation is separate from gateway payment and fulfillment status.
create table if not exists public.site_shipping_runs (
  id uuid primary key default gen_random_uuid(),
  update_id bigint not null unique,
  requested_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.site_shipping_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.site_orders(id),
  provider text not null default 'shiplifier' check (provider='shiplifier'),
  status text not null default 'pending' check (status in ('pending','processing','needs_review','created','failed','cancelled')),
  run_id uuid references public.site_shipping_runs(id),
  lease uuid,
  locked_until timestamptz,
  attempts integer not null default 0,
  last_error text,
  shipment_id text,
  tracking_number text,
  courier text,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default now(),
  constraint site_shipping_created_evidence check (status<>'created' or
    coalesce(shipment_id ~ '^SM[0-9]{4,24}$' and tracking_number ~ '^[A-Za-z0-9-]{5,80}$' and length(courier) between 2 and 80,false))
);
create index if not exists site_shipping_pending_idx on public.site_shipping_jobs(status,created_at);
create unique index if not exists site_shipping_provider_id_idx on public.site_shipping_jobs(provider,shipment_id) where shipment_id is not null;
alter table public.site_shipping_runs enable row level security;
alter table public.site_shipping_jobs enable row level security;
revoke all on public.site_shipping_runs,public.site_shipping_jobs from public,anon,authenticated;
grant select on public.site_shipping_jobs to authenticated;
drop policy if exists site_shipping_admin_read on public.site_shipping_jobs;
create policy site_shipping_admin_read on public.site_shipping_jobs for select to authenticated using (public.is_admin());

create or replace function public.site_order_shipping_eligible(o public.site_orders)
returns boolean language sql stable set search_path=public as $$
  select o.source='website' and o.payment_provider='stripe' and o.payment_status='paid'
    and o.paid_at is not null and o.currency='AED' and left(o.payment_session_id,8)='cs_live_'
    and o.status not in ('cancelled','shipped','completed')
    and o.fulfillment_status not in ('cancelled','shipped','delivered')
    and o.refunded_total=0 and o.refund_pending_total=0 and not o.refund_attention_required;
$$;
revoke all on function public.site_order_shipping_eligible(public.site_orders) from public,anon,authenticated;
grant execute on function public.site_order_shipping_eligible(public.site_orders) to service_role;

create or replace function public.queue_site_shipping_order()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if site_order_shipping_eligible(new) then
    insert into site_shipping_jobs(order_id) values(new.id) on conflict(order_id) do nothing;
  else
    update site_shipping_jobs set status='cancelled',lease=null,locked_until=null,
      last_error='order_no_longer_eligible',updated_at=now()
      where order_id=new.id and status in ('pending','processing','needs_review','failed');
    if (new.payment_status<>'paid' or new.refunded_total>0 or new.refund_pending_total>0 or new.refund_attention_required
      or new.status='cancelled' or new.fulfillment_status='cancelled')
      and exists(select 1 from site_shipping_jobs where order_id=new.id and status='created') then
      perform enqueue_site_telegram('shipping-review:'||new.id||':'||md5(new.payment_status||new.status||new.fulfillment_status||new.refunded_total||new.refund_pending_total||new.refund_attention_required),
        null,'Shipping review required for '||new.order_number||E'\nOrder changed after shipment creation. Check Shiplifier before fulfillment.',new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_site_shipping_order() from public,anon,authenticated;
drop trigger if exists site_orders_shipping on public.site_orders;
create trigger site_orders_shipping after insert or update of payment_status,paid_at,status,fulfillment_status,refunded_total,refund_pending_total,refund_attention_required
on public.site_orders for each row execute function public.queue_site_shipping_order();

create or replace function public.process_site_shipping_update(
  p_update_id bigint,p_sender_id bigint,p_chat_id bigint,p_owner_id bigint,p_command jsonb
) returns boolean language plpgsql security definer set search_path=public as $$
declare reply text; run uuid; key text := 'update:'||p_update_id;
begin
  if p_update_id is null or p_update_id<0 or p_sender_id is null or p_sender_id<=0
    or p_chat_id is distinct from p_sender_id or p_owner_id is null or p_owner_id<=0
    or coalesce(p_command->>'kind','') not in ('process_all','shipping') then raise exception 'Invalid shipping command'; end if;
  perform pg_advisory_xact_lock(701801);
  if exists(select 1 from site_telegram_updates where update_id=p_update_id) then return false; end if;
  if p_sender_id<>p_owner_id then
    -- Match existing public-bot limits without exposing order counts or addresses.
    if (select count(*) from site_telegram_updates where sender_id=p_sender_id and created_at>now()-interval '1 minute')>=3
      or (select count(*) from site_telegram_updates where sender_id<>p_owner_id and created_at>now()-interval '1 minute')>=30 then return false; end if;
    reply := 'Store management is owner-only. Send /support followed by your question for customer support.';
  elsif p_command->>'kind'='process_all' then
    select id into run from site_shipping_runs where expires_at>now() order by requested_at desc limit 1;
    if run is null then
      insert into site_shipping_runs(update_id) values(p_update_id) returning id into run;
      reply := 'Shipping preparation requested. Eligible paid orders will wait safely until your laptop worker is running. It prepares forms for your review; it does not book or pay for a courier.';
    else
      update site_shipping_runs set requested_at=clock_timestamp(),expires_at=now()+interval '24 hours' where id=run;
      reply := 'The existing shipping preparation request now includes the eligible orders waiting now. No duplicate batch was created. Start the laptop worker, then check /shipping.';
    end if;
  else
    select coalesce(string_agg(status||': '||n,E'\n' order by status),'No shipping jobs yet.') into reply
      from (select status,count(*) n from site_shipping_jobs group by status) counts;
    reply := E'Shiplifier preparation\n'||reply||E'\n/process_all prepares paid live orders only. Review or failed jobs require attention in admin.';
  end if;
  insert into site_telegram_updates(update_id,sender_id) values(p_update_id,p_sender_id);
  perform enqueue_site_telegram(key||':response',p_chat_id,reply);
  return true;
end;
$$;
revoke all on function public.process_site_shipping_update(bigint,bigint,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.process_site_shipping_update(bigint,bigint,bigint,bigint,jsonb) to service_role;

create or replace function public.claim_site_shipping_job()
returns jsonb language plpgsql security definer set search_path=public as $$
declare job public.site_shipping_jobs%rowtype; ord public.site_orders%rowtype; run public.site_shipping_runs%rowtype;
begin
  -- A crash may happen after a form was saved. Never automatically repeat it.
  with expired as (
    update site_shipping_jobs set status='needs_review',lease=null,locked_until=null,
      last_error='worker_interrupted',updated_at=now() where status='processing' and locked_until<now() returning *
  ) insert into site_telegram_outbox(dedupe_key,message,order_id)
    select 'shipping-interrupted:'||e.id||':'||e.attempts,'Shipping worker interrupted. Review '||o.order_number||' before trying again.',e.order_id
      from expired e join site_orders o on o.id=e.order_id on conflict(dedupe_key) do nothing;
  select * into run from site_shipping_runs where expires_at>now() order by requested_at limit 1;
  if not found then return null; end if;
  select j.* into job from site_shipping_jobs j join site_orders o on o.id=j.order_id
    where j.status='pending' and j.created_at<=run.requested_at and site_order_shipping_eligible(o)
    order by j.created_at,j.id for update of j skip locked limit 1;
  if not found then
    update site_shipping_runs set expires_at=now() where id=run.id;
    return null;
  end if;
  -- The order trigger takes order -> job locks. Do not invert that lock order here.
  select * into ord from site_orders where id=job.order_id;
  if not site_order_shipping_eligible(ord) then return null; end if;
  update site_shipping_jobs set status='processing',run_id=run.id,lease=gen_random_uuid(),
    locked_until=now()+interval '10 minutes',attempts=attempts+1,updated_at=now(),last_error=null
    where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'lease',job.lease,'order',jsonb_build_object(
    'id',ord.id,'order_number',ord.order_number,'source',ord.source,'payment_status',ord.payment_status,
    'first_name',ord.first_name,'last_name',ord.last_name,'contact',ord.contact,'phone',ord.phone,
    'country',ord.country,'address',ord.address,'apartment',ord.apartment,'city',ord.city,'emirate',ord.emirate,
    'customer_notes',ord.customer_notes,'currency',ord.currency,'line_items',ord.line_items));
end;
$$;
revoke all on function public.claim_site_shipping_job() from public,anon,authenticated;
grant execute on function public.claim_site_shipping_job() to service_role;

create or replace function public.finish_site_shipping_job(p_id uuid,p_lease uuid,p_status text,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.site_shipping_jobs%rowtype; ord public.site_orders%rowtype;
begin
  if p_status not in ('needs_review','failed') or p_status is null
    or (p_error is not null and p_error not in ('missing_verified_profile','missing_package_profile','missing_customer_email','invalid_order','form_changed','login_required','worker_interrupted','prepared_for_review')) then
    raise exception 'Invalid shipping outcome'; end if;
  select * into job from site_shipping_jobs where id=p_id for update;
  if not found or job.status<>'processing' or job.lease is distinct from p_lease or job.locked_until<=now() then return false; end if;
  select * into ord from site_orders where id=job.order_id;
  if not site_order_shipping_eligible(ord) then return false; end if;
  update site_shipping_jobs set status=p_status,last_error=p_error,lease=null,locked_until=null,updated_at=now() where id=job.id;
  perform enqueue_site_telegram('shipping:'||job.id||':'||job.attempts,null,
    'Shipping '||p_status||': '||ord.order_number||E'\n'||coalesce(p_error,'Review required')||E'\nNo courier has been booked by this worker.',ord.id);
  return true;
end;
$$;
revoke all on function public.finish_site_shipping_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.finish_site_shipping_job(uuid,uuid,text,text) to service_role;

-- Only the signed-in store admin can record a booking completed in Shiplifier.
-- The laptop secret deliberately cannot mark shipments created or retry reviews.
create or replace function public.record_site_shipment(
  p_id uuid,p_expected_updated_at timestamptz,p_shipment_id text,p_tracking text,p_courier text
) returns boolean language plpgsql security definer set search_path=public as $$
declare job public.site_shipping_jobs%rowtype; ord public.site_orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_shipment_id is null or p_shipment_id !~ '^SM[0-9]{4,24}$' or p_tracking is null
    or p_tracking !~ '^[A-Za-z0-9-]{5,80}$' or p_courier is distinct from 'C3X' then raise exception 'Invalid shipment details'; end if;
  select * into job from site_shipping_jobs where id=p_id for update;
  if not found or job.updated_at is distinct from p_expected_updated_at or job.status not in ('pending','needs_review','failed') then
    raise exception 'Shipping preparation changed. Refresh before recording a shipment.'; end if;
  select * into ord from site_orders where id=job.order_id;
  if not site_order_shipping_eligible(ord) then raise exception 'Order is not eligible for shipping'; end if;
  update site_shipping_jobs set status='created',shipment_id=p_shipment_id,tracking_number=p_tracking,
    courier=p_courier,last_error=null,lease=null,locked_until=null,updated_at=clock_timestamp() where id=job.id;
  perform enqueue_site_telegram('shipment-recorded:'||job.id,null,'C3X shipment recorded for '||ord.order_number||E'\nTracking: '||p_tracking,ord.id);
  return true;
end;
$$;
revoke all on function public.record_site_shipment(uuid,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.record_site_shipment(uuid,timestamptz,text,text,text) to authenticated;

create or replace function public.retry_site_shipping_job(p_id uuid,p_expected_updated_at timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare job public.site_shipping_jobs%rowtype; ord public.site_orders%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into job from site_shipping_jobs where id=p_id for update;
  if not found or job.updated_at is distinct from p_expected_updated_at or job.status not in ('needs_review','failed')
    or job.shipment_id is not null then raise exception 'Shipping job cannot be retried'; end if;
  select * into ord from site_orders where id=job.order_id;
  if not site_order_shipping_eligible(ord) then raise exception 'Order is not eligible for shipping'; end if;
  update site_shipping_jobs set status='pending',last_error=null,created_at=clock_timestamp(),updated_at=clock_timestamp() where id=job.id;
  return true;
end;
$$;
revoke all on function public.retry_site_shipping_job(uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.retry_site_shipping_job(uuid,timestamptz) to authenticated;

-- No historical backfill: already fulfilled external shipments must not be duplicated.
commit;
