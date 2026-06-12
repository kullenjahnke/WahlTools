-- A3 (Reel thumbnail): add reel cover columns to social_posts and teach
-- save_social_post to persist them. The active cover is either an auto-captured
-- first frame (is_custom=false) or a user-uploaded image (is_custom=true).
-- Non-destructive. Run manually in the Supabase SQL editor.

alter table social_posts
  add column if not exists reel_cover_path text,
  add column if not exists reel_cover_url text,
  add column if not exists reel_cover_is_custom boolean not null default false;

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
    insert into social_posts (title, caption, format, status, scheduled_at, posted_at, platforms, notes, aspect_ratio, collaborators, reel_cover_path, reel_cover_url, reel_cover_is_custom)
    values (
      nullif(p_post->>'title',''),
      nullif(p_post->>'caption',''),
      coalesce(p_post->>'format','image'),
      v_status,
      nullif(p_post->>'scheduled_at','')::timestamptz,
      case when v_status = 'posted' then now() else nullif(p_post->>'posted_at','')::timestamptz end,
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'platforms')),
        array['instagram','facebook']::text[]
      ),
      nullif(p_post->>'notes',''),
      coalesce(p_post->>'aspect_ratio','auto'),
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]
      ),
      nullif(p_post->>'reel_cover_path',''),
      nullif(p_post->>'reel_cover_url',''),
      coalesce((p_post->>'reel_cover_is_custom')::boolean, false)
    )
    returning id into v_id;
  else
    v_id := (p_post->>'id')::uuid;
    update social_posts set
      title = nullif(p_post->>'title',''),
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
      aspect_ratio = coalesce(p_post->>'aspect_ratio','auto'),
      -- Intentional: an explicit empty array clears collaborators (zero is a
      -- valid state, unlike platforms). The action always sends this key.
      collaborators = coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(p_post->'collaborators')),
        '{}'::text[]),
      reel_cover_path = nullif(p_post->>'reel_cover_path',''),
      reel_cover_url = nullif(p_post->>'reel_cover_url',''),
      reel_cover_is_custom = coalesce((p_post->>'reel_cover_is_custom')::boolean, false),
      updated_at = now()
    where id = v_id;
  end if;

  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    if exists (
      select 1 from unnest(p_retailers) r
      where r not in ('Jewel-Osco','Stop & Shop','Acme','Shaws','Giant Eagle',
                      'Giant Food Stores','Big Y','Publix','Safeway')
    ) then
      raise exception 'Invalid retailer in %', p_retailers;
    end if;
  end if;

  delete from social_post_products where post_id = v_id;
  if p_product_ids is not null and array_length(p_product_ids, 1) is not null then
    insert into social_post_products (post_id, product_id)
    select v_id, pid from unnest(p_product_ids) pid
    on conflict do nothing;
  end if;

  delete from social_post_retailers where post_id = v_id;
  if p_retailers is not null and array_length(p_retailers, 1) is not null then
    insert into social_post_retailers (post_id, retailer)
    select v_id, r from unnest(p_retailers) r
    on conflict do nothing;
  end if;

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
