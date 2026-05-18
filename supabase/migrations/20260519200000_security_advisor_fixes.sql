-- Security Advisor: function search_path 고정, fortune_stream_section_chunks RLS 정리
-- Auth "Leaked password protection" → Dashboard: Authentication → Providers → Email → Enable leaked password protection (Pro+)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.products_assign_payment_code()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  nxt int;
begin
  if new.payment_code is not null then
    return new;
  end if;
  select coalesce(max(p.payment_code), 999) + 1 into nxt
  from public.products p
  where p.payment_code >= 1000 and p.payment_code < 9000;
  if nxt >= 9000 then
    raise exception 'payment_code pool exhausted (1000-8999)';
  end if;
  new.payment_code := nxt;
  return new;
end;
$$;

-- Supabase UI에서만 만든 테이블일 수 있음 — permissive 정책 제거 후 service role 전용
do $$
declare
  pol record;
begin
  if to_regclass('public.fortune_stream_section_chunks') is null then
    return;
  end if;

  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'fortune_stream_section_chunks'
  loop
    execute format(
      'drop policy if exists %I on public.fortune_stream_section_chunks',
      pol.policyname
    );
  end loop;

  execute 'alter table public.fortune_stream_section_chunks enable row level security';

  execute $p$
    create policy "deny client fortune_stream_section_chunks"
      on public.fortune_stream_section_chunks
      for all
      using (false)
      with check (false)
  $p$;
end;
$$;
