-- 운영자 답변 + 회원 읽음 확인
alter table public.user_inquiries
  add column if not exists admin_reply text,
  add column if not exists reply_read_at timestamptz;

comment on column public.user_inquiries.admin_reply is 'CS 답변 본문 (처리완료 시 필수)';
comment on column public.user_inquiries.reply_read_at is '회원이 답변을 확인한 시각 (null=미확인)';

create index if not exists user_inquiries_unread_reply_idx
  on public.user_inquiries (user_id, created_at desc)
  where status = 'resolved' and admin_reply is not null and reply_read_at is null;
