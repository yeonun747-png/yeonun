-- 점사 메뉴 스트림(Cloudways) 기본 LLM — 어드민에서 변경
insert into public.service_prompts (key, title, prompt, is_active)
values (
  'yeonun_fortune_menu_llm',
  '점사 메뉴 스트림 — LLM 모델',
  'claude-sonnet-4-6',
  true
)
on conflict (key) do nothing;
