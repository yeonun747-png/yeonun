-- Security Advisor 경고: Function Search Path Mutable
-- Supabase Dashboard → SQL Editor 에서 실행
--
-- 대상 예: public.huma_crank_letter_label
-- (DB에만 있고 repo 마이그레이션에 없는 함수도 ALTER로 고칠 수 있음)

-- ── 0) search_path 미설정 public 함수 목록 ──
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args,
  p.proconfig as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and (
    p.proconfig is null
    or not exists (
      select 1
      from unnest(p.proconfig) cfg
      where cfg like 'search_path=%'
    )
  )
order by p.proname;

-- ── 1) 일괄 고정 ──
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) cfg
          where cfg like 'search_path=%'
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public',
      r.schema_name,
      r.function_name,
      r.args
    );
  end loop;
end;
$$;

-- ── 2) huma_crank_letter_label 단독 확인 (0건이면 해결) ──
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'huma_crank_letter_label';

-- ── 3) Security Advisor → Refresh
