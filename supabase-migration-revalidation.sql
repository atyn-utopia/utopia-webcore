-- ============================================================
-- Migration: Designer-site revalidation webhooks
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Adds two columns to website_settings so webcore can fire a webhook
-- at the designer's deployed site whenever products / phone numbers /
-- blog posts change. The designer site verifies the secret and calls
-- revalidateTag(...) to flush its ISR cache.
--
-- The existing public-read RLS policy on website_settings is replaced
-- with a no-op (no anon access) because revalidate_secret must not
-- be readable from the browser. All current readers already use the
-- service-role client, which bypasses RLS.

alter table public.website_settings
  add column if not exists revalidate_url    text,
  add column if not exists revalidate_secret text;

-- Drop the broad public read policy now that the row holds a secret.
drop policy if exists "Public read website_settings" on public.website_settings;
