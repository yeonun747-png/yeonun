-- 텍스트 상담 세션·메시지 (히스토리 목록·상세)

create table if not exists public.text_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  character_key text not null references public.characters (key) on delete restrict,
  user_ref text null,
  started_at timestamptz not null default now(),
  retention_until timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.text_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.text_chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_text_chat_messages_session_created on public.text_chat_messages (session_id, created_at asc);
create index if not exists idx_text_chat_sessions_started on public.text_chat_sessions (started_at desc);

alter table public.text_chat_sessions enable row level security;
alter table public.text_chat_messages enable row level security;

drop policy if exists "deny anon text_chat_sessions" on public.text_chat_sessions;
create policy "deny anon text_chat_sessions" on public.text_chat_sessions for all using (false);

drop policy if exists "deny anon text_chat_messages" on public.text_chat_messages;
create policy "deny anon text_chat_messages" on public.text_chat_messages for all using (false);

-- 데모 세션 재적용 시 중복 방지
delete from public.text_chat_messages
where session_id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);
delete from public.text_chat_sessions
where id in (
  '11111111-1111-4111-8111-111111111111'::uuid,
  '22222222-2222-4222-8222-222222222222'::uuid
);

insert into public.text_chat_sessions (id, character_key, user_ref, started_at, retention_until)
values
  (
    '11111111-1111-4111-8111-111111111111'::uuid,
    'yeon',
    'guest',
    '2026-04-26 23:05:00+09'::timestamptz,
    '2026-05-26 23:59:59+09'::timestamptz
  ),
  (
    '22222222-2222-4222-8222-222222222222'::uuid,
    'byeol',
    'guest',
    '2026-04-19 15:20:00+09'::timestamptz,
    '2026-05-19 23:59:59+09'::timestamptz
  );

insert into public.text_chat_messages (session_id, role, body, created_at)
values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '요즘 자꾸 그 사람 생각이 나요.', '2026-04-26 23:05:12+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '그 마음이 오래 가져와 주셔서 고마워요. 지금은 마음이 많이 무거우실 때일 거예요.', '2026-04-26 23:05:48+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '연락해도 될까요?', '2026-04-26 23:08:01+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '당장 결정하기보다는, 오늘 하루만 호흡을 길게 가져가 보시는 게 좋아요.', '2026-04-26 23:08:33+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '생일만 알아요. 그걸로도 볼 수 있나요?', '2026-04-26 23:11:10+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '네, 일간과 월주 흐름만으로도 지금 시기의 마음 결을 짚어볼 수 있어요.', '2026-04-26 23:11:42+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '제가 너무 조급한가요?', '2026-04-26 23:14:05+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '조급하다기보다, 소중해서 더 빨리 확인하고 싶은 마음에 가깝죠.', '2026-04-26 23:14:28+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '만약 연락하면 어떤 말부터 하는 게 나을까요?', '2026-04-26 23:16:50+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '부담 없는 안부 한 줄부터요. 부탁이나 확인 질문은 한 번에 하나만.', '2026-04-26 23:17:15+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '밤에 더 심해져요.', '2026-04-26 23:17:58+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '밤에는 감각이 예민해져서 같은 생각도 크게 느껴져요. 수면 전에는 스크린만이라도 조금 멀어두면 도움이 됩니다.', '2026-04-26 23:18:22+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'user', '그 사람도 같은 마음일까요?', '2026-04-26 23:18:35+09'::timestamptz),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'assistant', '지금은 서로의 속도가 조금 어긋나 보일 수 있는 시기예요. 다만 인연이 완전히 끊긴 결이라고 보긴 어렵습니다.', '2026-04-26 23:19:05+09'::timestamptz),

  ('22222222-2222-4222-8222-222222222222'::uuid, 'user', '올해 재물운이 궁금해요.', '2026-04-19 15:20:10+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'assistant', '올해는 흐름이 들어오기 전에 정리할 게 많은 해예요. 작은 지출부터 줄여두면 좋습니다.', '2026-04-19 15:20:44+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'user', '투자는 언제가 나을까요?', '2026-04-19 15:22:01+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'assistant', '큰 결정은 분기가 바뀌는 시점 이후로 미루는 편이 안전해 보여요.', '2026-04-19 15:22:30+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'user', '직장은 그대로 두는 게 맞을까요?', '2026-04-19 15:24:12+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'assistant', '지금은 버티면서 실력을 쌓는 쪽이 운의 방향과 맞습니다.', '2026-04-19 15:24:55+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'user', '감사합니다.', '2026-04-19 15:26:00+09'::timestamptz),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'assistant', '언제든 또 들려주세요. 별처럼 반짝이는 하루 되세요.', '2026-04-19 15:26:22+09'::timestamptz);
