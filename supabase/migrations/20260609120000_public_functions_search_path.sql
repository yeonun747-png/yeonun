-- Security Advisor: Function Search Path Mutable
-- public 스키마 함수 중 search_path 미설정 항목 일괄 고정 (huma_crank_letter_label 등)

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
    raise notice 'search_path=public → %.%(%)',
      r.schema_name,
      r.function_name,
      r.args;
  end loop;
end;
$$;
