-- 미션 쿠폰(정액)·보상 멱등·친구 초대

alter table public.user_discount_coupons
  add column if not exists discount_fixed_krw int null check (discount_fixed_krw is null or discount_fixed_krw > 0);

comment on column public.user_discount_coupons.discount_fixed_krw is '정액 할인(원). discount_pct와 동시 사용 시 정액 우선';

create table if not exists public.user_mission_coupon_pending (
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id text not null check (mission_id in ('M01', 'M05', 'M09')),
  created_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);

create table if not exists public.user_mission_reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  grant_key text not null,
  mission_id text not null,
  reward_kind text not null,
  created_at timestamptz not null default now(),
  unique (user_id, grant_key)
);

create index if not exists user_mission_reward_grants_user_idx
  on public.user_mission_reward_grants (user_id, created_at desc);

create table if not exists public.user_referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_signups (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users (id) on delete cascade,
  referee_user_id uuid not null unique references auth.users (id) on delete cascade,
  assigned_kst_date text not null check (assigned_kst_date ~ '^\d{4}-\d{2}-\d{2}$'),
  referrer_rewarded boolean not null default false,
  referee_rewarded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists referral_signups_referrer_idx
  on public.referral_signups (referrer_user_id, created_at desc);

alter table public.user_mission_coupon_pending enable row level security;
alter table public.user_mission_reward_grants enable row level security;
alter table public.user_referral_codes enable row level security;
alter table public.referral_signups enable row level security;
