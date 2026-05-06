-- ============================================================
-- Migration: Image alt-text overrides
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Per-(website, image_src) alt text overrides. The webcore SEO
-- audit lets admins fill in missing alt text from the dashboard;
-- the public tracker /t.js fetches all overrides for the site on
-- page load and applies them to matching <img> elements at runtime.

create table if not exists public.alt_overrides (
  id           uuid primary key default gen_random_uuid(),
  website      text not null,
  image_src    text not null,
  alt          text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (website, image_src)
);

create index if not exists idx_alt_overrides_website on public.alt_overrides (website);

alter table public.alt_overrides enable row level security;
-- No public policies — server reads via service role.
