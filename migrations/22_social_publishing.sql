-- Migration 22: support live publishing.
-- Run this in the Supabase SQL Editor.
-- No new columns (reuses status/posted_at/failure_reason/external_ref, and the
-- existing social-media bucket for published/ derivatives). This adds a partial
-- index that speeds the daily reconcile query (scheduled posts past their time).

create index if not exists social_posts_scheduled_pending_idx
  on social_posts (scheduled_at)
  where status = 'scheduled';
