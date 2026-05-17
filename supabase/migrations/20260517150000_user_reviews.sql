-- 유저 보관함 리뷰 + 노출 제어
alter table public.reviews
  add column if not exists source_type text,
  add column if not exists source_id text,
  add column if not exists user_ref text,
  add column if not exists is_published boolean not null default false;

comment on column public.reviews.source_type is 'fortune | voice | chat — 유저 보관함 리뷰 출처';
comment on column public.reviews.source_id is '보관함 항목 ID (request_id, session_id 등)';
comment on column public.reviews.user_ref is '작성자 auth user id';
comment on column public.reviews.is_published is '프론트 노출 여부 (Showcase·유저 리뷰 공통, 어드민에서 제어)';

create unique index if not exists reviews_user_source_uidx
  on public.reviews (user_ref, source_type, source_id)
  where user_ref is not null and source_type is not null and source_id is not null;

-- showcase 12건 초기값: 노출 (이후 어드민에서 비노출 전환 가능)
update public.reviews set is_published = true where is_showcase = true;

-- yeonun_reviews.html에 없는 리뷰 제거 (showcase 12건만 유지)
delete from public.reviews
where id not in (
  'a1000001-0001-4001-8001-000000000001',
  'a1000001-0001-4001-8001-000000000002',
  'a1000001-0001-4001-8001-000000000003',
  'a1000001-0001-4001-8001-000000000004',
  'a1000001-0001-4001-8001-000000000005',
  'a1000001-0001-4001-8001-000000000006',
  'a1000001-0001-4001-8001-000000000007',
  'a1000001-0001-4001-8001-000000000008',
  'a1000001-0001-4001-8001-000000000009',
  'a1000001-0001-4001-8001-000000000010',
  'a1000001-0001-4001-8001-000000000011',
  'a1000001-0001-4001-8001-000000000012'
);
