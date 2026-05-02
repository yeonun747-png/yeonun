-- 음성 상담용 점사 요약(Haiku 등) — 본문 html·목록용 summary와 별도 저장
alter table public.fortune_results add column if not exists voice_consult_summary text null;
