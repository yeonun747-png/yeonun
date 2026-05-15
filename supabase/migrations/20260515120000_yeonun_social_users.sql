-- 소셜 로그인 사용자 (provider + provider_id 유니크)
create table if not exists public.yeonun_social_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'kakao', 'naver')),
  provider_id text not null,
  name text not null default '',
  email text null,
  profile_image text null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create index if not exists yeonun_social_users_auth_user_id_idx
  on public.yeonun_social_users (auth_user_id);

create index if not exists yeonun_social_users_email_idx
  on public.yeonun_social_users (email)
  where email is not null;

comment on table public.yeonun_social_users is '소셜 OAuth 가입·로그인 · provider+provider_id 유니크';

alter table public.yeonun_social_users enable row level security;
