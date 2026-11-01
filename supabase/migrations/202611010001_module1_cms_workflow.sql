-- Module 1 CMS: drafts, atomic publishing and public-data write hardening.
-- Existing live content remains readable by the public website. Anonymous writes are removed.

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('blog','gallery','supplier','site_setting','product_web_settings')),
  entity_slug text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  revision_number integer not null check (revision_number > 0),
  author_id uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (entity_type, entity_slug, revision_number)
);

create index if not exists idx_content_revisions_entity_latest
  on public.content_revisions(entity_type, entity_slug, revision_number desc);
create index if not exists idx_content_revisions_status_created
  on public.content_revisions(status, created_at desc);

create table if not exists public.publication_logs (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.content_revisions(id),
  entity_type text not null,
  entity_slug text not null,
  action text not null check (action in ('published','rolled_back')),
  actor_id uuid not null references auth.users(id),
  before_payload jsonb,
  after_payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_publication_logs_entity_created
  on public.publication_logs(entity_type, entity_slug, created_at desc);

-- Module 7 owns the product master; Module 1 owns only website presentation flags.
create table if not exists public.product_web_settings (
  product_slug text primary key references public.products(slug) on update cascade on delete cascade,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.content_revisions enable row level security;
alter table public.publication_logs enable row level security;
alter table public.product_web_settings enable row level security;

revoke all on public.content_revisions, public.publication_logs, public.product_web_settings from public, anon, authenticated;
grant all on public.content_revisions, public.publication_logs, public.product_web_settings to service_role;
grant select on public.product_web_settings to anon, authenticated;

-- Preserve Module 7's existing product-master workflow. Module 1 writes only
-- product_web_settings through the service-role CMS API.
-- Module 2 and Module 7 still use site_settings for their own non-website keys.
drop policy if exists "Public full access on suppliers" on public.suppliers;
drop policy if exists "Public full access on gallery" on public.gallery;
drop policy if exists "Public full access on blogs" on public.blogs;
drop policy if exists "Public full access on site_settings" on public.site_settings;

revoke insert, update, delete, truncate, references, trigger on public.suppliers from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.gallery from public, anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.blogs from public, anon, authenticated;
grant select on public.suppliers, public.gallery, public.blogs, public.products, public.site_settings to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.site_settings from public, anon, authenticated;
grant insert, update, delete on public.site_settings to public;

drop policy if exists "Module 1 public read suppliers" on public.suppliers;
create policy "Module 1 public read suppliers" on public.suppliers for select to anon, authenticated using (true);
drop policy if exists "Module 1 public read gallery" on public.gallery;
create policy "Module 1 public read gallery" on public.gallery for select to anon, authenticated using (true);
drop policy if exists "Module 1 public read blogs" on public.blogs;
create policy "Module 1 public read blogs" on public.blogs for select to anon, authenticated using (true);
drop policy if exists "Module 1 public read site settings" on public.site_settings;
create policy "Module 1 public read site settings" on public.site_settings for select to anon, authenticated using (true);

-- Preserve legacy Module 2/7 settings writes, but protect Module 1's live keys.
drop policy if exists "Legacy non-Module-1 settings writes" on public.site_settings;
create policy "Legacy non-Module-1 settings writes" on public.site_settings
  for all to public
  using (key not in ('genel','anasayfa'))
  with check (key not in ('genel','anasayfa'));

drop policy if exists "Module 1 public read product web settings" on public.product_web_settings;
create policy "Module 1 public read product web settings" on public.product_web_settings for select to anon, authenticated using (true);

-- The media bucket is shared by Modules 2 and 7. Its existing storage policies
-- are intentionally left untouched here to avoid breaking their upload flows.
create or replace function public.save_content_draft(
  p_entity_type text,
  p_entity_slug text,
  p_payload jsonb,
  p_author_id uuid
) returns public.content_revisions
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_revision public.content_revisions%rowtype;
  v_number integer;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_entity_type not in ('blog','gallery','supplier','site_setting','product_web_settings')
     or p_entity_slug is null or length(trim(p_entity_slug)) = 0 or length(p_entity_slug) > 180
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_author_id is null then
    raise exception 'Invalid draft data';
  end if;
  if p_entity_type = 'site_setting' and p_entity_slug not in ('genel','anasayfa') then
    raise exception 'Unsupported site setting key';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_entity_type || ':' || p_entity_slug, 0));
  select coalesce(max(revision_number), 0) + 1 into v_number
    from public.content_revisions
    where entity_type = p_entity_type and entity_slug = p_entity_slug;

  insert into public.content_revisions(entity_type, entity_slug, payload, revision_number, author_id)
  values (p_entity_type, p_entity_slug, p_payload, v_number, p_author_id)
  returning * into v_revision;
  return v_revision;
end;
$$;

