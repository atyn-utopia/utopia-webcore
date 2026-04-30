-- ============================================================
-- Migration: Companies — logo URL
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Adds a logo_url text column to companies so admins can set a brand
-- image displayed on folder cards (home dashboard) and the company
-- detail page header. URL is admin-pasted; storage of the image itself
-- is out of scope (use any CDN / Supabase Storage public URL).

alter table public.companies
  add column if not exists logo_url text;
