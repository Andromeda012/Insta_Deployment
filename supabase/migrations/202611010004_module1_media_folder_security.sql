-- Protect Module 1's media folders while keeping existing Module 2/7 upload paths working.
drop policy if exists "Public insert access on media bucket" on storage.objects;
drop policy if exists "Public update access on media bucket" on storage.objects;
drop policy if exists "Public delete access on media bucket" on storage.objects;
drop policy if exists "Legacy public media uploads outside Module 1" on storage.objects;
drop policy if exists "Legacy public media updates outside Module 1" on storage.objects;
drop policy if exists "Legacy public media deletes outside Module 1" on storage.objects;
drop policy if exists "Module 1 managers upload protected media" on storage.objects;
drop policy if exists "Module 1 managers update protected media" on storage.objects;
drop policy if exists "Module 1 managers delete protected media" on storage.objects;

create policy "Legacy public media uploads outside Module 1" on storage.objects
  for insert to public
  with check (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') not in ('urunler','anasayfa','galeri','blog','tedarikciler')
  );
create policy "Legacy public media updates outside Module 1" on storage.objects
  for update to public
  using (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') not in ('urunler','anasayfa','galeri','blog','tedarikciler')
  )
  with check (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') not in ('urunler','anasayfa','galeri','blog','tedarikciler')
  );
create policy "Legacy public media deletes outside Module 1" on storage.objects
  for delete to public
  using (
    bucket_id = 'media'
    and coalesce((storage.foldername(name))[1], '') not in ('urunler','anasayfa','galeri','blog','tedarikciler')
  );

create policy "Module 1 managers upload protected media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('urunler','anasayfa','galeri','blog','tedarikciler')
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','content_manager')
  );
create policy "Module 1 managers update protected media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('urunler','anasayfa','galeri','blog','tedarikciler')
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','content_manager')
  )
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('urunler','anasayfa','galeri','blog','tedarikciler')
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','content_manager')
  );
create policy "Module 1 managers delete protected media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('urunler','anasayfa','galeri','blog','tedarikciler')
    and (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','content_manager')
  );
