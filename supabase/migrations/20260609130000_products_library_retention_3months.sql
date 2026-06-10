-- 보관함 3개월(완료월 포함) 옵션 추가
alter table public.products
  drop constraint if exists products_library_retention_kind_check;

alter table public.products
  add constraint products_library_retention_kind_check
    check (library_retention_kind in ('days', 'kst_day', 'kst_month', 'kst_month_3'));

comment on column public.products.library_retention_kind is
  '보관함 열람: days=완료 KST일 포함 N일, kst_day=당일만, kst_month=당월만, kst_month_3=3개월';
