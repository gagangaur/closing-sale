-- =============================================================
-- Closing Sale — Storage bucket for product images
-- Run once in the Supabase SQL editor (after the migrations).
-- =============================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anyone may view product images (they are shown on the public site).
create policy "product images public read"
on storage.objects for select
using (bucket_id = 'product-images');

-- Only admins may upload/replace/delete product images.
create policy "product images admin insert"
on storage.objects for insert
with check (bucket_id = 'product-images' and is_admin());

create policy "product images admin update"
on storage.objects for update
using (bucket_id = 'product-images' and is_admin());

create policy "product images admin delete"
on storage.objects for delete
using (bucket_id = 'product-images' and is_admin());
