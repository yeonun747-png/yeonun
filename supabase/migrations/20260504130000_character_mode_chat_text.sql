-- 텍스트 채팅 상담용 character_mode_prompts.mode 값 추가
alter table public.character_mode_prompts drop constraint if exists character_mode_prompts_mode_check;
alter table public.character_mode_prompts
  add constraint character_mode_prompts_mode_check check (mode in ('voice', 'fortune_text', 'chat_text'));
