-- 텍스트 채팅 등 API 단 LLM 실패 이벤트 (어제 오류 KPI용)
create table if not exists public.llm_error_events (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('chat', 'voice', 'fortune')),
  created_at timestamptz not null default now()
);

create index if not exists idx_llm_error_events_created
  on public.llm_error_events (created_at desc);

create index if not exists idx_llm_error_events_service_created
  on public.llm_error_events (service, created_at desc);

comment on table public.llm_error_events is 'LLM/API 처리 실패 로그 (관리자 대시보드 집계)';

alter table public.llm_error_events enable row level security;

drop policy if exists "deny anon llm_error_events" on public.llm_error_events;
create policy "deny anon llm_error_events" on public.llm_error_events for all using (false);
