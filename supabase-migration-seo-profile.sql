-- ============================================================
-- Migration: SEO site profile (brand / location / keywords)
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- One row per website. Powers the "Business or Brand Name |
-- Location | Keywords" info bar at the top of the SEO setup
-- checklist, and feeds the AI title-suggestion endpoint with
-- domain-specific context so suggestions include the right
-- keywords and locale.

create table if not exists public.seo_site_profile (
  website     text primary key,
  brand_name  text not null default '',
  location    text not null default '',
  keywords    text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.seo_site_profile enable row level security;
-- No public policies — server reads/writes via service role.
