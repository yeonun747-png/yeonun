-- 매일 출석 (KST · user 단위 unique · 멀티 디바이스 중복 방지)
create table if not exists public.daily_attendance (
  user_id uuid not null references auth.users (id) on delete cascade,
  kst_date text not null check (kst_date ~ '^\d{4}-\d{2}-\d{2}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, kst_date)
);

create index if not exists daily_attendance_user_created_idx on public.daily_attendance (user_id, created_at desc);

create table if not exists public.user_attendance_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  streak int not null default 0 check (streak >= 0 and streak <= 7),
  cycle int not null default 1 check (cycle >= 1),
  last_attendance_kst_date text null check (last_attendance_kst_date is null or last_attendance_kst_date ~ '^\d{4}-\d{2}-\d{2}$'),
  coupon_pending boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 할인 쿠폰 동시 1매: 미소비 행은 사용자당 최대 1개 (부분 유니크)
create table if not exists public.user_discount_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  discount_pct int not null default 5,
  source text not null default 'attendance',
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists user_discount_coupons_one_active
  on public.user_discount_coupons (user_id)
  where consumed_at is null;

create index if not exists user_discount_coupons_user_exp on public.user_discount_coupons (user_id, expires_at desc);

-- 꿈해몽 무료 1회권 (중복 보유 가능)
create table if not exists public.user_dream_interpretation_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quantity int not null default 1 check (quantity >= 1),
  expires_at timestamptz not null,
  source text not null default 'attendance',
  created_at timestamptz not null default now()
);

create index if not exists dream_passes_user_exp on public.user_dream_interpretation_passes (user_id, expires_at desc);

comment on table public.daily_attendance is '일별 출석 로그 · (user_id,kst_date) unique';
comment on table public.user_attendance_state is '연속 출석 streak·사이클·쿠폰 대기';
comment on table public.user_discount_coupons is '사용자 할인 쿠폰 (미소비 1매 제한은 부분 유니크)';
comment on table public.user_dream_interpretation_passes is '꿈해몽 무료 풀이 회권';

alter table public.daily_attendance enable row level security;
alter table public.user_attendance_state enable row level security;
alter table public.user_discount_coupons enable row level security;
alter table public.user_dream_interpretation_passes enable row level security;
