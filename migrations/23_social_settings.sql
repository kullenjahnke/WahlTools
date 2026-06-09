-- Singleton settings row for the Social Calendar (Phase 3 shared groundwork).
-- Mirrors reminder_settings (id=1 singleton). Created in full now so later
-- Phase 3 features (B collaborators, C analytics, E asset cleanup) don't
-- re-migrate; Feature A only wires brand_voice + caption_model.

create table if not exists social_settings (
  id smallint primary key default 1,
  -- Feature A (AI captions):
  brand_voice text,                                  -- editable brand-voice/style guidance
  caption_model text not null default 'claude-haiku',-- model label resolved to an id in config
  -- Feature E (asset cleanup) — created now, unused until E:
  asset_retention_days int not null default 30,      -- 0 = never delete
  -- Feature C (analytics) — created now, unused until C:
  analytics_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint social_settings_singleton check (id = 1)
);

insert into social_settings (id) values (1) on conflict (id) do nothing;

alter table social_settings enable row level security;

drop policy if exists "social_settings_authenticated_all" on social_settings;
create policy "social_settings_authenticated_all"
  on social_settings for all
  to authenticated
  using (true)
  with check (true);
