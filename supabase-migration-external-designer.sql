-- Migration: Add 'external_designer' role
-- Allows per-company scoped designers (external teams managing only their own company's data)

alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('admin', 'designer', 'external_designer', 'writer', 'indoor_sales', 'manager'));
