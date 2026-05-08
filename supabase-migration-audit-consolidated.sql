-- ============================================================================
-- Consolidated audit_logs migration. Idempotent — safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
--
-- Combines three earlier files:
--   supabase-migration-audit.sql                       (creates table + RLS)
--   supabase-migration-audit-entity-types.sql          (adds product, website)
--   supabase-migration-audit-entity-types-api-key.sql  (adds api_key)
--
-- Why this matters: lib/auditLog.ts wraps every write in try/catch and
-- swallows errors so a missing table or stale CHECK never blocks user
-- actions. The /audit page just looks empty when writes are failing
-- silently. Running this once gets the trail recording again.
-- ============================================================================

-- Table
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  user_name    text not null default '',
  user_role    text not null default '',
  entity_type  text not null,
  entity_id    uuid,
  action       text not null check (action in ('create', 'update', 'delete')),
  website      text,
  label        text,
  changes      jsonb,
  metadata     jsonb,
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_entity     on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_user       on public.audit_logs (user_id);
create index if not exists idx_audit_logs_website    on public.audit_logs (website);

-- Entity-type CHECK. Drop the older variants (if present) then re-add
-- with the full set the current app uses.
alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check
  check (entity_type in ('phone_number', 'blog_post', 'product', 'website', 'api_key'));

-- RLS. Admin reads via service role in API routes, so no authenticated
-- read policy is needed. Just ensure RLS is on so anon can't read.
alter table public.audit_logs enable row level security;

-- Verify the migration landed
select
  (select count(*) from pg_tables where tablename = 'audit_logs' and schemaname = 'public') as table_exists,
  pg_get_constraintdef(c.oid) as entity_type_constraint
from pg_constraint c
join pg_class t on t.oid = c.conrelid
where t.relname = 'audit_logs' and c.conname = 'audit_logs_entity_type_check';
