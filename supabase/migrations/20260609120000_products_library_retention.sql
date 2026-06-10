-- 점사 보관함 열람 기간 — 상품별 설정 (KST 자정 기준)
alter table public.products
  add column if not exists library_retention_kind text not null default 'days'
    check (library_retention_kind in ('days', 'kst_day', 'kst_month')),
  add column if not exists library_retention_days int not null default 60
    check (library_retention_days >= 1 and library_retention_days <= 3650);

comment on column public.products.library_retention_kind is
  '보관함 열람: days=완료 KST일 포함 N일(자정 리셋), kst_day=당일만, kst_month=당월만';
comment on column public.products.library_retention_days is
  'library_retention_kind=days 일 때 보관 일수(기본 60)';
