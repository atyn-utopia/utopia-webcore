-- ============================================================
-- Migration: Page events for website analytics
-- Run via: npx supabase db query --linked < supabase-migration-analytics.sql
-- ============================================================

create table if not exists public.page_events (
  id          uuid primary key default gen_random_uuid(),
  website     text not null,
  event_type  text not null default 'pageview'
    check (event_type in ('pageview', 'click', 'impression')),
  path        text not null default '/',
  referrer    text,
  label       text,
  device      text,
  browser     text,
  country     text,
  ip_hash     text,
  session_id  text,
  created_at  timestamptz not null default now()
);

-- Partition-friendly indexes for time-based queries
create index if not exists idx_page_events_website_time on public.page_events (website, created_at desc);
create index if not exists idx_page_events_type_time on public.page_events (event_type, created_at desc);
create index if not exists idx_page_events_created on public.page_events (created_at desc);

alter table public.page_events enable row level security;
-- No public read — admin reads via service role
