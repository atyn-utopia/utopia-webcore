-- Migration: Widen audit_logs.entity_type check to match the current app
-- The app writes 'product' and 'website' in addition to the original two.

alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check
  check (entity_type in ('phone_number', 'blog_post', 'product', 'website'));
