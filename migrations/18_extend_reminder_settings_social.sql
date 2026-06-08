-- Migration 18: Social digest settings on the reminder_settings singleton.
-- Run this in the Supabase SQL Editor.

alter table reminder_settings
  add column if not exists social_reminder_enabled boolean not null default true,
  add column if not exists social_recipients text[] not null
    default array['info@kullenjahnke.com','rjahnke@arkkfood.com'];
