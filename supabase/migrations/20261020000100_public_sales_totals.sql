begin;

create or replace function public.get_public_sales_totals()
returns table (slug text, total_sold bigint, sold_this_week bigint)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  with sales as (
    select item->>'id' as product_slug,
      case when item->>'quantity' ~ '^([1-9]|1[0-9]|20)$'
        then (item->>'quantity')::integer else 0 end as quantity,
      orders.paid_at
    from public.site_orders as orders
    cross join lateral jsonb_array_elements(orders.line_items) as item
    where orders.source = 'website'
      and orders.payment_provider = 'stripe'
      and left(orders.payment_session_id, 8) = 'cs_live_'
      and orders.payment_status = 'paid'
      and orders.paid_at is not null
      and orders.status <> 'cancelled'
      and orders.fulfillment_status <> 'cancelled'
      and orders.refunded_total = 0
  )
  select listing.slug,
    coalesce(sum(sales.quantity), 0)::bigint,
    coalesce(sum(sales.quantity) filter (where sales.paid_at >=
      (date_trunc('week', now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai')), 0)::bigint
  from public.site_listings as listing
  left join sales on sales.product_slug = listing.slug
  where listing.visible and listing.slug in
    ('pureform-4pc-set-grey', 'pureform-4pc-set-black', 'pureform-4pc-set-pink')
  group by listing.slug
  order by listing.slug;
$$;

revoke all on function public.get_public_sales_totals() from public;
grant execute on function public.get_public_sales_totals() to anon, authenticated, service_role;

commit;
