begin;

create table if not exists public.site_telegram_updates (
  update_id bigint primary key,
  sender_id bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists site_telegram_updates_sender_idx on public.site_telegram_updates(sender_id,created_at);
create table if not exists public.site_telegram_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  chat_id bigint,
  message text not null check (length(message) between 1 and 3500),
  order_id uuid references public.site_orders(id),
  reply_markup jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  locked_at timestamptz,
  message_id bigint,
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists site_telegram_outbox_pending_idx on public.site_telegram_outbox(status,available_at);
create table if not exists public.site_telegram_support (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null check (chat_id > 0),
  message text not null check (length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);
create table if not exists public.site_telegram_changes (
  id uuid primary key default gen_random_uuid(),
  owner_id bigint not null,
  kind text not null check (kind in ('stock','discount')),
  slug text not null check (slug in ('pureform-4pc-set-grey','pureform-4pc-set-black','pureform-4pc-set-pink')),
  value numeric not null,
  expected_updated_at timestamptz not null,
  expires_at timestamptz not null default now() + interval '5 minutes',
  status text not null default 'pending' check (status in ('pending','applied','cancelled','expired','stale')),
  previous_values jsonb not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.site_telegram_updates enable row level security;
alter table public.site_telegram_outbox enable row level security;
alter table public.site_telegram_support enable row level security;
alter table public.site_telegram_changes enable row level security;
revoke all on public.site_telegram_updates, public.site_telegram_outbox, public.site_telegram_support, public.site_telegram_changes from public,anon,authenticated;

create or replace function public.enqueue_site_telegram(p_key text, p_chat bigint, p_message text, p_order uuid default null, p_markup jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into site_telegram_outbox(dedupe_key,chat_id,message,order_id,reply_markup)
  values(p_key,p_chat,left(p_message,3500),p_order,p_markup) on conflict(dedupe_key) do nothing;
$$;
revoke all on function public.enqueue_site_telegram(text,bigint,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_site_telegram(text,bigint,text,uuid,jsonb) to service_role;

create or replace function public.queue_site_telegram_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare prefix text := case when new.source = 'stripe_sandbox' then '[SANDBOX - DO NOT FULFILL] ' else '' end;
begin
  if new.paid_at is not null and (tg_op = 'INSERT' or old.paid_at is null) then
    perform enqueue_site_telegram('paid:'||new.id,null,prefix||'Payment received'||E'\n'||new.order_number||E'\nAED '||new.total,new.id);
  end if;
  if tg_op = 'UPDATE' and new.paid_at is not null and
    (new.refunded_total,new.refund_pending_total,new.refund_attention_required) is distinct from
    (old.refunded_total,old.refund_pending_total,old.refund_attention_required) then
    perform enqueue_site_telegram('refund:'||new.id||':'||md5(concat_ws(':',new.refunded_total,new.refund_pending_total,new.refund_attention_required)),null,
      prefix||'Refund update'||E'\n'||new.order_number||E'\nRefunded AED '||new.refunded_total||E'\nPending AED '||new.refund_pending_total||
      case when new.refund_attention_required then E'\nAction required in Stripe' else '' end,new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.queue_site_telegram_order() from public,anon,authenticated;
drop trigger if exists site_orders_telegram on public.site_orders;
create trigger site_orders_telegram after insert or update of paid_at,refunded_total,refund_pending_total,refund_attention_required
on public.site_orders for each row execute function public.queue_site_telegram_order();

create or replace function public.process_site_telegram_update(
  p_update_id bigint,p_sender_id bigint,p_chat_id bigint,p_owner_id bigint,p_command jsonb
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  owner boolean := p_sender_id = p_owner_id and p_chat_id = p_owner_id;
  kind text := p_command->>'kind';
  key text := 'update:'||p_update_id;
  reply text;
  markup jsonb;
  product public.site_listings%rowtype;
  change public.site_telegram_changes%rowtype;
  target uuid;
  destination bigint;
  amount numeric;
begin
  if p_update_id is null or p_update_id < 0 or p_sender_id is null or p_sender_id <= 0
     or p_chat_id is distinct from p_sender_id or p_owner_id is null or p_owner_id <= 0
     or jsonb_typeof(p_command) is distinct from 'object' then raise exception 'Invalid Telegram update'; end if;
  -- Serialize the short intake transaction so support flooding cannot race the limits.
  perform pg_advisory_xact_lock(701801);
  if exists(select 1 from site_telegram_updates where update_id=p_update_id) then return false; end if;
  delete from site_telegram_updates where created_at < now()-interval '7 days';
  if not owner and ((select count(*) from site_telegram_updates where sender_id=p_sender_id and created_at>now()-interval '1 minute') >= 3
    or (select count(*) from site_telegram_updates where sender_id<>p_owner_id and created_at>now()-interval '1 minute') >= 30) then return false; end if;
  insert into site_telegram_updates(update_id,sender_id) values(p_update_id,p_sender_id);

  if not owner and kind not in ('help','support') then
    reply := 'Store management is owner-only. For help, send /support followed by your message. Never send card details or passwords.';
  elsif kind = 'support' and not owner then
    reply := trim(p_command->>'text');
    if reply is null or length(reply) not between 1 and 1000 then raise exception 'Invalid support message'; end if;
    insert into site_telegram_support(chat_id,message) values(p_chat_id,reply) returning id into target;
    perform enqueue_site_telegram(key||':support',null,'Support ticket '||target||E'\nCustomer message (untrusted text):\n'||reply||E'\n\nReply with /reply '||target||' your message');
    reply := 'Your message was sent to PureForm support. Keep this chat open for a reply. Do not send card details or passwords.';
  elsif kind = 'reply' and owner then
    target := (p_command->>'id')::uuid;
    select chat_id into destination from site_telegram_support where id=target;
    reply := trim(p_command->>'text');
    if destination is null or reply is null or length(reply) not between 1 and 1000 then raise exception 'Invalid support reply'; end if;
    perform enqueue_site_telegram(key||':reply',destination,'PureForm support:'||E'\n'||reply);
    reply := 'Support reply queued for ticket '||target||'.';
  elsif kind in ('stock','discount') and owner then
    amount := (p_command->>'value')::numeric;
    if amount is null or amount < 0 or amount > (case when kind='stock' then 100000 else 100 end)
      or (kind='stock' and amount<>trunc(amount)) or (kind='discount' and amount<>round(amount,2)) then raise exception 'Invalid change amount'; end if;
    select * into product from site_listings where slug=p_command->>'slug' and slug in
      ('pureform-4pc-set-grey','pureform-4pc-set-black','pureform-4pc-set-pink') for update;
    if not found then raise exception 'Unknown product'; end if;
    insert into site_telegram_changes(owner_id,kind,slug,value,expected_updated_at,previous_values)
      values(p_owner_id,kind,product.slug,amount,product.updated_at,jsonb_build_object('inventory_quantity',product.inventory_quantity,
        'inventory_status',product.inventory_status,'discount',product.discount,'discount_mode',product.discount_mode,
        'discount_starts_at',product.discount_starts_at,'discount_ends_at',product.discount_ends_at)) returning id into target;
    reply := case when kind='stock' then 'Set AVAILABLE stock for '||product.name||' from '||product.inventory_quantity||' to '||amount||'. This changes what customers can buy.'
      else 'Replace the current offer for '||product.name||' with an ongoing '||amount||'% discount until changed. Scheduled offer dates will be removed.' end||
      E'\nConfirm within 5 minutes. No change has been made yet.';
    markup := jsonb_build_object('inline_keyboard',jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text','Confirm change','callback_data','confirm:'||target),
      jsonb_build_object('text','Cancel','callback_data','cancel:'||target))));
  elsif kind in ('confirm','cancel') and owner then
    select * into change from site_telegram_changes where id=(p_command->>'id')::uuid and owner_id=p_owner_id for update;
    if not found then reply := 'Change not found. Nothing was updated.';
    elsif change.status <> 'pending' then reply := 'This change is already '||change.status||'. Nothing was updated.';
    elsif kind='cancel' then
      update site_telegram_changes set status='cancelled' where id=change.id;
      reply := 'Change cancelled. Nothing was updated.';
    elsif change.expires_at<=now() then
      update site_telegram_changes set status='expired' where id=change.id;
      reply := 'Confirmation expired. Send a new stock or discount command.';
    else
      select * into product from site_listings where slug=change.slug for update;
      if not found or product.updated_at is distinct from change.expected_updated_at then
        update site_telegram_changes set status='stale' where id=change.id;
        reply := 'Product data changed since your request. Nothing was updated. Check /inventory or /discounts, then request again.';
      else
        if change.kind='stock' then
          update site_listings set inventory_quantity=change.value::integer,
            inventory_status=case when change.value=0 then 'out_of_stock' when change.value<=5 then 'low_stock' else 'in_stock' end where id=product.id;
        else
          update site_listings set discount=change.value,discount_mode='ongoing',discount_starts_at=null,discount_ends_at=null where id=product.id;
        end if;
        update site_telegram_changes set status='applied',applied_at=now() where id=change.id;
        reply := 'Updated '||product.name||': '||case when change.kind='stock' then 'available stock '||change.value else change.value||'% ongoing discount' end||'.';
      end if;
    end if;
  elsif kind in ('inventory','discounts') and owner then
    select string_agg(name||': '||case when kind='inventory' then inventory_quantity||' available / '||inventory_status
      else discount||'% / '||discount_mode||coalesce(' / starts '||discount_starts_at::text,'')||coalesce(' / ends '||discount_ends_at::text,'') end,E'\n' order by sort_order)
    into reply from site_listings where slug in ('pureform-4pc-set-grey','pureform-4pc-set-black','pureform-4pc-set-pink');
    reply := coalesce(reply,'No canonical products found.');
  elsif kind='orders' and owner then
    select string_agg(order_number||': AED '||total||' / '||payment_status||case when source='stripe_sandbox' then ' / SANDBOX' else '' end,E'\n' order by created_at desc)
    into reply from (select order_number,total,payment_status,source,created_at from site_orders order by created_at desc limit 5) recent;
    reply := coalesce(reply,'No orders yet.');
  else
    reply := case when owner then E'PureForm owner commands:\n/inventory\n/discounts\n/orders\n/stock grey 24\n/discount pink 15\n/discount pink off\n/reply TICKET_ID message\nStock and discount edits require confirmation. Payments cannot be edited here.'
      else E'PureForm support. UAE delivery is AED 10 per order.\nSend /support followed by your question to contact the store. Your message is processed by Telegram and PureForm support. Never send card details or passwords.' end;
  end if;
  perform enqueue_site_telegram(key||':response',p_chat_id,reply,null,markup);
  return true;
end;
$$;
revoke all on function public.process_site_telegram_update(bigint,bigint,bigint,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.process_site_telegram_update(bigint,bigint,bigint,bigint,jsonb) to service_role;

create or replace function public.claim_site_telegram_jobs(p_limit integer default 5)
returns setof public.site_telegram_outbox language plpgsql security definer set search_path=public as $$
begin
  update site_telegram_outbox set status=case when attempts>=12 then 'failed' else 'pending' end,
    lease=null,locked_at=null,last_error='delivery_lease_expired' where status='sending' and locked_at<now()-interval '2 minutes';
  return query with jobs as (select id from site_telegram_outbox where status='pending' and available_at<=now()
    order by created_at,id for update skip locked limit greatest(1,least(coalesce(p_limit,5),10)))
    update site_telegram_outbox o set status='sending',lease=gen_random_uuid(),locked_at=now(),attempts=attempts+1
    from jobs where o.id=jobs.id returning o.*;
end;
$$;
revoke all on function public.claim_site_telegram_jobs(integer) from public,anon,authenticated;
grant execute on function public.claim_site_telegram_jobs(integer) to service_role;

create or replace function public.finish_site_telegram_job(p_id uuid,p_lease uuid,p_message_id bigint,p_error text,p_retry_after integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_error is not null and p_error not in ('network_uncertain','provider_rate_limit','provider_rejected','invalid_response') then raise exception 'Invalid delivery outcome'; end if;
  if p_message_id is not null and p_message_id<=0 then raise exception 'Invalid message ID'; end if;
  update site_telegram_outbox set status=case when p_message_id is not null then 'sent'
    when p_retry_after is null or attempts>=12 then 'failed' else 'pending' end,
    message_id=p_message_id,last_error=p_error,lease=null,locked_at=null,
    available_at=now()+make_interval(secs=>greatest(5,least(coalesce(p_retry_after,60),3600)))
  where id=p_id and lease=p_lease and status='sending';
end;
$$;
revoke all on function public.finish_site_telegram_job(uuid,uuid,bigint,text,integer) from public,anon,authenticated;
grant execute on function public.finish_site_telegram_job(uuid,uuid,bigint,text,integer) to service_role;

commit;
