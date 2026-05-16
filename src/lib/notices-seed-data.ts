import type { NoticeCategory } from "@/lib/notices-types";

export type NoticeSeedRow = {
  slug: string;
  category: NoticeCategory;
  title: string;
  published_on: string;
  sort_order: number;
  show_new_dot: boolean;
  body: string;
};

/** 런칭 시 공지 7건 — 목록 최신순(#1이 상단) */
export const NOTICES_SEED_DATA: NoticeSeedRow[] = [
  {
    slug: "chat-consult-4-characters",
    category: "update",
    title: "4명 채팅 상담 오픈 — 연화·별하·여연·운서",
    published_on: "2026-04-26",
    sort_order: 700,
    show_new_dot: true,
    body: `이제 채팅으로도 인연 안내자를 만날 수 있습니다.

[채팅 상담 이용 방법]
만남 탭 → 원하는 캐릭터 선택 → 채팅 상담 시작

[요금]
채팅방 입장 시 1,170 크레딧 차감
메시지를 보낼 때마다 130 크레딧 추가 차감

예시: 입장 + 메시지 5개 = 1,170 + (130×5) = 1,820 크레딧

[채팅 상담 특징]
연화 — 재회·연애·궁합, 감정의 결을 읽어드려요
별하 — 자미두수·신년운세, 별의 흐름을 풀어드려요
여연 — 정통사주·평생운, 명리학의 깊이로 답해드려요
운서 — 작명·택일·꿈해몽, 묵직하고 신중하게 살펴드려요

[채팅 보관함]
상담 기록은 채팅 상담 보관함에 30일간 저장됩니다.
마이탭 → 채팅상담 보관함에서 확인하세요.

크레딧 충전은 마이탭 → 크레딧 충전에서 이용 가능합니다.`,
  },
  {
    slug: "launch-free-3min-voice",
    category: "event",
    title: "런칭 기념 — 첫 3분 음성 상담 무료 체험",
    published_on: "2026-05-26",
    sort_order: 600,
    show_new_dot: true,
    body: `연운이 정식 오픈했습니다.

런칭을 기념하여 가입 즉시 음성 상담 3분을 무료로 제공합니다.
카드 등록 없이, 4명의 인연 안내자 중 누구와도 바로 시작할 수 있습니다.

[혜택 내용]
- 가입 즉시 음성 상담 3분 무료 (1회)
- 카드 등록 불필요
- 4명 안내자 모두 선택 가능

지금 바로 만나보세요.`,
  },
  {
    slug: "launch-text-first-10pct",
    category: "event",
    title: "첫 텍스트 풀이 구매 시 10% 할인",
    published_on: "2026-05-26",
    sort_order: 500,
    show_new_dot: true,
    body: `런칭 기간 동안 첫 번째 텍스트 풀이 구매 시 10% 할인이 적용됩니다.

[적용 상품]
- 17개 텍스트 풀이 전 상품 적용
- 최초 1회 구매에 한함
- 결제 화면에서 자동 적용

기간: 2026.05.26 ~ 2026.12.31`,
  },
  {
    slug: "launch-official-open",
    category: "update",
    title: "연운 정식 서비스 오픈",
    published_on: "2026-05-26",
    sort_order: 400,
    show_new_dot: true,
    body: `안녕하세요. 연운입니다.

천 년의 명리학과 4명의 인연 안내자가 함께하는
운세 상담 서비스 연운이 정식 오픈했습니다.

[이용 가능한 서비스]
음성 상담 — 연화·별하·여연·운서와 실시간 대화
채팅 상담 — 텍스트로 편하게 묻고 답하기
텍스트 풀이 — 17개 상품, 결제 후 보관함에서 반복 열람

[이용 안내]
음성 상담: 분당 390 크레딧
채팅 상담: 입장 시 1,170 크레딧 + 메시지당 130 크레딧
텍스트 풀이: 4,900원 ~ 49,900원 (건당 결제)

앞으로도 더 좋은 서비스로 찾아뵙겠습니다.
연운 드림`,
  },
  {
    slug: "launch-text-17-products",
    category: "update",
    title: "텍스트 풀이 17종 전체 오픈",
    published_on: "2026-05-26",
    sort_order: 300,
    show_new_dot: false,
    body: `오늘부터 텍스트 풀이 17개 상품이 모두 이용 가능합니다.

[신규 오픈 상품]
재회·연애·궁합 — 그 사람과 다시 만날 수 있을까, 두 사람 어디까지 이어질까 외
사주·평생운 — 정통 사주풀이 종합, 초년·장년·중년·말년 통합본 외
신년·자미두수 — 2026 신년운세 1년표, 자미두수 명반 풀이 외
작명·택일 — 아이 이름 작명, 결혼·이사·개업 길일 외
꿈해몽·자녀 — 어젯밤 꿈 무엇을 말하나, 자녀 사주 외

풀이 탭에서 전체 목록을 확인하세요.`,
  },
  {
    slug: "terms-privacy-guide",
    category: "notice",
    title: "서비스 이용약관 및 개인정보처리방침 안내",
    published_on: "2026-05-26",
    sort_order: 200,
    show_new_dot: false,
    body: `연운 서비스 이용에 앞서 아래 약관을 확인해 주세요.

이용약관 및 개인정보처리방침은 마이탭 하단에서
언제든지 확인하실 수 있습니다.

주요 내용:
- 서비스 이용 조건 및 결제 정책
- 크레딧 충전·환불 규정
- 개인정보 수집·이용 범위
- 보관함 콘텐츠 보관 기간
  (텍스트 풀이 60일 / 음성 60일 / 채팅 30일)

문의: support@yeonun.com`,
  },
  {
    slug: "payment-methods-guide",
    category: "notice",
    title: "결제 수단 안내",
    published_on: "2026-05-26",
    sort_order: 100,
    show_new_dot: false,
    body: `연운에서 이용 가능한 결제 수단을 안내드립니다.

[결제 수단 3가지]
1. 신용카드·체크카드
2. 휴대폰 결제
3. 크레딧 결제

크레딧은 신용카드·체크카드 또는
휴대폰 결제로만 충전할 수 있습니다.

결제 관련 문의: support@yeonun.com`,
  },
];
