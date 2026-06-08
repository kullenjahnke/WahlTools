-- Migration 17: Storage bucket for social post media.
-- Run this in the Supabase SQL Editor. (next.config.ts already allow-lists
-- the project's /storage/v1/object/public/** path, so no config change.)

insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do nothing;

-- Public read; authenticated write/update/delete.
drop policy if exists "social_media_public_read" on storage.objects;
create policy "social_media_public_read" on storage.objects
  for select using (bucket_id = 'social-media');

drop policy if exists "social_media_auth_insert" on storage.objects;
create policy "social_media_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'social-media');

drop policy if exists "social_media_auth_update" on storage.objects;
create policy "social_media_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'social-media');

drop policy if exists "social_media_auth_delete" on storage.objects;
create policy "social_media_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'social-media');
