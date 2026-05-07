-- ============================================================
-- Migration: Per-site supported languages
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Adds a `languages` text[] column to seo_site_profile so each site
-- can declare which languages it actually publishes content in. Powers
-- the EN | BM (or just EN, or future expansions) toggle on the SEO
-- checklist — sites that only do English don't get a BM toggle at all.
--
-- Defaults to ['en'] so existing rows behave unchanged. Admin can flip
-- on additional languages from the brand-profile edit modal.

alter table public.seo_site_profile
  add column if not exists languages text[] not null default array['en']::text[];
