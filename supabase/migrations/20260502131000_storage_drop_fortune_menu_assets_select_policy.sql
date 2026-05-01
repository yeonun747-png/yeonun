-- Advisor: broad SELECT on storage.objects → 클라이언트가 버킷 전체 파일 목록(list)을 볼 수 있음.
-- public 버킷은 알려진 URL로 객체 GET만 하면 되므로 이 정책은 제거한다.
drop policy if exists "public read fortune_menu_assets" on storage.objects;
