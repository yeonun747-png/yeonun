-- 로그인 회원 크레딧 지갑(서버 정본) + 원장(CS·차감·충전)

create table if not exists public.user_credit_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  paid_balance int not null default 0 check (paid_balance >= 0),
  free_balance int not null default 0 check (free_balance >= 0),
  free_expires_at timestamptz not null default (now() + interval '30 days'),
  first_purchase_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta_paid int not null default 0,
  delta_free int not null default 0,
  paid_balance_after int not null,
  free_balance_after int not null,
  kind text not null check (
    kind in (
      'purchase',
      'spend_chat',
      'spend_voice',
      'spend_fortune',
      'admin_adjust',
      'cs_refund',
      'migration_import',
      'trial_grant'
    )
  ),
  ref_type text null,
  ref_id text null,
  memo text null,
  admin_actor text null,
  created_at timestamptz not null default now()
);

create index if not exists user_credit_ledger_user_id_created_idx
  on public.user_credit_ledger (user_id, created_at desc);

create index if not exists user_credit_ledger_ref_idx
  on public.user_credit_ledger (ref_type, ref_id)
  where ref_id is not null;

comment on table public.user_credit_wallets is '로그인 회원 크레딧 잔액(유료/무료). 비로그인은 localStorage.';
comment on table public.user_credit_ledger is '크레딧 변동 원장 — CS 조정·차감·충전 감사용';

drop trigger if exists trg_user_credit_wallets_updated_at on public.user_credit_wallets;
create trigger trg_user_credit_wallets_updated_at
  before update on public.user_credit_wallets
  for each row execute function public.set_updated_at();

alter table public.user_credit_wallets enable row level security;
alter table public.user_credit_ledger enable row level security;

-- 서비스 롤만 접근 (API 경유)
create policy "user_credit_wallets_service_only"
  on public.user_credit_wallets for all
  using (false)
  with check (false);

create policy "user_credit_ledger_service_only"
  on public.user_credit_ledger for all
  using (false)
  with check (false);
