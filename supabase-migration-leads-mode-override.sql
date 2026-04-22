-- Migration: leads_mode_override for company_websites
-- Lets admins explicitly pin a leads mode that takes priority over the
-- data-derived computation (previously the dashboard only reflected the
-- auto-derived mode from phone-number data, so the edit page's mode picker
-- had no effect on the dashboard badge).
--
-- Run in the Supabase SQL Editor.

alter table public.company_websites
  add column if not exists leads_mode_override text
    check (leads_mode_override is null or leads_mode_override in ('single', 'rotation', 'location', 'hybrid'));
