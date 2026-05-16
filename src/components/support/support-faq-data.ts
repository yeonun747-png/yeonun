export type SupportFaqBlock =
  | { type: "p"; text: string }
  | { type: "section"; title: string; lines: string[] };

export type SupportFaqItem = {
  id: string;
  question: string;
  blocks: SupportFaqBlock[];
};

export const SUPPORT_FAQ_ITEMS: SupportFaqItem[] = [
  {
    id: "payment",
    question: "결제는 어떻게 진행되나요?",
    blocks: [
      {
        type: "p",
        text: "연운은 구독 없이 원하는 점사만 골라 결제하는 건당 결제 서비스입니다.",
      },
      {
        type: "section",
        title: "결제 수단",
        lines: [
          "신용카드·체크카드, 휴대폰 결제, 크레딧 결제 3가지를 지원합니다.",
          "크레딧은 신용카드·체크카드 또는 휴대폰 결제로만 충전할 수 있습니다.",
        ],
      },
      {
        type: "section",
        title: "결제 흐름",
        lines: ["원하는 점사 상품 선택 → 결제 수단 선택 → 결제 완료 → 즉시 점사 시작"],
      },
      {
        type: "section",
        title: "영수증",
        lines: [
          "결제 완료 후 가입 시 연동한 이메일로 영수증이 발송됩니다.",
          "마이탭 → 구매 내역에서도 확인할 수 있습니다.",
        ],
      },
    ],
  },
  {
    id: "voice-credit",
    question: "음성 크레딧은 어떻게 사용하나요?",
    blocks: [
      {
        type: "p",
        text: "음성 크레딧은 캐릭터와의 실시간 음성 상담에 사용하는 포인트입니다.",
      },
      {
        type: "section",
        title: "크레딧 충전",
        lines: ["마이탭 → 크레딧 충전에서 신용카드·체크카드 또는 휴대폰 결제로 충전할 수 있습니다."],
      },
      {
        type: "section",
        title: "크레딧 사용",
        lines: [
          "음성 상담 시작 시 분당 일정 크레딧이 차감됩니다.",
          "상담 중 잔여 크레딧이 실시간으로 표시됩니다.",
          "크레딧이 부족하면 상담이 자동 종료됩니다.",
        ],
      },
      {
        type: "section",
        title: "잔여 크레딧 확인",
        lines: ["마이탭 상단 크레딧 카드에서 실시간으로 확인할 수 있습니다."],
      },
      {
        type: "section",
        title: "유효기간",
        lines: [
          "충전 후 1년 이내에 사용해야 합니다.",
          "유효기간 만료 전 앱 알림으로 안내드립니다.",
          "만료된 크레딧은 복구되지 않습니다.",
        ],
      },
    ],
  },
  {
    id: "chat-credit",
    question: "채팅 크레딧은 어떻게 사용하나요?",
    blocks: [
      {
        type: "p",
        text: "채팅 크레딧은 캐릭터와의 텍스트 채팅 상담에 사용하는 포인트입니다.",
      },
      {
        type: "section",
        title: "크레딧 차감 방식",
        lines: [
          "채팅방 입장 시 130 크레딧이 차감됩니다.",
          "메시지를 보낼 때마다 130 크레딧이 추가 차감됩니다.",
        ],
      },
      {
        type: "section",
        title: "예시",
        lines: [
          "채팅방에 입장하고 메시지 3개를 보낸 경우",
          "→ 입장 130 + 메시지 3개 × 130 = 총 520 크레딧 차감",
        ],
      },
      {
        type: "section",
        title: "크레딧 충전",
        lines: ["마이탭 → 크레딧 충전에서 신용카드·체크카드 또는 휴대폰 결제로 충전할 수 있습니다."],
      },
      {
        type: "section",
        title: "잔여 크레딧 확인",
        lines: ["마이탭 상단 크레딧 카드에서 실시간으로 확인할 수 있습니다."],
      },
      {
        type: "section",
        title: "유효기간",
        lines: ["충전 후 1년 이내에 사용해야 합니다.", "만료된 크레딧은 복구되지 않습니다."],
      },
    ],
  },
  {
    id: "saju-edit",
    question: "사주 정보를 어떻게 수정하나요?",
    blocks: [
      {
        type: "p",
        text: "마이탭 → 내 사주 명식 → 수정 버튼을 탭하면 수정할 수 있습니다.",
      },
      {
        type: "section",
        title: "수정 가능 항목",
        lines: ["이름, 생년월일(양력/음력), 출생시간, 성별"],
      },
      {
        type: "section",
        title: "수정 시 유의사항",
        lines: [
          "사주 정보를 수정하면 이후 결제하는 점사부터 새 정보가 적용됩니다.",
          "이미 완료된 점사 콘텐츠는 수정 전 정보를 기준으로 생성된 것이므로 변경되지 않습니다.",
          "출생시간을 모르는 경우 \"모름\"으로 설정하면 시주를 제외한 사주로 풀이됩니다.",
        ],
      },
      {
        type: "section",
        title: "수정 횟수",
        lines: ["수정 횟수에 제한이 없습니다."],
      },
    ],
  },
  {
    id: "library-extend",
    question: "보관함 만료 전 연장이 가능한가요?",
    blocks: [
      {
        type: "p",
        text: "연운 점사 콘텐츠는 결제 후 보관함에 저장되어 반복 열람이 가능합니다.",
      },
      {
        type: "section",
        title: "기본 보관 기간",
        lines: ["결제일로부터 1년간 보관됩니다."],
      },
      {
        type: "section",
        title: "연장 방법",
        lines: [
          "마이탭 → 보관함에서 만료 예정 콘텐츠를 확인할 수 있습니다.",
          "만료 30일 전부터 연장 버튼이 활성화됩니다.",
          "연장 1회당 1년이 추가됩니다.",
          "연장 비용은 원래 상품가의 10%입니다.",
        ],
      },
      {
        type: "section",
        title: "만료 안내",
        lines: ["만료 30일 전, 7일 전에 앱 알림으로 안내드립니다."],
      },
      {
        type: "section",
        title: "만료 후",
        lines: [
          "만료된 콘텐츠는 보관함에서 삭제되며 복구되지 않습니다.",
          "동일 상품을 다시 구매하면 새로운 점사가 생성됩니다.",
        ],
      },
    ],
  },
];

export const SUPPORT_FAQ_EMAIL = "support@yeonun.com";
