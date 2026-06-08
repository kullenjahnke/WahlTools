-- Migration 16: Social Media Calendar (v1)
-- Tables for planning social posts + atomic save RPC. No publishing.
-- Run this in the Supabase SQL Editor.

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  caption text,
  format text not null default 'image'
    check (format in ('image','carousel','reel','story')),
  status text not null default 'idea'
    check (status in ('idea','draft','scheduled','posted','failed')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  platforms text[] not null default array['instagram','facebook']::text[]
    check (platforms <@ array['instagram','facebook']::text[]),
  notes text,
  external_ref jsonb,      -- Phase 2: vendor post ids (vendor-agnostic)
  failure_reason text,     -- Phase 2: publish failure detail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_scheduled_at_idx on social_posts (scheduled_at);
create index if not exists social_posts_status_idx on social_posts (status);

create table if not exists social_post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  url text not null,
  storage_path text not null,
  media_type text not null default 'image' check (media_type in ('image','video')),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists social_post_media_post_idx on social_post_media (post_id, position);

create table if not exists social_post_products (
  post_id uuid not null references social_posts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (post_id, product_id)
);

create table if not exists social_post_retailers (
  post_id uuid not null references social_posts(id) on delete cascade,
  retailer text not null,
  primary key (post_id, retailer)
);

-- RLS: authenticated users have full access (matches the rest of the app).
alter table social_posts enable row level security;
alter table social_post_media enable row level security;
alter table social_post_products enable row level security;
alter table social_post_retailers enable row level security;

drop policy if exists "social_posts_authenticated_all" on social_posts;
create policy "social_posts_authenticated_all" on social_posts
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_media_authenticated_all" on social_post_media;
create policy "social_post_media_authenticated_all" on social_post_media
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_products_authenticated_all" on social_post_products;
create policy "social_post_products_authenticated_all" on social_post_products
  for all to authenticated using (true) with check (true);
drop policy if exists "social_post_retailers_authenticated_all" on social_post_retailers;
create policy "social_post_retailers_authenticated_all" on social_post_retailers
  for all to authenticated using (true) with check (true);

-- Atomic upsert: writes the post + replaces its product tags, retailer tags,
-- and media rows in one transaction. Media files must be uploaded to Storage
-- BEFORE calling this; p_media carries their { url, storage_path, media_type,
-- position }. Returns the post id.
create or replace function save_social_post(
  p_post jsonb,
  p_product_ids uuid[],
  p_retailers text[],
  p_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
begin
  v_status := coalesce(p_post->>'status', 'idea');

  if (p_post->>'id') is null then
    insert into social_posts (caption, format, status, scheduled_at, posted_at, platforms, notes)
    values (
      nullif(p_post->>'caption',''),
      coalesce(p_post->>'format','image'),
      v_status,
      nullif(p_post->>'scheduled_at','')::timestamptz,
      case when v_status = 'posted' then now() else nullif(p_post->>'posted_at','')::timestamptz end,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        array['instagram','facebook']::text[]
      ),
      nullif(p_post->>'notes','')
    )
    returning id into v_id;
  else
    v_id := (p_post->>'id')::uuid;
    update social_posts set
      caption = nullif(p_post->>'caption',''),
      format = coalesce(p_post->>'format','image'),
      status = v_status,
      scheduled_at = nullif(p_post->>'scheduled_at','')::timestamptz,
      posted_at = case
        when v_status = 'posted' and posted_at is null then now()
        when v_status <> 'posted' then null
        else posted_at end,
      platforms = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        platforms),
      notes = nullif(p_post->>'notes',''),
      updated_at = now()
    where id = v_id;
  end if;

  -- Validate retailers against the known set (defense in depth; app also validates).
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    if exists (
      select 1 from unnest(p_retailers) r
      where r not in ('Jewel-Osco','Stop & Shop','Acme','Shaws','Giant Eagle',
                      'Giant Food Stores','Big Y','Publix','Safeway')
    ) then
      raise exception 'Invalid retailer in %', p_retailers;
    end if;
  end if;

  -- Replace product tags.
  delete from social_post_products where post_id = v_id;
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into social_post_products (post_id, product_id)
    select v_id, pid from unnest(p_product_ids) pid
    on conflict do nothing;
  end if;

  -- Replace retailer tags.
  delete from social_post_retailers where post_id = v_id;
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    insert into social_post_retailers (post_id, retailer)
    select v_id, r from unnest(p_retailers) r
    on conflict do nothing;
  end if;

  -- Replace media rows.
  delete from social_post_media where post_id = v_id;
  if p_media is not null and jsonb_array_length(p_media) > 0 then
    insert into social_post_media (post_id, url, storage_path, media_type, position)
    select
      v_id,
      elem->>'url',
      elem->>'storage_path',
      coalesce(elem->>'media_type','image'),
      coalesce((elem->>'position')::int, 0)
    from jsonb_array_elements(p_media) elem;
  end if;

  return v_id;
end;
$$;
