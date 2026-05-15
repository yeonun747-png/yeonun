-- 회원 프로필 (온보딩·마이탭 정본)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  birth_year smallint,
  birth_month smallint,
  birth_day smallint,
  calendar_type text not null default 'solar'
    check (calendar_type in ('solar', 'lunar', 'lunar-leap')),
  birth_branch_key text
    check (
      birth_branch_key is null
      or birth_branch_key in (
        'zi', 'chou', 'yin', 'mao', 'chen', 'si',
        'wu', 'wei', 'shen', 'you', 'xu', 'hai'
      )
    ),
  birth_time_unknown boolean not null default false,
  gender text not null default 'female' check (gender in ('male', 'female')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on table public.profiles is '연운 회원 사주·표시명 정본 (auth.users 1:1)';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- 소셜 계정 탈퇴(소프트) — 활성 행만 provider+provider_id 유니크
alter table public.yeonun_social_users
  add column if not exists deleted_at timestamptz null;

alter table public.yeonun_social_users
  add column if not exists purge_after_at timestamptz null;

alter table public.yeonun_social_users
  drop constraint if exists yeonun_social_users_provider_provider_id_key;

create unique index if not exists yeonun_social_users_provider_pid_active_uidx
  on public.yeonun_social_users (provider, provider_id)
  where deleted_at is null;
