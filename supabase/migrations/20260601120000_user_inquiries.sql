-- 고객 문의 (마이 > 문의하기)
create table if not exists public.user_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  email text not null,
  phone text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists user_inquiries_user_id_idx on public.user_inquiries (user_id);
create index if not exists user_inquiries_created_at_idx on public.user_inquiries (created_at desc);
create index if not exists user_inquiries_status_idx on public.user_inquiries (status);

comment on table public.user_inquiries is '마이탭 문의하기 접수';
comment on column public.user_inquiries.user_id is '로그인 회원 auth uid (비회원 null)';

alter table public.user_inquiries enable row level security;

drop policy if exists "deny client user_inquiries" on public.user_inquiries;
create policy "deny client user_inquiries"
  on public.user_inquiries
  for all
  using (false)
  with check (false);
