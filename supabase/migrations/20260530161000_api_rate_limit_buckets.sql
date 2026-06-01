-- API rate limit (serverless 인스턴스 간 공유)
create table if not exists public.api_rate_limit_buckets (
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count int not null default 1 check (hit_count >= 0),
  primary key (bucket_key, window_start)
);

create index if not exists api_rate_limit_buckets_window_idx
  on public.api_rate_limit_buckets (window_start);

comment on table public.api_rate_limit_buckets is 'Sliding-window rate limit buckets — service role only';

alter table public.api_rate_limit_buckets enable row level security;

drop policy if exists "deny client api rate limit buckets" on public.api_rate_limit_buckets;
create policy "deny client api rate limit buckets" on public.api_rate_limit_buckets
for all using (false) with check (false);

-- 원자적 hit: limit 이하면 count+1 후 true, 초과면 false
create or replace function public.try_rate_limit_hit(
  p_bucket_key text,
  p_window_start timestamptz,
  p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
begin
  insert into public.api_rate_limit_buckets (bucket_key, window_start, hit_count)
  values (p_bucket_key, p_window_start, 1)
  on conflict (bucket_key, window_start)
  do update set hit_count = public.api_rate_limit_buckets.hit_count + 1
  where public.api_rate_limit_buckets.hit_count < p_limit
  returning hit_count into new_count;

  if found then
    return new_count <= p_limit;
  end if;

  return false;
end;
$$;

revoke all on function public.try_rate_limit_hit(text, timestamptz, int) from public, anon, authenticated;
grant execute on function public.try_rate_limit_hit(text, timestamptz, int) to service_role;
