-- 음성 세션 롤 API 인증 + Realtime 토큰·지연 실측(클라이언트 보고, 서버 누적)
alter table public.voice_sessions add column if not exists roll_secret text null;
alter table public.voice_sessions add column if not exists realtime_input_tokens int not null default 0;
alter table public.voice_sessions add column if not exists realtime_output_tokens int not null default 0;
alter table public.voice_sessions add column if not exists realtime_total_tokens int not null default 0;
alter table public.voice_sessions add column if not exists realtime_max_response_latency_ms int not null default 0;

update public.voice_sessions
set roll_secret = encode(gen_random_bytes(24), 'hex')
where roll_secret is null or btrim(roll_secret) = '';
