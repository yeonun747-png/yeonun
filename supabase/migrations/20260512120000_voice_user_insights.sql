-- 음성 상담 중 모델이 추출한 사용자 인사이트 (재방문 인사·맥락용)
create table if not exists public.voice_user_insights (
  id uuid primary key default gen_random_uuid(),
  user_ref text not null,
  character_key text not null references public.characters(key) on delete cascade,
  session_id uuid null references public.voice_sessions (id) on delete set null,
  category text not null,
  detail text not null,
  importance_level int not null check (
    importance_level >= 1
    and importance_level <= 5
  ),
  created_at timestamptz not null default now()
);

create index if not exists idx_voice_user_insights_user_char_created
  on public.voice_user_insights (user_ref, character_key, created_at desc);

create index if not exists idx_voice_user_insights_session
  on public.voice_user_insights (session_id);

comment on table public.voice_user_insights is 'Realtime 음성 상담에서 save_user_insight 도구로 적재; client-secret 시 [User_History_Context] 주입에 사용';
