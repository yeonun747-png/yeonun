-- 테스트 계정 탈퇴 유예 해제 (Supabase SQL Editor)
-- 이메일에 맞는 social 행의 auth_user_id 기준으로 같은 계정의 구글·카카오·네이버 행을 모두 복구합니다.

-- 1) 확인
select id, provider, provider_id, email, auth_user_id, deleted_at, purge_after_at
from public.yeonun_social_users
where lower(coalesce(email, '')) = lower('goricc@naver.com')
   or auth_user_id in (
     select auth_user_id
     from public.yeonun_social_users
     where lower(coalesce(email, '')) = lower('goricc@naver.com')
   );

-- 2) 복구 (이메일 변경 시 아래 goricc@naver.com 만 수정)
update public.yeonun_social_users
set deleted_at = null,
    purge_after_at = null
where auth_user_id in (
  select distinct auth_user_id
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('goricc@naver.com')
);
