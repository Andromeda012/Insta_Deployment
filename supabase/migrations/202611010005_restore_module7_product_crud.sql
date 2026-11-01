-- Restore Module 7's existing direct product CRUD permissions.
-- Module 1 now writes website-only flags through product_web_settings.
grant select, insert, update, delete on public.products to public;
drop policy if exists "Public read products" on public.products;
drop policy if exists "Module 1 public read products" on public.products;
drop policy if exists "Public full access on products" on public.products;
create policy "Public full access on products" on public.products
  for all to public using (true) with check (true);
