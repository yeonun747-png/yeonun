-- 음성 Realtime 롤링: 압축 메모리 + 세션 연속 (전체 transcript 미주입)
create table if not exists public.voice_memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_ref text not null,
  character_key text not null references public.characters (key) on delete cascade,
  session_id uuid null references public.voice_sessions (id) on delete set null,
  memory_type text not null,
  importance numeric(4, 3) not null check (importance >= 0 and importance <= 1),
  summary text not null,
  promoted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_memory_entries_user_char_imp
  on public.voice_memory_entries (user_ref, character_key, importance desc, created_at desc);

create index if not exists idx_voice_memory_entries_session
  on public.voice_memory_entries (session_id);

comment on table public.voice_memory_entries is 'Haiku 롤업 압축 메모리(importance>=0.7만 저장). Realtime client-secret 주입·연속성.';

alter table public.voice_sessions add column if not exists continuity_summary text null;
alter table public.voice_sessions add column if not exists rolled_from_session_id uuid null references public.voice_sessions (id) on delete set null;
alter table public.voice_sessions add column if not exists rolling_generation int not null default 0;

comment on column public.voice_sessions.continuity_summary is '롤 후 상담사 톤 연속용 압축 서술(전사 아님)';
comment on column public.voice_sessions.rolled_from_session_id is '직전 롤 세션 id(계보)';
comment on column public.voice_sessions.rolling_generation is '0=최초, 롤마다 +1';

alter table public.voice_memory_entries enable row level security;
