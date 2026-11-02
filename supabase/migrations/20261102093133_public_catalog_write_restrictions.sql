-- Restrict public catalog writes to trusted server-side paths.
-- Public website reads remain available; Module 7 writes through its authenticated API
-- using the service_role key. Module 1 website-only flags use product_web_settings.
drop policy if exists "Public full access on products" on public.products;
drop policy if exists "Public read products" on public.products;
drop policy if exists "Module 1 public read products" on public.products;

create policy "Public read products"
  on public.products
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on table public.products from public, anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

-- Remove the legacy denylist policies. Their permissive nature allowed writes
-- to any site_settings key not explicitly listed in the blacklist.
drop policy if exists "Legacy non-Module-1 settings insert" on public.site_settings;
drop policy if exists "Legacy non-Module-1 settings update" on public.site_settings;
drop policy if exists "Legacy non-Module-1 settings delete" on public.site_settings;

-- Keep anonymous/public reads governed by the existing safe-key SELECT policy.
-- Authenticated writes remain available only where the existing role-specific
-- Module 2 policies authorize admin/content_manager for bot/campaign keys.
revoke insert, update, delete on table public.site_settings from public, anon;
grant select on table public.site_settings to anon, authenticated;
grant insert, update, delete on table public.site_settings to authenticated, service_role;
grant select, insert, update, delete on table public.site_settings to service_role;
