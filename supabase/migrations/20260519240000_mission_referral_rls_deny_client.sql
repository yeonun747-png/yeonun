-- Security Advisor "RLS Enabled No Policy" — 미션·초대 서버 전용 테이블
-- service_role은 RLS 우회 — API 동작 변화 없음

do $$
declare
  t text;
  pol text;
  tables text[] := array[
    'referral_signups',
    'user_mission_coupon_pending',
    'user_mission_reward_grants',
    'user_referral_codes'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    pol := 'deny client ' || t;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', pol, t);
    execute format(
      'create policy %I on public.%I for all using (false) with check (false)',
      pol,
      t
    );
  end loop;
end;
$$;
