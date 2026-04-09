-- ============================================================
-- SEO Admin — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 0. companies & company_websites
-- ──────────────────────────────────────────────────────────
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.company_websites (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  domain     text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_websites_company
  on public.company_websites (company_id);

alter table public.companies enable row level security;
alter table public.company_websites enable row level security;

create policy "Public read companies" on public.companies for select using (true);
create policy "Public read company_websites" on public.company_websites for select using (true);


-- ──────────────────────────────────────────────────────────
-- 1. phone_numbers
-- ──────────────────────────────────────────────────────────
create table if not exists public.phone_numbers (
  id            uuid primary key default gen_random_uuid(),
  website       text not null,
  product_slug  text not null,
  location_slug text not null,
  phone_number  text not null,
  type          text not null default 'custom',
  whatsapp_text text not null default '',
  percentage    integer not null default 100,
  label         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Index for the common query pattern (website + product + location)
create index if not exists idx_phone_numbers_lookup
  on public.phone_numbers (website, product_slug, location_slug);

-- RLS
alter table public.phone_numbers enable row level security;

-- Public: anyone can read active numbers (used by front-end websites)
create policy "Public read phone_numbers"
  on public.phone_numbers for select
  using (true);

-- Authenticated users can insert/update/delete via service role from admin app
-- (Admin app uses service role key in server API routes, bypassing RLS)
-- No additional authenticated policies needed since admin uses service role.


-- ──────────────────────────────────────────────────────────
-- 2. blog_posts
-- ──────────────────────────────────────────────────────────
create table if not exists public.blog_posts (
  id                uuid primary key default gen_random_uuid(),
  website           text not null,
  title             text not null,
  slug              text not null,
  content           text,
  excerpt           text,
  cover_image_url   text,
  meta_title        text,
  meta_description  text,
  status            text not null default 'draft',
  published_at      timestamptz,
  author_id         uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(website, slug)
);

-- Indexes
create index if not exists idx_blog_posts_website_status
  on public.blog_posts (website, status);

-- RLS
alter table public.blog_posts enable row level security;

-- Public: only published posts are readable
create policy "Public read published blog_posts"
  on public.blog_posts for select
  using (status = 'published');

-- Authenticated users (writers) can do everything — scoped by service role in admin
-- Additional policy so Supabase Auth users can also read their own drafts via anon key:
create policy "Authors can read own posts"
  on public.blog_posts for select
  to authenticated
  using (author_id = auth.uid());

create policy "Authors can insert posts"
  on public.blog_posts for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "Authors can update own posts"
  on public.blog_posts for update
  to authenticated
  using (author_id = auth.uid());

create policy "Authors can delete own posts"
  on public.blog_posts for delete
  to authenticated
  using (author_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 3. user_profiles
-- ──────────────────────────────────────────────────────────
create table if not exists public.user_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null default '',
  role       text not null default 'admin' check (role in ('admin', 'designer', 'writer')),
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select
  to authenticated
  using (id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- app_settings (key-value store for admin toggles)
-- ──────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key   text primary key,
  value text not null default ''
);
alter table public.app_settings enable row level security;
create policy "Public read app_settings" on public.app_settings for select using (true);

-- ──────────────────────────────────────────────────────────
-- tickets (help/bug reports)
-- ──────────────────────────────────────────────────────────
create table if not exists public.tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  user_name   text not null default '',
  user_role   text not null default '',
  subject     text not null,
  description text not null default '',
  status      text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at  timestamptz not null default now()
);
alter table public.tickets enable row level security;
create policy "Users can read own tickets" on public.tickets for select to authenticated using (user_id = auth.uid());


-- ──────────────────────────────────────────────────────────
-- 4. writer_permissions
-- ──────────────────────────────────────────────────────────
create table if not exists public.writer_permissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id),
  website    text not null,
  created_at timestamptz not null default now(),
  unique(user_id, website)
);

-- RLS: only service role can access (no public or authenticated policies)
alter table public.writer_permissions enable row level security;

-- No public policies — service role bypasses RLS


-- ──────────────────────────────────────────────────────────
-- 4. updated_at trigger for blog_posts
-- ──────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_blog_posts_updated_at on public.blog_posts;
create trigger trg_blog_posts_updated_at
  before update on public.blog_posts
  for each row execute function public.set_updated_at();
