insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
 ('shop-assets','shop-assets',true,2097152,array['image/jpeg','image/png','image/webp']),
 ('seller-verification','seller-verification',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy shop_assets_public_read on storage.objects for select to anon,authenticated using (bucket_id = 'shop-assets');
create policy shop_assets_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy shop_assets_owner_update on storage.objects for update to authenticated using (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy shop_assets_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'shop-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy seller_verification_owner_admin_read on storage.objects for select to authenticated using (bucket_id = 'seller-verification' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.has_role('admin'))));
create policy seller_verification_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy seller_verification_owner_update on storage.objects for update to authenticated using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy seller_verification_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'seller-verification' and (storage.foldername(name))[1] = (select auth.uid())::text);
