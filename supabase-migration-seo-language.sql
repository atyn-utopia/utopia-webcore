-- ============================================================
-- Migration: Per-language SEO overrides
-- Run in the Supabase SQL Editor
-- ============================================================
--
-- Adds a `language` column to seo_overrides so admins can set
-- different meta titles / descriptions per language (English and
-- Bahasa Malaysia today; could grow to more later). The unique
-- constraint becomes (website, path, language). Existing rows
-- default to 'en' so no data needs migrating.
--
-- The webcore SEO admin gets a language pill at the top right;
-- /api/public/seo accepts ?lang=ms and falls back to 'en' then to
-- nothing if neither exists.

alter table public.seo_overrides
  add column if not exists language text not null default 'en';

-- Drop the old (website, path) unique constraint and replace with
-- (website, path, language). The constraint name was auto-generated
-- by Postgres when the table was created via the original migration,
-- so we look it up dynamically.
do $$
declare
  cname text;
begin
  select conname
    into cname
    from pg_constraint
   where conrelid = 'public.seo_overrides'::regclass
     and contype = 'u'
     and conkey = (
       select array_agg(attnum order by attnum)
         from pg_attribute
        where attrelid = 'public.seo_overrides'::regclass
          and attname in ('website', 'path')
     )
   limit 1;
  if cname is not null then
    execute format('alter table public.seo_overrides drop constraint %I', cname);
  end if;
end $$;

alter table public.seo_overrides
  drop constraint if exists seo_overrides_website_path_lang_key;

alter table public.seo_overrides
  add constraint seo_overrides_website_path_lang_key
  unique (website, path, language);