create or replace function public.publish_content_revision(
  p_revision_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_revision public.content_revisions%rowtype;
  v_before jsonb;
  v_payload jsonb;
  v_slug text;
  v_deleted boolean;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select * into v_revision
  from public.content_revisions
  where id = p_revision_id
  for update;

  if not found then raise exception 'Revision not found'; end if;
  if v_revision.status <> 'draft' then raise exception 'Only draft revisions can be published'; end if;
  if p_actor_id is null then raise exception 'Actor is required'; end if;

  v_payload := v_revision.payload;
  v_slug := v_revision.entity_slug;
  v_deleted := coalesce((v_payload->>'_delete')::boolean, false);

  case v_revision.entity_type
    when 'blog' then
      select to_jsonb(t) into v_before from public.blogs t where slug = v_slug;
      if v_deleted then
        delete from public.blogs where slug = v_slug;
      else
        insert into public.blogs (slug, title, kategori, tarih, kapak_resim, ozet, body, anasayfada_goster, created_at)
        values (
          v_slug, coalesce(v_payload->>'title', v_slug),
          coalesce(v_payload->>'kategori', 'Rehber & Bakım'),
          coalesce((v_payload->>'tarih')::timestamptz, now()),
          coalesce(v_payload->>'kapak_resim', '/resim/logo.png'),
          coalesce(v_payload->>'ozet', ''), coalesce(v_payload->>'body', ''),
          coalesce((v_payload->>'anasayfada_goster')::boolean, true), now()
        )
        on conflict (slug) do update set
          title=excluded.title, kategori=excluded.kategori, tarih=excluded.tarih,
          kapak_resim=excluded.kapak_resim, ozet=excluded.ozet,
          body=excluded.body, anasayfada_goster=excluded.anasayfada_goster;
      end if;
    when 'gallery' then
      select to_jsonb(t) into v_before from public.gallery t where slug = v_slug;
      if v_deleted then
        delete from public.gallery where slug = v_slug;
      else
        insert into public.gallery (slug, baslik, kategori, resim, anasayfada_goster, siralama, created_at)
        values (
          v_slug, coalesce(v_payload->>'baslik', v_slug),
          coalesce(v_payload->>'kategori', 'Mutfak'),
          coalesce(v_payload->>'resim', '/resim/logo.png'),
          coalesce((v_payload->>'anasayfada_goster')::boolean, true),
          coalesce((v_payload->>'siralama')::bigint, 0), now()
        )
        on conflict (slug) do update set
          baslik=excluded.baslik, kategori=excluded.kategori, resim=excluded.resim,
          anasayfada_goster=excluded.anasayfada_goster, siralama=excluded.siralama;
      end if;
    when 'supplier' then
      select to_jsonb(t) into v_before from public.suppliers t where slug = v_slug;
      if v_deleted then
        delete from public.suppliers where slug = v_slug;
      else
        insert into public.suppliers (slug, ad, kategori, aciklama, link, logo, siralama, created_at)
        values (
          v_slug, coalesce(v_payload->>'ad', v_slug),
          coalesce(v_payload->>'kategori', 'Membran & Folyo'),
          coalesce(v_payload->>'aciklama', ''), nullif(v_payload->>'link',''),
          coalesce(v_payload->>'logo', '/resim/logo.png'),
          coalesce((v_payload->>'siralama')::integer, 0), now()
        )
        on conflict (slug) do update set
          ad=excluded.ad, kategori=excluded.kategori, aciklama=excluded.aciklama,
          link=excluded.link, logo=excluded.logo, siralama=excluded.siralama;
      end if;
    when 'site_setting' then
      if v_slug not in ('genel', 'anasayfa') then raise exception 'Unsupported site setting key'; end if;
      select to_jsonb(t) into v_before from public.site_settings t where key = v_slug;
      if v_deleted then
        raise exception 'Site settings cannot be deleted through Module 1';
      else
        insert into public.site_settings (key, data, updated_at)
        values (v_slug, coalesce(v_payload->'data', '{}'::jsonb), now())
        on conflict (key) do update set data=excluded.data, updated_at=now();
      end if;
    when 'product_web_settings' then
      select to_jsonb(t) into v_before from public.product_web_settings t where product_slug = v_slug;
      if v_deleted then
        delete from public.product_web_settings where product_slug = v_slug;
      else
        insert into public.product_web_settings (product_slug, is_visible, is_featured, sort_order, updated_at)
        values (
          v_slug,
          coalesce((v_payload->>'is_visible')::boolean, true),
          coalesce((v_payload->>'is_featured')::boolean, false),
          coalesce((v_payload->>'sort_order')::integer, 0), now()
        )
        on conflict (product_slug) do update set
          is_visible=excluded.is_visible, is_featured=excluded.is_featured,
          sort_order=excluded.sort_order, updated_at=now();
      end if;
  end case;

  update public.content_revisions
    set status='published', published_by=p_actor_id, published_at=now(), updated_at=now()
    where id=p_revision_id;

  insert into public.publication_logs (
    revision_id, entity_type, entity_slug, action, actor_id, before_payload, after_payload
  ) values (
    p_revision_id, v_revision.entity_type, v_slug, 'published',
    p_actor_id, v_before, v_payload
  );

  return jsonb_build_object(
    'ok', true, 'revision_id', p_revision_id,
    'entity_type', v_revision.entity_type, 'entity_slug', v_slug,
    'deleted', v_deleted, 'published_at', now()
  );
end;
$$;

revoke all on function public.save_content_draft(text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_content_draft(text, text, jsonb, uuid) to service_role;
revoke all on function public.publish_content_revision(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_content_revision(uuid, uuid) to service_role;
