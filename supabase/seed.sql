-- 목업 기반 최소 시드 데이터

insert into public.characters(key, name, han, en, spec, greeting)
values
('yeon','연화','蓮','YEONHWA · 蓮花','재회 · 연애 · 궁합','오랜만이에요. 그 사람이 자꾸 떠오르시죠? 들여다봐 드릴게요.'),
('byeol','별하','星','BYEOLHA · 星河','자미두수 · 신년운세','별자리가 흐르듯, 올해 그대의 운도 흐를 거예요. 같이 봐요.'),
('yeo','여연','麗','YEOYEON · 麗淵','정통 사주 · 평생운','바람이 닿지 않는 깊은 물처럼, 사주의 본질을 짚어드립니다.'),
('un','운서','雲','UNSEO · 雲棲','작명 · 택일 · 꿈해몽','한 글자에 운명이 담깁니다. 천천히 풀어가시죠.')
on conflict (key) do update set
  name = excluded.name,
  han = excluded.han,
  en = excluded.en,
  spec = excluded.spec,
  greeting = excluded.greeting;

insert into public.categories(slug, label, sort_order)
values
('all','전체',0),
('love','연애·재회',1),
('saju','정통 사주',2),
('compat','궁합',3),
('career','재물·커리어',4),
('newyear','신년운세',5),
('zimi','자미두수',6),
('naming','작명·택일',7),
('dream','꿈해몽',8)
on conflict (slug) do update set
  label = excluded.label,
  sort_order = excluded.sort_order;

insert into public.products(slug, title, quote, category_slug, badge, price_krw, character_key)
values
('reunion-maybe','그 사람과 다시 만날 수 있을까','5월에 인연이 다시 닿을 자리가 보여요.','love','HOT',14900,'yeon'),
('lifetime-master','초년·장년·중년·말년 통합본','10년 대운 흐름까지 200쪽 분량.','saju','SIGNATURE',49900,'yeo'),
('compat-howfar','두 사람, 어디까지 이어질까','겉궁합·속궁합·결혼 후 흐름.','compat',null,19900,'yeon'),
('saju-classic','정통 사주풀이 종합','합·충·형·파·해 200항 정밀 분석.','saju',null,19900,'yeo'),
('mind-now','그 사람은 지금 무슨 생각','일주가 보내는 신호를 읽어드려요.','love','NEW',9900,'yeon'),
('future-spouse','미래 배우자 사주 분석','언제, 어디서, 어떤 결의 사람을 만날지.','love',null,19900,'yeon'),
('wealth-graph','재물보감 · 인생 부의 그래프','언제 큰 재물이 들어오고 빠지는지.','career',null,24900,'yeo'),
('career-timing','커리어 사주 · 이직·승진의 시기','올해 움직일 자리, 머무를 자리.','career',null,19900,'yeo'),
('zimi-chart','자미두수 명반 풀이','12궁·14주성으로 보는 운명.','zimi',null,24900,'byeol'),
('newyear-2026','2026 신년운세 1년표','월별 12장의 운세 카드.','newyear','2026',14900,'byeol'),
('tojeong-2026','2026 토정비결','조선의 비결서가 알려주는 한 해의 리듬.','newyear',null,9900,'byeol'),
('zimi-2026-flow','자미두수 · 2026 별의 흐름','12궁·14주성으로 보는 또 다른 운명.','zimi',null,24900,'byeol'),
('calendar-2026','2026 길일·흉일 캘린더','중요한 결정의 날, 미리 골라두기.','newyear',null,12900,'yeon'),
('naming-baby','아이 이름 작명 · 평생을 따라갈 글자','사주에 부족한 오행을 채워주는 이름.','naming','NEW',39900,'un'),
('taekil-goodday','결혼·이사·개업 길일','두 사람의 사주 + 행사 의도가 만나는 날.','naming',null,19900,'un'),
('dream-lastnight','어젯밤 꿈, 무엇을 말하나','동물·물·돈·죽음. 꿈의 상징을 읽어드려요.','dream',null,4900,'un')
on conflict (slug) do update set
  title = excluded.title,
  quote = excluded.quote,
  category_slug = excluded.category_slug,
  badge = excluded.badge,
  price_krw = excluded.price_krw,
  character_key = excluded.character_key;

insert into public.reviews(product_slug, user_mask, stars, body, tags)
values
('reunion-maybe','u*0',4.9,'좋은 분석 감사합니다 잘 읽었어요 ^^',array['#재회','#마음']),
('zimi-chart','송*민',4.6,'자미두수 처음 봤는데 사주랑 또 다른 결이라 재밌어요. 톤이 진짜 친구 같아서 또 상담하게 돼요.',array['#자미두수','#매일'])
on conflict do nothing;

