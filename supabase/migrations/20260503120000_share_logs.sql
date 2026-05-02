-- 오늘의 한 마디 등 공유 이벤트 로그
create table if not exists public.share_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kst_date text not null check (kst_date ~ '^\d{4}-\d{2}-\d{2}$'),
  character_key text not null check (character_key in ('yeon', 'byeol', 'yeo', 'un')),
  channel text not null check (channel in ('native', 'clipboard')),
  created_at timestamptz not null default now()
);

create index if not exists share_logs_user_kst_idx on public.share_logs (user_id, kst_date desc);
create index if not exists share_logs_created_at_idx on public.share_logs (created_at desc);

comment on table public.share_logs is '오늘의 한 마디 소셜 공유 등 (native / clipboard)';
