-- 크레딧 충전 패키지 PG 결제코드 고정 (9001~9003)
update public.products
set payment_code = 9001
where slug = 'credit-package-basic';

update public.products
set payment_code = 9002
where slug = 'credit-package-popular';

update public.products
set payment_code = 9003
where slug = 'credit-package-premium';

-- 일반 상품 자동 부여: 1000~8999 (9000번대는 크레딧 전용)
create or replace function public.products_assign_payment_code()
returns trigger
language plpgsql
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
