-- 1) 첫 충전 완료: purchase 지급 시 항상 first_purchase_done = true (보너스 플래그와 무관)
-- 2) 기존 purchase 원장 있는 지갑 backfill
-- 3) 공지 읽음 slug — profiles에 서버 저장 (재접속·기기 변경 유지)

alter table public.profiles
  add column if not exists notice_read_slugs jsonb not null default '[]'::jsonb;

comment on column public.profiles.notice_read_slugs is '읽은 공지 slug 배열(JSON). show_new_dot 공지만 미읽음 판정.';

update public.user_credit_wallets w
set first_purchase_done = true
where not w.first_purchase_done
  and exists (
    select 1
    from public.user_credit_ledger l
    where l.user_id = w.user_id
      and l.kind = 'purchase'
  );

create or replace function public.grant_purchase_credits_if_new(
  p_user_id uuid,
  p_order_id text,
  p_base_grant integer,
  p_first_bonus boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet public.user_credit_wallets%rowtype;
  v_grant integer;
  v_new_paid integer;
begin
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'order_id_required';
  end if;

  v_grant := greatest(0, coalesce(p_base_grant, 0));

  if exists (
    select 1
    from public.user_credit_ledger
    where user_id = p_user_id
      and kind = 'purchase'
      and ref_id = p_order_id
  ) then
    select * into v_wallet from public.user_credit_wallets where user_id = p_user_id;
    return jsonb_build_object(
      'granted', false,
      'duplicate', true,
      'paid_balance', coalesce(v_wallet.paid_balance, 0),
      'free_balance', coalesce(v_wallet.free_balance, 0),
      'first_purchase_done', coalesce(v_wallet.first_purchase_done, false)
    );
  end if;

  select * into v_wallet
  from public.user_credit_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'wallet_not_found';
  end if;

  if p_first_bonus and not v_wallet.first_purchase_done then
    v_grant := (v_grant * 11 + 5) / 10;
  end if;

  v_new_paid := v_wallet.paid_balance + v_grant;

  insert into public.user_credit_ledger (
    user_id,
    delta_paid,
    delta_free,
    paid_balance_after,
    free_balance_after,
    kind,
    ref_type,
    ref_id,
    memo
  ) values (
    p_user_id,
    v_grant,
    0,
    v_new_paid,
    v_wallet.free_balance,
    'purchase',
    'order',
    p_order_id,
    '크레딧 충전'
  );

  update public.user_credit_wallets
  set
    paid_balance = v_new_paid,
    first_purchase_done = true
  where user_id = p_user_id;

  return jsonb_build_object(
    'granted', true,
    'duplicate', false,
    'grant_amount', v_grant,
    'paid_balance', v_new_paid,
    'free_balance', v_wallet.free_balance,
    'first_purchase_done', true
  );
exception
  when unique_violation then
    select * into v_wallet from public.user_credit_wallets where user_id = p_user_id;
    return jsonb_build_object(
      'granted', false,
      'duplicate', true,
      'paid_balance', coalesce(v_wallet.paid_balance, 0),
      'free_balance', coalesce(v_wallet.free_balance, 0),
      'first_purchase_done', coalesce(v_wallet.first_purchase_done, false)
    );
end;
$$;

revoke all on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean) from public;
grant execute on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean) to service_role;
