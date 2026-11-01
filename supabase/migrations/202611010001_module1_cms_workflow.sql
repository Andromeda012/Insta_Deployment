-- Module 1 CMS draft / preview / publish workflow.
-- Safe additive migration: does not alter existing public website tables or policies.
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

-- Module 7 remains the canonical product master. This table stores only
-- website-specific presentation choices owned by Module 1.
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

revoke all on public.content_revisions from anon, authenticated;
revoke all on public.publication_logs from anon, authenticated;
revoke all on public.product_web_settings from anon, authenticated;
grant all on public.content_revisions to service_role;
grant all on public.publication_logs to service_role;
grant all on public.product_web_settings to service_role;

-- Atomic publish: the public website only reads the existing live tables.
-- Drafts remain isolated until this function promotes a snapshot.
create or replace function public.publish_content_revision(
  p_revision_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_revision public.content_revisions%rowtype;
  v_before jsonb;
  v_payload jsonb;
  v_slug text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  select * into v_revision
  from public.content_revisions
  where id = p_revision_id
  for update;

  if not found then
    raise exception 'Revision not found';
  end if;
  if v_revision.status <> 'draft' then
    raise exception 'Only draft revisions can be published';
  end if;
  if p_actor_id is null then
    raise exception 'Actor is required';
  end if;

  v_payload := v_revision.payload;
  v_slug := v_revision.entity_slug;

  case v_revision.entity_type
    when 'blog' then
      select to_jsonb(t) into v_before from public.blogs t where slug = v_slug;
      insert into public.blogs (
        slug, title, kategori, tarih, kapak_resim, ozet, body,
        anasayfada_goster, created_at
      ) values (
        v_slug,
        coalesce(v_payload->>'title', v_slug),
        coalesce(v_payload->>'kategori', 'Rehber & Bakım'),
        coalesce((v_payload->>'tarih')::timestamptz, now()),
        coalesce(v_payload->>'kapak_resim', '/resim/logo.png'),
        coalesce(v_payload->>'ozet', ''),
        coalesce(v_payload->>'body', ''),
        coalesce((v_payload->>'anasayfada_goster')::boolean, true),
        now()
      )
      on conflict (slug) do update set
        title=excluded.title, kategori=excluded.kategori, tarih=excluded.tarih,
        kapak_resim=excluded.kapak_resim, ozet=excluded.ozet, body=excluded.body,
        anasayfada_goster=excluded.anasayfada_goster;
    when 'gallery' then
      select to_jsonb(t) into v_before from public.gallery t where slug = v_slug;
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
    when 'supplier' then
      select to_jsonb(t) into v_before from public.suppliers t where slug = v_slug;
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
    when 'site_setting' then
      if v_slug not in ('genel', 'anasayfa') then
        raise exception 'This site setting key is not publishable through Module 1';
      end if;
      select to_jsonb(t) into v_before from public.site_settings t where key = v_slug;
      insert into public.site_settings (key, data, updated_at)
      values (v_slug, coalesce(v_payload->'data', '{}'::jsonb), now())
      on conflict (key) do update set data=excluded.data, updated_at=now();
    when 'product_web_settings' then
      select to_jsonb(t) into v_before from public.product_web_settings t where product_slug = v_slug;
      insert into public.product_web_settings (product_slug, is_visible, is_featured, sort_order, updated_at)
      values (
        v_slug,
        coalesce((v_payload->>'is_visible')::boolean, true),
        coalesce((v_payload->>'is_featured')::boolean, false),
        coalesce((v_payload->>'sort_order')::integer, 0),
        now()
      )
      on conflict (product_slug) do update set
        is_visible=excluded.is_visible, is_featured=excluded.is_featured,
        sort_order=excluded.sort_order, updated_at=now();
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
    'published_at', now()
  );
end;
$$;

revoke all on function public.publish_content_revision(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_content_revision(uuid, uuid) to service_role;
