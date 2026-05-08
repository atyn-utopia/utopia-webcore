-- ============================================================================
-- Migration: phone_numbers.type CHECK constraint
-- ============================================================================
--
-- Webcore expects `phone_numbers.type` to be one of:
--   'default' — the resolver fallback, exactly one per website
--   'custom'  — every other entry (rotation, location-targeted, etc)
--
-- Without a DB-level CHECK, anyone inserting directly via SQL or service-role
-- can land rows with arbitrary type values (we've seen 'main' from a
-- designer pasting Claude-generated SQL). Those rows silently bypass the
-- resolver fallback and the default-row delete guard, so they look broken
-- in the admin UI without any clear error.
--
-- This migration:
--   1. Normalizes any out-of-enum rows to 'custom' (the safer default —
--      'custom' rows are visible in admin but don't claim the resolver slot)
--   2. Adds the CHECK constraint so future bad inserts fail at the DB level
--
-- Idempotent: running it twice is a no-op.
-- ============================================================================

-- Step 1. Snapshot what we're about to normalize so the operator can audit.
-- Run this SELECT first to see what will change. If any of these rows were
-- meant to be the website's default, promote them manually with
--   update phone_numbers set type = 'default' where id = '<id>';
-- BEFORE running the rest of this migration. Otherwise they'll be coerced to
-- 'custom' below and you'll have to clean it up afterwards.
--
-- select id, website, phone_number, type, label
-- from phone_numbers
-- where type not in ('default', 'custom');

-- Step 2. Coerce any non-enum rows to 'custom' so the constraint will accept.
update public.phone_numbers
set type = 'custom'
where type not in ('default', 'custom');

-- Step 3. Add the CHECK constraint. Wrapped in DO block so re-runs don't
-- error on the duplicate-constraint case.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'phone_numbers_type_check'
      and conrelid = 'public.phone_numbers'::regclass
  ) then
    alter table public.phone_numbers
      add constraint phone_numbers_type_check
      check (type in ('default', 'custom'));
  end if;
end $$;
