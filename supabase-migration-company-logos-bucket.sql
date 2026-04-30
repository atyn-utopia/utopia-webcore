-- ============================================================
-- Migration: Storage bucket for company logos
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Creates a public bucket named "company-logos" used by
-- POST /api/companies/[id]/logo to store admin-uploaded brand
-- images. Public read is required so logos can be served from
-- the public URL we save to companies.logo_url. Writes go through
-- the service-role key on the server (bypasses RLS), so no
-- insert/update policies are needed for now.

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do update set public = true;

-- Public read for objects in this bucket
drop policy if exists "Public read company-logos" on storage.objects;
create policy "Public read company-logos" on storage.objects
  for select
  using (bucket_id = 'company-logos');
