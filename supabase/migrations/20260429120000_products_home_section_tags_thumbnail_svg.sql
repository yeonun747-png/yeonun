-- 홈 섹션 구분 / 풀이 카드 태그 / 어드민 SVG 썸네일
alter table public.products
  add column if not exists home_section_slug text null,
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists thumbnail_svg text null;

comment on column public.products.home_section_slug is 'weekly_love | lifetime | season_2026 | deep_dive — 홈 노출 섹션 구분';
comment on column public.products.tags is '풀이 카드용 해시태그(최대 3개 권장)';
comment on column public.products.thumbnail_svg is '카드 일러스트용 SVG 마크업(viewBox 포함). 비우면 앱 기본 일러스트 사용';
