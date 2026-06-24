-- 사이트 페이지 방문 이벤트 (어드민 방문자 수 집계)
create table if not exists public.site_visit_events (
  id uuid primary key default gen_random_uuid(),
  visitor_ref text not null check (char_length(visitor_ref) between 1 and 128),
  path text not null check (char_length(path) between 1 and 512),
  created_at timestamptz not null default now()
);

create index if not exists site_visit_events_created_at_idx
  on public.site_visit_events (created_at desc);

create index if not exists site_visit_events_visitor_created_idx
  on public.site_visit_events (visitor_ref, created_at desc);

comment on table public.site_visit_events is '사이트 페이지뷰 — 횟수·유니크 방문자 집계 (service role only)';

alter table public.site_visit_events enable row level security;

drop policy if exists "deny client site visit events" on public.site_visit_events;
create policy "deny client site visit events" on public.site_visit_events
for all using (false) with check (false);
