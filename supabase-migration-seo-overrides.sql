-- ============================================================
-- Migration: Per-page SEO overrides
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Backs the per-site SEO settings page. One row per (website, path)
-- holds the meta title / description / og:image override for that URL
-- on the designer site. Designer sites read via /api/public/seo and
-- call window.webcoreSeo() (or the lib/webcoreSeo.ts generateMetadata
-- helper) to apply the override at request time.

create table if not exists public.seo_overrides (
  id           uuid primary key default gen_random_uuid(),
  website      text not null,
  path         text not null default '/',
  title        text,
  description  text,
  og_image     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (website, path)
);

create index if not exists idx_seo_overrides_website on public.seo_overrides (website);

alter table public.seo_overrides enable row level security;
-- No public policies — server reads via service role.
