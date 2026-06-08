-- 고객 문의(user_inquiries) 전체 초기화
-- Supabase Dashboard → SQL Editor (service role) 에서 실행
--
-- 대상 테이블: public.user_inquiries
--   · 마이 > 문의하기 접수 (회원 user_id / 비회원 email)
--   · status: pending | resolved
--   · admin_reply, reply_read_at, resolved_at, resolved_by 포함
--
-- ⚠️ 되돌릴 수 없습니다. 운영 DB에서는 실행 전 백업·건수 확인 권장.

-- ── 0) 삭제 전 건수 확인 ──
select
  count(*) as total,
  count(*) filter (where status = 'pending') as pending,
  count(*) filter (where status = 'resolved') as resolved,
  count(*) filter (where admin_reply is not null and btrim(admin_reply) <> '') as with_reply,
  count(*) filter (
    where status = 'resolved'
      and admin_reply is not null
      and btrim(admin_reply) <> ''
      and reply_read_at is null
  ) as unread_reply
from public.user_inquiries;

-- ── 1) 전체 초기화 ──
truncate table public.user_inquiries;

-- ── 2) 삭제 후 확인 (0건이어야 함) ──
select count(*) as remaining from public.user_inquiries;

-- ── (선택) 특정 이메일만 삭제할 때 — 위 TRUNCATE 대신 아래 사용 ──
-- delete from public.user_inquiries
-- where lower(email) = lower('test@example.com');
--
-- select count(*) as remaining from public.user_inquiries;
