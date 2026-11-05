begin;

-- Supabase's default privileges may grant anon/authenticated directly. Revoking
-- PUBLIC alone does not remove those grants. These writes belong to the verified
-- checkout/webhook backend, never to a storefront or an admin browser session.
revoke all on function public.apply_paid_site_order(uuid,text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.reserve_site_order(uuid) from public,anon,authenticated;
revoke all on function public.release_site_order(uuid,text) from public,anon,authenticated;
revoke all on function public.check_site_checkout_limit(text,text) from public,anon,authenticated;
revoke all on function public.refresh_site_order_refunds(uuid) from public,anon,authenticated;
revoke all on function public.record_site_refund(text,text,bigint,text,text,boolean,bigint) from public,anon,authenticated;

grant execute on function public.apply_paid_site_order(uuid,text,text,numeric,text) to service_role;
grant execute on function public.reserve_site_order(uuid) to service_role;
grant execute on function public.release_site_order(uuid,text) to service_role;
grant execute on function public.check_site_checkout_limit(text,text) to service_role;
grant execute on function public.refresh_site_order_refunds(uuid) to service_role;
grant execute on function public.record_site_refund(text,text,bigint,text,text,boolean,bigint) to service_role;

commit;
