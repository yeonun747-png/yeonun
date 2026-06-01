-- 회원 탈퇴 유예 해제 + 보관함(점사) user_ref 재연결
-- Supabase Dashboard → SQL Editor 에서 실행
-- 이메일만 본인 계정에 맞게 바꾸세요 (예: macju@naver.com)

-- ── 0) 대상 UUID 확인 ──
with target as (
  select distinct auth_user_id as uid
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
     or auth_user_id in (
       select auth_user_id
       from public.yeonun_social_users
       where lower(coalesce(email, '')) = lower('macju@naver.com')
     )
)
select
  t.uid,
  left(t.uid::text, 8) as uid_prefix,
  (select count(*) from public.yeonun_social_users s where s.auth_user_id = t.uid) as social_rows,
  (select count(*) from public.fortune_requests fr where fr.user_ref = t.uid::text) as library_linked,
  (select count(*) from public.fortune_requests fr where fr.user_ref like 'purged_' || left(t.uid::text, 8) || '_%') as library_purged
from target t;

-- ── 1) 소셜 탈퇴 플래그 해제 (로그인 가능) ──
update public.yeonun_social_users
set deleted_at = null,
    purge_after_at = null
where auth_user_id in (
  select distinct auth_user_id
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
);

-- ── 2) 보관함·이용 기록 user_ref 복구 (탈퇴 시 purged_xxxxxxxx_… 로 바뀐 행) ──
with target as (
  select distinct auth_user_id::text as uid
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
)
update public.fortune_requests fr
set user_ref = t.uid
from target t
where fr.user_ref like 'purged_' || left(t.uid, 8) || '_%';

with target as (
  select distinct auth_user_id::text as uid
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
)
update public.voice_sessions vs
set user_ref = t.uid
from target t
where vs.user_ref like 'purged_' || left(t.uid, 8) || '_%';

with target as (
  select distinct auth_user_id::text as uid
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
)
update public.text_chat_sessions ts
set user_ref = t.uid
from target t
where ts.user_ref like 'purged_' || left(t.uid, 8) || '_%';

-- ── 3) 복구 결과 확인 (library_linked > 0 이면 보관함 조회 가능) ──
with target as (
  select distinct auth_user_id as uid
  from public.yeonun_social_users
  where lower(coalesce(email, '')) = lower('macju@naver.com')
)
select
  fr.id,
  fr.user_ref,
  fr.status,
  fr.product_slug,
  fr.created_at,
  (fr.payload->>'source') as payload_source
from public.fortune_requests fr
cross join target t
where fr.user_ref = t.uid::text
  and fr.status = 'completed'
order by fr.created_at desc
limit 20;
