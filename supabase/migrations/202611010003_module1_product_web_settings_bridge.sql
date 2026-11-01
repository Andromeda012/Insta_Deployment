-- Bridge the Module 1 website settings to the existing public products table.
-- Module 7 remains the owner of product master data.
alter table public.products
  add column if not exists web_gorunur boolean not null default true;
alter table public.products
  add column if not exists web_siralama integer not null default 0;

create or replace function public.sync_product_web_settings_to_products()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  update public.products
  set web_gorunur = new.is_visible,
      anasayfada_goster = new.is_featured,
      web_siralama = new.sort_order,
      updated_at = now()
  where slug = new.product_slug;
  return new;
end;
$$;

drop trigger if exists trg_sync_product_web_settings_to_products on public.product_web_settings;
create trigger trg_sync_product_web_settings_to_products
after insert or update on public.product_web_settings
for each row execute function public.sync_product_web_settings_to_products();

-- Backfill the derived website flags from any existing CMS settings.
update public.products p
set web_gorunur = s.is_visible,
    anasayfada_goster = s.is_featured,
    web_siralama = s.sort_order,
    updated_at = now()
from public.product_web_settings s
where s.product_slug = p.slug;
