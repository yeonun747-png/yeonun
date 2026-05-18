-- Security Advisor Info "RLS Enabled No Policy" → 서버 전용 테이블에 명시적 거부 정책
-- service_role은 RLS 우회 — API 동작 변화 없음

do $$
declare
  t text;
  pol text;
  tables text[] := array[
    'daily_attendance',
    'fortune_prompt_versions',
    'fortune_requests',
    'fortune_results',
    'orders',
    'payments',
    'refunds',
    'share_logs',
    'user_attendance_state',
    'user_discount_coupons',
    'user_dream_interpretation_passes',
    'voice_memory_entries',
    'voice_sessions',
    'voice_turns',
    'voice_usage',
    'voice_user_insights',
    'webhook_events',
    'yeonun_social_users'
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
