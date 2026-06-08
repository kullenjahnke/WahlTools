-- Migration 21: size + type limits on the social-media storage bucket.
-- Run this in the Supabase SQL Editor.
-- Images are also capped at 5MB by the app's server-action body limit; this
-- 50MB cap is the backstop for direct-to-storage video uploads.

update storage.buckets
set file_size_limit = 52428800,                         -- 50 MB
    allowed_mime_types = array['image/*','video/*']::text[]
where id = 'social-media';
