-- Singleton settings row driving the weekly price-check reminder, the
-- per-retailer follow-up, and the weekly N/A (unavailable) digest.
-- The cron handler runs hourly and reads these to decide what to send.

create table if not exists reminder_settings (
  id smallint primary key default 1,
  -- Weekly reminder: day-of-week (0=Sunday .. 6=Saturday) + hour (0-23), America/Detroit.
  weekly_day smallint not null default 3,            -- Wednesday
  weekly_hour smallint not null default 9,           -- 9 AM
  recipients text[] not null default array['info@kullenjahnke.com', 'rjahnke@arkkfood.com'],
  -- Follow-up: fires N days after the weekly reminder for retailers with no
  -- price update in more than `stale_threshold_days`.
  followup_enabled boolean not null default true,
  followup_days_after smallint not null default 2,
  stale_threshold_days smallint not null default 11, -- ~1.5 weeks
  -- Weekly N/A digest: products newly marked N/A in the past week.
  na_digest_enabled boolean not null default true,
  na_recipients text[] not null default array['rjahnke@arkkfood.com'],
  updated_at timestamptz not null default now(),
  constraint reminder_settings_singleton check (id = 1)
);

insert into reminder_settings (id) values (1) on conflict (id) do nothing;

alter table reminder_settings enable row level security;

drop policy if exists "reminder_settings_authenticated_all" on reminder_settings;
create policy "reminder_settings_authenticated_all"
  on reminder_settings for all
  to authenticated
  using (true)
  with check (true);
