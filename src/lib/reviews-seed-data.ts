/** 런칭 showcase 리뷰 12건 — 지시서 텍스트 그대로 */
export type ShowcaseReviewSeed = {
  id: string;
  product_slug: string;
  user_mask: string;
  stars: number;
  body: string;
  tags: string[];
  character_key: "yeon" | "yeo" | "un" | "byeol";
  product_label: string;
  reviewed_on: string;
  sort_order: number;
};

export const SHOWCASE_REVIEWS_SEED: ShowcaseReviewSeed[] = [
  {
    id: "a1000001-0001-4001-8001-000000000001",
    product_slug: "reunion-maybe",
    user_mask: "이** (31세, 여)",
    stars: 5,
    body: "상대방 일주 알려줬더니 두 사람 합충 분석까지 해줬어요. 다른곳에서 사주 봤을때랑 다르게 구체적으로 설명해줘서 이해가 잘 됐음. 5월에 연락올 가능성 있다고 했는데 기다려봄ㅎ",
    tags: ["#재회", "#연화", "#합충분석"],
    character_key: "yeon",
    product_label: "재회 분석",
    reviewed_on: "2026-04-28",
    sort_order: 12,
  },
  {
    id: "a1000001-0001-4001-8001-000000000002",
    product_slug: "saju-classic",
    user_mask: "최** (38세, 남)",
    stars: 3,
    body: "내용 자체는 꽤 자세한데 나쁜 운에 대해선 좀 돌려말하는 경향이 있었어요. 직접적으로 말해줬으면 더 좋았겠지만 전반적으론 만족. 크레딧 좀 비싼편이라고 생각함",
    tags: ["#정통사주", "#여연", "#아쉬운점있음"],
    character_key: "yeo",
    product_label: "정통 사주풀이",
    reviewed_on: "2026-04-27",
    sort_order: 11,
  },
  {
    id: "a1000001-0001-4001-8001-000000000003",
    product_slug: "dream-lastnight",
    user_mask: "박** (29세, 여)",
    stars: 5,
    body: "4900원인데 제 사주랑 연결해서 풀어줘서 놀랬어요. 그냥 일반적인 해몽 말고 제 일간이랑 연결해서 설명해줌. 가성비 좋음",
    tags: ["#꿈해몽", "#운서", "#가성비"],
    character_key: "un",
    product_label: "꿈해몽",
    reviewed_on: "2026-04-27",
    sort_order: 10,
  },
  {
    id: "a1000001-0001-4001-8001-000000000004",
    product_slug: "newyear-2026",
    user_mask: "김** (26세, 여)",
    stars: 5,
    body: "월별로 나눠서 설명해주는게 진짜 유용함. 올 3월에 변화있을거라고 했는데 실제로 이직 제안이 왔어요ㄷㄷ 이번에 5월운도 보려고 또 왔습니다",
    tags: ["#신년운세", "#별하", "#적중"],
    character_key: "byeol",
    product_label: "2026 신년운세",
    reviewed_on: "2026-04-26",
    sort_order: 9,
  },
  {
    id: "a1000001-0001-4001-8001-000000000005",
    product_slug: "mind-now",
    user_mask: "정** (33세, 여)",
    stars: 2,
    body: "음성 연결이 두번 끊겼어요. 내용 자체는 나쁘지 않은데 기술적인 부분이 아직 불안정한 것 같아서 아쉬웠음. 개선되면 다시 써볼 의향은 있습니다",
    tags: ["#음성상담", "#연결오류"],
    character_key: "yeon",
    product_label: "음성 상담",
    reviewed_on: "2026-04-26",
    sort_order: 8,
  },
  {
    id: "a1000001-0001-4001-8001-000000000006",
    product_slug: "lifetime-master",
    user_mask: "강** (45세, 남)",
    stars: 5,
    body: "평생사주 받았는데 분량이 어마어마합니다. 읽는데 40분 걸렸어요. 보관함에 저장돼서 여러번 다시 읽을수 있는게 좋았어요. 대운 흐름 설명이 특히 좋았고 지금 제 상황이랑 딱 맞아서 소름. 가격도 이 분량이면 납득됩니다",
    tags: ["#평생사주", "#여연", "#대운", "#통합본"],
    character_key: "yeo",
    product_label: "초년·장년·중년·말년 통합본",
    reviewed_on: "2026-04-25",
    sort_order: 7,
  },
  {
    id: "a1000001-0001-4001-8001-000000000007",
    product_slug: "mind-now",
    user_mask: "한** (27세, 여)",
    stars: 4,
    body: "채팅이라서 편하게 물어볼수 있어서 좋았어요. 근데 입장할때 크레딧이 한번에 많이 빠져서 당황했음. 메시지 보낼때마다 또 빠지는거 미리 안내가 좀 더 명확했으면 좋겠어요. 내용은 만족",
    tags: ["#채팅상담", "#연화", "#크레딧안내"],
    character_key: "yeon",
    product_label: "채팅 상담",
    reviewed_on: "2026-04-25",
    sort_order: 6,
  },
  {
    id: "a1000001-0001-4001-8001-000000000008",
    product_slug: "naming-baby",
    user_mask: "오** (34세, 여)",
    stars: 5,
    body: "아이 이름 고민 3개월 했는데 드디어 결정했습니다. 한자 획수에 오행까지 꼼꼼히 봐주고 후보 3개 비교해줘서 선택하기 좋았어요. 남편도 마음에 들어했음. 감사합니다",
    tags: ["#작명", "#운서", "#신생아"],
    character_key: "un",
    product_label: "아이 이름 작명",
    reviewed_on: "2026-04-24",
    sort_order: 5,
  },
  {
    id: "a1000001-0001-4001-8001-000000000009",
    product_slug: "zimi-chart",
    user_mask: "윤** (23세, 여)",
    stars: 4,
    body: "자미두수 처음 접해봤는데 별하가 어려운 용어 바로바로 설명해줘서 이해하기 쉬웠어요. 사주랑 보는 관점이 달라서 신기함. 다만 저는 연애운 위주로 듣고 싶었는데 명반 전체 풀이라 범위가 넓었음",
    tags: ["#자미두수", "#별하", "#처음"],
    character_key: "byeol",
    product_label: "자미두수 명반 풀이",
    reviewed_on: "2026-04-24",
    sort_order: 4,
  },
  {
    id: "a1000001-0001-4001-8001-000000000010",
    product_slug: "career-timing",
    user_mask: "송** (41세, 여)",
    stars: 3,
    body: "이직 시기 물어봤는데 막연하게 하반기가 좋다고만 해서 아쉬웠어요. 좀더 구체적인 월 단위로 알려줬으면 좋겠었는데. 그래도 제 일간 특성 분석은 공감 많이 됐어요",
    tags: ["#커리어", "#이직", "#아쉬운점"],
    character_key: "yeo",
    product_label: "커리어 사주",
    reviewed_on: "2026-04-23",
    sort_order: 3,
  },
  {
    id: "a1000001-0001-4001-8001-000000000011",
    product_slug: "compat-howfar",
    user_mask: "류** (30세, 여)",
    stars: 5,
    body: "두사람 생년월일 넣으니까 합충형 다 분석해줌. 좋은것만 말하는게 아니라 우리 사이에 충 있는것도 솔직하게 말해줘서 오히려 신뢰갔어요. 이 부분 보완하면 된다고 방향도 알려줌",
    tags: ["#궁합", "#연화", "#솔직한풀이"],
    character_key: "yeon",
    product_label: "두 사람 궁합",
    reviewed_on: "2026-04-22",
    sort_order: 2,
  },
  {
    id: "a1000001-0001-4001-8001-000000000012",
    product_slug: "taekil-goodday",
    user_mask: "남** (36세, 남)",
    stars: 4,
    body: "결혼날짜 3개 후보 줬는데 일진 설명까지 같이 해줘서 이해하기 좋았어요. 상견례 날짜도 같이 물어봤는데 추가로 봐줌. 다만 음력 날짜 표기가 조금 헷갈렸어요",
    tags: ["#길일", "#결혼", "#운서"],
    character_key: "un",
    product_label: "결혼 길일",
    reviewed_on: "2026-04-21",
    sort_order: 1,
  },
];

/** 런칭 기준 누적 풀이 수 (실결제 집계 전) */
export const LAUNCH_TOTAL_READINGS = 247;

export const LAUNCH_GUIDE_COUNT = 4;
