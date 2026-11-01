-- Normalize the policies after the initial Module 1 CMS rollout.
-- Keep Module 7 product writes and Module 2/7 non-Module-1 settings writes intact.

drop policy if exists "Module 1 public read suppliers" on public.suppliers;
drop policy if exists "Public read suppliers" on public.suppliers;
create policy "Public read suppliers" on public.suppliers
  for select to anon, authenticated using (true);

drop policy if exists "Module 1 public read gallery" on public.gallery;
drop policy if exists "Public read gallery" on public.gallery;
create policy "Public read gallery" on public.gallery
  for select to anon, authenticated using (true);

drop policy if exists "Module 1 public read blogs" on public.blogs;
drop policy if exists "Public read blogs" on public.blogs;
create policy "Public read blogs" on public.blogs
  for select to anon, authenticated using (true);

drop policy if exists "Module 1 public read site settings" on public.site_settings;
drop policy if exists "Public read safe site_settings only" on public.site_settings;
create policy "Public read safe site_settings only" on public.site_settings
  for select to anon, authenticated
  using (key in (
    'company_info','contact_info','hero_banner','theme_settings',
    'product_transform_settings','social_campaign_assets','instagram_published_tracker',
    'genel','anasayfa'
  ));

drop policy if exists "Legacy non-Module-1 settings writes" on public.site_settings;
drop policy if exists "Legacy non-Module-1 settings insert" on public.site_settings;
drop policy if exists "Legacy non-Module-1 settings update" on public.site_settings;
drop policy if exists "Legacy non-Module-1 settings delete" on public.site_settings;
create policy "Legacy non-Module-1 settings insert" on public.site_settings
  for insert to public with check (key not in ('genel','anasayfa'));
create policy "Legacy non-Module-1 settings update" on public.site_settings
  for update to public using (key not in ('genel','anasayfa'))
  with check (key not in ('genel','anasayfa'));
create policy "Legacy non-Module-1 settings delete" on public.site_settings
  for delete to public using (key not in ('genel','anasayfa'));

create index if not exists idx_content_revisions_author on public.content_revisions(author_id);
create index if not exists idx_content_revisions_published_by on public.content_revisions(published_by);
create index if not exists idx_publication_logs_revision on public.publication_logs(revision_id);
create index if not exists idx_publication_logs_actor on public.publication_logs(actor_id);
