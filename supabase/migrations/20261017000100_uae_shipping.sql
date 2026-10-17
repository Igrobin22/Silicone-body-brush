begin;

-- Preserve historical orders: only newly created checkouts receive the AED 10 fee.
alter table public.site_orders
  add column if not exists shipping_total numeric(10, 2) not null default 0 check (shipping_total >= 0);

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

commit;
