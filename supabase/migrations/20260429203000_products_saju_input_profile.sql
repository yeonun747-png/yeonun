-- 사주형(본인만) / 궁합형(상대·추가 명식 필요) — 풀이 카드·결제 UX 구분
alter table public.products
  add column if not exists saju_input_profile text not null default 'single'
  check (saju_input_profile in ('single', 'pair'));

comment on column public.products.saju_input_profile is 'single=내 사주만, pair=상대방·자녀 등 두 번째 생시 필요(궁합·재회·택일·자녀사주 등)';

-- 17개 상품 분류 (운영 기본값)
update public.products set saju_input_profile = 'pair' where slug in (
  'reunion-maybe',
  'mind-now',
  'compat-howfar',
  'taekil-goodday',
  'child-saju'
);

update public.products set saju_input_profile = 'single' where slug in (
  'future-spouse',
  'lifetime-master',
  'saju-classic',
  'wealth-graph',
  'career-timing',
  'newyear-2026',
  'tojeong-2026',
  'zimi-2026-flow',
  'calendar-2026',
  'zimi-chart',
  'naming-baby',
  'dream-lastnight'
);
