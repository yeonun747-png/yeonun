-- 결제 모달·크레딧 충전 페이지가 쓰는 product_slug (orders.product_slug → products.slug FK)
insert into public.products(slug, title, quote, category_slug, badge, price_krw, character_key, home_section_slug, tags, saju_input_profile)
values
(
  'credit-package-basic',
  '크레딧 기본 충전',
  '음성·채팅 상담에 쓰이는 크레딧을 충전합니다.',
  'all',
  null,
  3900,
  'yeon',
  null,
  array['#크레딧', '#충전']::text[],
  'single'
),
(
  'credit-package-popular',
  '크레딧 인기 패키지',
  '+20% 보너스 크레딧이 포함된 패키지입니다.',
  'all',
  'BEST',
  9900,
  'yeon',
  null,
  array['#크레딧', '#충전', '#보너스']::text[],
  'single'
),
(
  'credit-package-premium',
  '크레딧 프리미엄 패키지',
  '+30% 보너스 크레딧이 포함된 패키지입니다.',
  'all',
  null,
  19900,
  'yeon',
  null,
  array['#크레딧', '#충전', '#보너스']::text[],
  'single'
)
on conflict (slug) do update set
  title = excluded.title,
  quote = excluded.quote,
  category_slug = excluded.category_slug,
  badge = excluded.badge,
  price_krw = excluded.price_krw,
  character_key = excluded.character_key,
  home_section_slug = excluded.home_section_slug,
  tags = excluded.tags,
  saju_input_profile = excluded.saju_input_profile;
