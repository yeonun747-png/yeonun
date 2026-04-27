-- 연운(Yeonun) 최소 스키마 초안
-- Supabase SQL Editor에서 실행

create table if not exists public.characters (
  key text primary key,
  name text not null,
  han text not null,
  en text not null,
  spec text not null,
  greeting text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  slug text primary key,
  label text not null,
  sort_order int not null default 0
);

create table if not exists public.products (
  slug text primary key,
  title text not null,
  quote text not null,
  category_slug text not null references public.categories(slug) on delete restrict,
  badge text null,
  price_krw int not null,
  character_key text not null references public.characters(key) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_slug text not null references public.products(slug) on delete cascade,
  user_mask text not null,
  stars numeric(2,1) not null default 5.0,
  body text not null,
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_char_updated_at on public.characters;
create trigger trg_char_updated_at
before update on public.characters
for each row execute function public.set_updated_at();

drop trigger if exists trg_product_updated_at on public.products;
create trigger trg_product_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- RLS(초기: 공개 읽기, 어드민은 service role로 CRUD)
alter table public.characters enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.reviews enable row level security;

drop policy if exists "public read characters" on public.characters;
create policy "public read characters" on public.characters
for select using (true);

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories
for select using (true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
for select using (true);

drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
for select using (true);

