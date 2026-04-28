-- Migration: Add 'api_key' to audit_logs.entity_type check.
-- Coxy can revoke API keys; we want those entries to live under their own
-- entity_type so they're filterable in /audit instead of being filed as 'website'.

alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check
  check (entity_type in ('phone_number', 'blog_post', 'product', 'website', 'api_key'));
