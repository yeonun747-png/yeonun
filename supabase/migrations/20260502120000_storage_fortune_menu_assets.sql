-- 점사 메뉴 이미지·mp4 썸네일 (어드민 업로드 → public URL)
insert into storage.buckets (id, name, public)
values ('fortune_menu_assets', 'fortune_menu_assets', true)
on conflict (id) do update set public = excluded.public;

-- public 버킷: 객체는 공개 URL로만 접근하면 되며, storage.objects에 넓은 SELECT 정책을 두면
-- Supabase Advisor가 "클라이언트가 버킷 전체 파일 목록을 열람할 수 있음" 경고를 띄운다.
-- 업로드/삭제는 Next API(service role)만 사용한다.
