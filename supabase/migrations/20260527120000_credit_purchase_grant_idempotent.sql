-- 주문당 크레딧 충전 1회만 지급 (동시 /api/payment/complete 레이스 방지)

-- 레이스 버그로 쌓인 중복 purchase 원장 정리 (지갑 잔액은 CS에서 별도 조정)
with ranked_purchase as (
  select
    id,
    row_number() over (
      partition by user_id, ref_id
      order by delta_paid desc, created_at asc, id asc
    ) as rn
  from public.user_credit_ledger
  where kind = 'purchase'
    and ref_id is not null
)
delete from public.user_credit_ledger l
using ranked_purchase r
where l.id = r.id
  and r.rn > 1;

create unique index if not exists user_credit_ledger_purchase_order_uidx
  on public.user_credit_ledger (user_id, ref_id)
  where kind = 'purchase' and ref_id is not null;

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
    first_purchase_done = case
      when p_first_bonus then true
      else first_purchase_done
    end
  where user_id = p_user_id;

  return jsonb_build_object(
    'granted', true,
    'duplicate', false,
    'grant_amount', v_grant,
    'paid_balance', v_new_paid,
    'free_balance', v_wallet.free_balance,
    'first_purchase_done', case
      when p_first_bonus then true
      else v_wallet.first_purchase_done
    end
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

revoke all on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean) to service_role;
