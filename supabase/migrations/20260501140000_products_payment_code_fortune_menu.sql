-- PG 상품 구분용 결제코드(4자리 숫자, 1000~9999) + 어드민 점사 대/소메뉴(JSON)
alter table public.products
  add column if not exists payment_code int;

alter table public.products
  add column if not exists fortune_menu jsonb not null default '{"main_menus":[]}'::jsonb;

comment on column public.products.payment_code is 'PG 등에서 상품을 구분하는 4자리 숫자(1000~9999). 신규 insert 시 자동 부여, 변경 불가.';
comment on column public.products.fortune_menu is '점사 UI용 대메뉴/소메뉴 트리(메뉴명·해석 프롬프트·이미지·동영상 썸네일 URL 등).';

-- 기존 행 백필 (slug 순)
with numbered as (
  select slug, (999 + row_number() over (order by slug))::int as code
  from public.products
  where payment_code is null
)
update public.products p
set payment_code = n.code
from numbered n
where p.slug = n.slug;

alter table public.products
  drop constraint if exists products_payment_code_range;

alter table public.products
  add constraint products_payment_code_range
  check (payment_code is null or (payment_code between 1000 and 9999));

create unique index if not exists products_payment_code_key
  on public.products (payment_code)
  where payment_code is not null;

-- 신규 상품 insert 시 payment_code 자동 (어드민이 명시하지 않은 경우)
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
  select coalesce(max(p.payment_code), 999) + 1 into nxt from public.products p;
  if nxt > 9999 then
    nxt := 9999;
  end if;
  new.payment_code := nxt;
  return new;
end;
$$;

drop trigger if exists products_assign_payment_code_trigger on public.products;
create trigger products_assign_payment_code_trigger
  before insert on public.products
  for each row
  execute function public.products_assign_payment_code();
