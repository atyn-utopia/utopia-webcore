-- ============================================================
-- Migration: Per-website third-party integrations (GSC, GA4, Ads, …)
-- Run this in the Supabase SQL Editor
-- ============================================================

create table if not exists public.website_integrations (
  id              uuid primary key default gen_random_uuid(),
  website         text not null,
  provider        text not null,
  refresh_token   text,
  access_token    text,
  token_expires_at timestamptz,
  property_id     text,
  meta            jsonb not null default '{}'::jsonb,
  connected_by    uuid references auth.users(id),
  connected_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (website, provider)
);

create index if not exists idx_website_integrations_website on public.website_integrations (website);
create index if not exists idx_website_integrations_provider on public.website_integrations (provider);

alter table public.website_integrations enable row level security;
-- No public policies — admin reads via service role
