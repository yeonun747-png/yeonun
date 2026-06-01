-- 문의 처리 완료 메타
alter table public.user_inquiries
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text;

comment on column public.user_inquiries.resolved_at is 'CS 처리 완료 시각';
comment on column public.user_inquiries.resolved_by is '처리한 어드민 식별';

create index if not exists user_inquiries_pending_created_idx
  on public.user_inquiries (created_at desc)
  where status = 'pending';
