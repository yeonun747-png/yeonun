-- 미션 완료 사실(서버 증빙) — 보상 API eligibility 검증용
create table if not exists public.user_mission_event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null,
  kst_date text not null check (kst_date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now(),
  unique (user_id, event_key, kst_date)
);

create index if not exists user_mission_event_logs_user_kst_idx
  on public.user_mission_event_logs (user_id, kst_date desc);

comment on table public.user_mission_event_logs is '미션 완료 사실 로그 — 클라이언트 localStorage와 별도 서버 검증';

alter table public.user_mission_event_logs enable row level security;

drop policy if exists "deny client user mission event logs" on public.user_mission_event_logs;
create policy "deny client user mission event logs" on public.user_mission_event_logs
for all using (false) with check (false);
