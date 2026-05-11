export type FortuneExtraFieldKind = "textarea" | "text" | "date_ymd" | "gender" | "choice";

export type FortuneExtraFieldDef = {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  kind: FortuneExtraFieldKind;
  required: boolean;
  minLen?: number;
  /** choice 전용 */
  options?: string[];
};

export type FortuneProductExtraConfig = {
  slug: string;
  /** 헤더 소제목 */
  screenTitle: string;
  screenHint?: string;
  mascotBubble: string;
  fields: FortuneExtraFieldDef[];
};

const GENDER_OPTIONS = [
  { v: "male", label: "남성" },
  { v: "female", label: "여성" },
] as const;

const PURPOSE_OPTIONS = ["결혼", "이사", "개업", "기타"] as const;

/** 점사 메뉴 카드 상품 중 추가 입력이 필요한 slug만 정의합니다. */
export const FORTUNE_PRODUCT_EXTRA_BY_SLUG: Record<string, FortuneProductExtraConfig> = {
  "dream-lastnight": {
    slug: "dream-lastnight",
    screenTitle: "꿈 이야기",
    screenHint: "인물·장소·사건·느낌을 적어 주시면 더 정확해요.",
    mascotBubble: "어젯밤 꿈을 자세히 알려주세요 🌙 장면이 떠오르는 대로 편하게 적어 주세요.",
    fields: [
      {
        id: "dream_content",
        label: "꿈 내용",
        placeholder: "예: 낯선 길을 걷다 아는 사람을 만났고, 맑은 하늘이었어요",
        kind: "textarea",
        required: true,
        minLen: 30,
      },
    ],
  },
  "compat-howfar": {
    slug: "compat-howfar",
    screenTitle: "상대와 이별 맥락",
    screenHint: "상대 생년·성별은 필수예요. 멀어진 계기는 있으면 적어 주세요.",
    mascotBubble: "상대분 정보와, 두 분이 멀어지게 된 계기를 알려주세요 🌙 없으면 비워 두셔도 돼요.",
    fields: [
      {
        id: "counterpart_birth_ymd",
        label: "상대방 생년월일",
        hint: "양력 기준 연·월·일",
        kind: "date_ymd",
        required: true,
      },
      {
        id: "counterpart_gender",
        label: "상대방 성별",
        kind: "gender",
        required: true,
      },
      {
        id: "break_context",
        label: "이별·소원 계기",
        placeholder: "예: 연락이 뜸해지며 자연스럽게 멀어졌어요 (선택)",
        kind: "textarea",
        required: false,
        minLen: 0,
      },
    ],
  },
  "mind-now": {
    slug: "mind-now",
    screenTitle: "상대와 이별 맥락",
    screenHint: "상대 생년·성별은 필수예요. 멀어진 계기는 있으면 적어 주세요.",
    mascotBubble: "상대분 정보와, 두 분이 멀어지게 된 계기를 알려주세요 🌙 없으면 비워 두셔도 돼요.",
    fields: [
      {
        id: "counterpart_birth_ymd",
        label: "상대방 생년월일",
        hint: "양력 기준 연·월·일",
        kind: "date_ymd",
        required: true,
      },
      {
        id: "counterpart_gender",
        label: "상대방 성별",
        kind: "gender",
        required: true,
      },
      {
        id: "break_context",
        label: "이별·소원 계기",
        placeholder: "예: 연락이 뜸해지며 자연스럽게 멀어졌어요 (선택)",
        kind: "textarea",
        required: false,
        minLen: 0,
      },
    ],
  },
  "reunion-maybe": {
    slug: "reunion-maybe",
    screenTitle: "상대와 이별 맥락",
    screenHint: "상대 생년·성별은 필수예요. 멀어진 계기는 있으면 적어 주세요.",
    mascotBubble: "상대분 정보와, 두 분이 멀어지게 된 계기를 알려주세요 🌙 없으면 비워 두셔도 돼요.",
    fields: [
      {
        id: "counterpart_birth_ymd",
        label: "상대방 생년월일",
        hint: "양력 기준 연·월·일",
        kind: "date_ymd",
        required: true,
      },
      {
        id: "counterpart_gender",
        label: "상대방 성별",
        kind: "gender",
        required: true,
      },
      {
        id: "break_context",
        label: "이별·소원 계기",
        placeholder: "예: 연락이 뜸해지며 자연스럽게 멀어졌어요 (선택)",
        kind: "textarea",
        required: false,
        minLen: 0,
      },
    ],
  },
  "child-saju": {
    slug: "child-saju",
    screenTitle: "자녀 정보",
    screenHint: "자녀 생년월일·성별은 필수, 이름은 있으면 적어 주세요.",
    mascotBubble: "자녀분 생년월일과 성별을 알려주세요 🌸 이름이 있으면 함께 적어 주세요.",
    fields: [
      {
        id: "child_birth_ymd",
        label: "자녀 생년월일",
        hint: "양력 기준 연·월·일",
        kind: "date_ymd",
        required: true,
      },
      {
        id: "child_gender",
        label: "자녀 성별",
        kind: "gender",
        required: true,
      },
      {
        id: "child_name",
        label: "자녀 이름",
        placeholder: "예: 민준 (미정이면 비워도 돼요)",
        kind: "text",
        required: false,
      },
    ],
  },
  "taekil-goodday": {
    slug: "taekil-goodday",
    screenTitle: "길일 희망",
    screenHint: "목적과 희망 시기를 알려 주세요. 결혼이면 배우자 생일도 가능해요.",
    mascotBubble: "어떤 일의 길일을 보는지, 희망하시는 시기를 알려주세요 🌸 결혼이면 배우자 생년월일도 적어 주세요.",
    fields: [
      {
        id: "auspice_purpose",
        label: "목적",
        kind: "choice",
        required: true,
        options: [...PURPOSE_OPTIONS],
      },
      {
        id: "auspice_window",
        label: "희망 시기",
        placeholder: "예: 2026년 3월~6월",
        kind: "text",
        required: true,
      },
      {
        id: "spouse_birth_ymd",
        label: "배우자 생년월일",
        hint: "목적이 결혼일 때만 입력해 주세요 (양력)",
        kind: "date_ymd",
        required: false,
      },
    ],
  },
  "career-timing": {
    slug: "career-timing",
    screenTitle: "커리어 상황",
    screenHint: "지금 일과 고민을 알려 주세요.",
    mascotBubble: "지금 하시는 일과, 이직·승진 쪽으로 어떤 고민이 있는지 알려주세요 🌸",
    fields: [
      {
        id: "job_title",
        label: "현재 직업·직종",
        placeholder: "예: IT 개발자, 초등 교사",
        kind: "text",
        required: true,
      },
      {
        id: "career_concern",
        label: "현재 고민 상황",
        placeholder: "이직·승진·동료 관계 등 지금 마음이 가는 대로 적어 주세요",
        kind: "textarea",
        required: true,
        minLen: 10,
      },
    ],
  },
  "naming-baby": {
    slug: "naming-baby",
    screenTitle: "아이 정보",
    screenHint: "태어나지 않았다면 예정일로 선택해 주세요.",
    mascotBubble: "아이 생년월일·성별, 붙일 성씨를 알려주세요 🌙 이름에 담고 싶은 느낌이 있으면 적어 주세요.",
    fields: [
      {
        id: "baby_birth_ymd",
        label: "아이 생년월일",
        hint: "미출산 시 예정일로 선택",
        kind: "date_ymd",
        required: true,
      },
      {
        id: "baby_gender",
        label: "아이 성별",
        kind: "gender",
        required: true,
      },
      {
        id: "family_surname",
        label: "성(姓)",
        placeholder: "예: 김, 이, 박",
        kind: "text",
        required: true,
      },
      {
        id: "name_mood",
        label: "원하는 이름 느낌",
        placeholder: "예: 읽기 쉬운 한글 위주로, 가문에서 쓰는 한자 한 글자를 넣고 싶어요",
        kind: "textarea",
        required: false,
      },
    ],
  },
};

export function getFortuneProductExtraConfig(slug: string): FortuneProductExtraConfig | null {
  const k = slug.trim();
  return FORTUNE_PRODUCT_EXTRA_BY_SLUG[k] ?? null;
}

export function fortuneProductHasExtraInputs(slug: string): boolean {
  const c = getFortuneProductExtraConfig(slug);
  return Boolean(c?.fields?.length);
}

export { GENDER_OPTIONS };
