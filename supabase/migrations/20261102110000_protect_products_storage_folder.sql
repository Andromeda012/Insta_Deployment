-- Keep public reads, but prevent anonymous uploads, overwrites, or deletes in the
-- products/ folder. Module 7 and the root image engines write through service_role.
-- Other folders and all Module 2 policies remain unchanged.
drop policy if exists "Legacy public media uploads outside protected modules" on storage.objects;
create policy "Legacy public media uploads outside protected modules"
  on storage.objects
  for insert
  to public
  with check (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') <> all (
      array[
        'urunler', 'anasayfa', 'galeri', 'blog', 'tedarikciler',
        'instagram', 'facebook', 'tiktok', 'youtube', 'posts', 'stories',
        'products'
      ]::text[]
    )
  );

drop policy if exists "Legacy public media updates outside protected modules" on storage.objects;
create policy "Legacy public media updates outside protected modules"
  on storage.objects
  for update
  to public
  using (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') <> all (
      array[
        'urunler', 'anasayfa', 'galeri', 'blog', 'tedarikciler',
        'instagram', 'facebook', 'tiktok', 'youtube', 'posts', 'stories',
        'products'
      ]::text[]
    )
  )
  with check (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') <> all (
      array[
        'urunler', 'anasayfa', 'galeri', 'blog', 'tedarikciler',
        'instagram', 'facebook', 'tiktok', 'youtube', 'posts', 'stories',
        'products'
      ]::text[]
    )
  );

drop policy if exists "Legacy public media deletes outside protected modules" on storage.objects;
create policy "Legacy public media deletes outside protected modules"
  on storage.objects
  for delete
  to public
  using (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') <> all (
      array[
        'urunler', 'anasayfa', 'galeri', 'blog', 'tedarikciler',
        'instagram', 'facebook', 'tiktok', 'youtube', 'posts', 'stories',
        'products'
      ]::text[]
    )
  );
