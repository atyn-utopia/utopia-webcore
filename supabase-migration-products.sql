-- ============================================================
-- Migration: Product/Service management
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Website settings (offering type: products or services)
create table if not exists public.website_settings (
  id            uuid primary key default gen_random_uuid(),
  website       text not null unique,
  offering_type text not null default 'products'
    check (offering_type in ('products', 'services')),
  created_at    timestamptz not null default now()
);

alter table public.website_settings enable row level security;
create policy "Public read website_settings" on public.website_settings for select using (true);

-- 2. Products (also used for services — label only differs)
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  website       text not null,
  parent_id     uuid references public.products(id) on delete cascade,
  name          text not null,
  slug          text not null,
  description   text,
  sale_price    numeric(12,2),
  rental_price  numeric(12,2),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(website, slug)
);

create index if not exists idx_products_website on public.products (website);
create index if not exists idx_products_parent on public.products (parent_id);

alter table public.products enable row level security;
create policy "Public read active products" on public.products for select using (is_active = true);

-- Reuse the existing set_updated_at() trigger
drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- 3. Product photos
create table if not exists public.product_photos (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  url         text not null,
  alt_text    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_product_photos_product on public.product_photos (product_id);

alter table public.product_photos enable row level security;
create policy "Public read product_photos" on public.product_photos for select using (true);

-- 4. Update audit_logs entity_type check to include 'product'
alter table public.audit_logs drop constraint if exists audit_logs_entity_type_check;
alter table public.audit_logs add constraint audit_logs_entity_type_check
  check (entity_type in ('phone_number', 'blog_post', 'product'));
