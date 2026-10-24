-- Public product images only. No customer documents, cards or private uploads.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-photos', 'product-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_photos_admin_insert on storage.objects;
create policy product_photos_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-photos'
  and (select public.is_admin())
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('pureform-4pc-set-grey', 'pureform-4pc-set-black', 'pureform-4pc-set-pink')
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

-- No anonymous writes, object overwrite or deletion policies are granted.
-- Public-bucket downloads do not need a SELECT policy on object metadata.
commit;
