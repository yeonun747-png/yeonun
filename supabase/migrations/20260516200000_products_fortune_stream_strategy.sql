-- 상품별 메뉴 점사 스트림 전략 (Claude 단독 / Claude+Gemini 하이브리드)
alter table public.products add column if not exists fortune_stream_strategy text not null default 'claude_only';

comment on column public.products.fortune_stream_strategy is 'claude_only: Claude 단일 스트림 전체. hybrid: 1번 대메뉴 Claude, 이후 Gemini Pro 병렬.';

update public.products set fortune_stream_strategy = 'claude_only'
where slug in (
  'dream-lastnight',
  'tojeong-2026',
  'mind-now',
  'calendar-2026'
);

update public.products set fortune_stream_strategy = 'hybrid'
where slug in (
  'reunion-maybe',
  'newyear-2026',
  'child-saju',
  'taekil-goodday',
  'career-timing',
  'future-spouse',
  'saju-classic',
  'compat-howfar',
  'zimi-2026-flow',
  'wealth-graph',
  'zimi-chart',
  'naming-baby',
  'lifetime-master'
);
