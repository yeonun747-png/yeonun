-- Security Advisor: SECURITY DEFINER RPC — anon/authenticated 직접 호출 차단
-- (revoke from public 만으로는 Supabase 기본 GRANT가 anon·authenticated에 남을 수 있음)

revoke all on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean)
  from public, anon, authenticated;

grant execute on function public.grant_purchase_credits_if_new(uuid, text, integer, boolean)
  to service_role;

revoke all on function public.try_rate_limit_hit(text, timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.try_rate_limit_hit(text, timestamptz, integer)
  to service_role;
