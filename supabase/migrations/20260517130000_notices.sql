-- 공지사항 (마이탭 · 어드민 운영)
create table if not exists public.notices (
  slug text primary key,
  category text not null check (category in ('event', 'update', 'notice')),
  title text not null,
  published_on date not null,
  body text not null,
  is_published boolean not null default true,
  show_new_dot boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notices_published_sort_idx
  on public.notices (is_published, sort_order desc, published_on desc);

alter table public.notices enable row level security;

drop policy if exists "public read published notices" on public.notices;
create policy "public read published notices" on public.notices
  for select
  using (is_published = true);

comment on table public.notices is '연운 공지사항 — 마이탭 목록/상세, 어드민 CRUD';
