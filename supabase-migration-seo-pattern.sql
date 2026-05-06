-- ============================================================
-- Migration: Pattern-based SEO overrides
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Adds an `is_pattern` boolean to seo_overrides. When true, the
-- `path` value is treated as a glob pattern (single `*` wildcard
-- supported, e.g. `/aircond-service-*` matches every variant). The
-- public lookup tries an exact match first, then walks pattern rows
-- in alphabetical order and applies the first match.
--
-- Title / description templates support a {match} placeholder that
-- gets substituted with the wildcard's captured value, formatted as
-- Title Case (e.g. `shah-alam` → `Shah Alam`). Lets you set ONE row
-- like `{match} Aircond Service | Brand` and have it apply across
-- /aircond-service-kl, /aircond-service-pj, /aircond-service-shah-alam,
-- etc.
--
-- Existing rows default to is_pattern=false so they continue to behave
-- as exact matches. No data migration needed.

alter table public.seo_overrides
  add column if not exists is_pattern boolean not null default false;
