alter table public.voice_sessions add column if not exists archive_subtitle text null;

comment on column public.voice_sessions.archive_subtitle is '보관함 목록용 한 문장 요약(Haiku, 종료 후 생성)';
