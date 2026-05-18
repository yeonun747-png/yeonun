import type { FortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";
import type { FortuneMenuPayload } from "@/lib/product-fortune-menu";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

export const TAEKIL_GOODDAY_SLUG = "taekil-goodday";

/** 6대×2소 전체 소메뉴 수 */
export const TAEKIL_FLAT_SECTION_COUNT_FULL = 12;

/** 목적별 5-1/5-2 분기 후 스트림·저장본 소메뉴 수 */
export const TAEKIL_FLAT_SECTION_COUNT_FILTERED = 11;

/**
 * 보관함 재생 시 taekil 필터 적용 여부.
 * 스트림이 이미 11개로 저장한 본문에 12칸 기준 필터를 다시 쓰면 6-1 본문이 빠져 목차만 보임.
 */
export function needsTaekilLibraryReplayFilter(storedSectionCount: number): boolean {
  return storedSectionCount === TAEKIL_FLAT_SECTION_COUNT_FULL;
}

export const PURPOSE = {
  WEDDING: "wedding",
  MOVING: "moving",
  BUSINESS: "business",
  OTHER: "other",
} as const;

export type PurposeType = (typeof PURPOSE)[keyof typeof PURPOSE];

export const PURPOSE_LABEL: Record<PurposeType, string> = {
  wedding: "결혼",
  moving: "이사",
  business: "개업",
  other: "기타",
};

const PURPOSE_FROM_LABEL: Record<string, PurposeType> = {
  결혼: PURPOSE.WEDDING,
  이사: PURPOSE.MOVING,
  개업: PURPOSE.BUSINESS,
  기타: PURPOSE.OTHER,
  wedding: PURPOSE.WEDDING,
  moving: PURPOSE.MOVING,
  business: PURPOSE.BUSINESS,
  other: PURPOSE.OTHER,
};

export function normalizeTaekilPurpose(raw: string | null | undefined): PurposeType | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return PURPOSE_FROM_LABEL[t] ?? null;
}

export function readTaekilInputsFromAnswers(answers: FortuneExtraAnswers): {
  purpose: PurposeType | null;
  period: string;
  spouseBirth: string | null;
} {
  const purpose = normalizeTaekilPurpose(answers.auspice_purpose);
  const period = String(answers.auspice_window ?? "").trim();
  const spouseRaw = String(answers.spouse_birth_ymd ?? "").trim();
  const spouseBirth =
    purpose === PURPOSE.WEDDING && spouseRaw ? spouseRaw : null;
  return { purpose, period, spouseBirth };
}

export function showMenu5_1(purpose: PurposeType): boolean {
  return purpose === PURPOSE.WEDDING;
}

export function showMenu5_2(purpose: PurposeType): boolean {
  return purpose !== PURPOSE.WEDDING;
}

export const MENU_1_1_INTRO: Record<PurposeType, string> = {
  wedding:
    "같은 날이라도 내 사주의 대운·세운과 어떻게 맞물리느냐에 따라 그 날의 기운이 달라집니다. " +
    "이 소메뉴는 현재 대운과 2026년 세운을 분석하여 결혼에 가장 최적화된 운기 구간을 먼저 파악해 드립니다.",
  moving:
    "같은 날이라도 내 사주의 대운·세운과 어떻게 맞물리느냐에 따라 그 날의 기운이 달라집니다. " +
    "이 소메뉴는 현재 대운과 2026년 세운을 분석하여 이사에 가장 최적화된 운기 구간을 먼저 파악해 드립니다.",
  business:
    "같은 날이라도 내 사주의 대운·세운과 어떻게 맞물리느냐에 따라 그 날의 기운이 달라집니다. " +
    "이 소메뉴는 현재 대운과 2026년 세운을 분석하여 개업에 가장 최적화된 운기 구간을 먼저 파악해 드립니다.",
  other:
    "같은 날이라도 내 사주의 대운·세운과 어떻게 맞물리느냐에 따라 그 날의 기운이 달라집니다. " +
    "이 소메뉴는 현재 대운과 2026년 세운을 분석하여 중요한 일을 시작하기에 가장 좋은 운기 구간을 파악해 드립니다.",
};

export const MENU_5_2_TITLE: Record<Exclude<PurposeType, "wedding">, string> = {
  moving: "이사 — 방향·시각·배치 완전 가이드",
  business: "개업 — 방향·시각·배치 완전 가이드",
  other: "기타 목적 — 방향·시각·배치 완전 가이드",
};

export const MENU_5_2_INTRO: Record<Exclude<PurposeType, "wedding">, string> = {
  moving:
    "이사는 공간의 기운을 다루는 일입니다. 어느 방향으로 짐을 넣고, " +
    "어느 위치에 중요한 것을 배치하느냐가 새로운 시작의 기운을 좌우합니다. " +
    "이 소메뉴는 이사의 세부 실천 가이드를 안내합니다.",
  business:
    "개업은 공간의 기운을 다루는 일입니다. 첫 손님을 맞이하는 방향, 금전 보관 위치, " +
    "영업 시작 시각이 새로운 시작의 기운을 좌우합니다. " +
    "이 소메뉴는 개업의 세부 실천 가이드를 안내합니다.",
  other:
    "중요한 일을 시작하는 날, 공간의 방향과 시각 하나가 기운의 차이를 만듭니다. " +
    "이 소메뉴는 입력하신 목적에 맞는 방향·시각·실천 가이드를 안내합니다.",
};

export function taekilSectionKey(mainMenuIndex: number, subMenuIndex: number): string {
  return `${mainMenuIndex + 1}-${subMenuIndex + 1}`;
}

export function taekilSectionKeyFromFlatIndex(flatIndex: number): string {
  const main = Math.floor(flatIndex / 2) + 1;
  const sub = (flatIndex % 2) + 1;
  return `${main}-${sub}`;
}

export function isTaekilSectionKeyVisible(key: string, purpose: PurposeType): boolean {
  if (key === "5-1") return showMenu5_1(purpose);
  if (key === "5-2") return showMenu5_2(purpose);
  return true;
}

export function getSpouseInstruction(purpose: PurposeType, spouseBirth?: string | null): string {
  if (purpose !== PURPOSE.WEDDING) return "";
  if (spouseBirth?.trim()) {
    return `배우자 생년월일(${spouseBirth.trim()})이 입력되었습니다. 두 사람 모두에게 길한 날 분석을 반드시 포함하십시오.`;
  }
  return "배우자 생년월일이 입력되지 않았습니다. 본인 사주 기준으로만 분석하십시오. 배우자 관련 항목은 생략하십시오.";
}

const GEMINI_MENU_BASE = ["1-2", "2-1", "2-2", "3-1", "3-2", "4-1", "4-2", "6-1", "6-2"] as const;

export function getGeminiMenuList(purpose: PurposeType): string[] {
  if (purpose === PURPOSE.WEDDING) {
    return [...GEMINI_MENU_BASE, "5-1"];
  }
  return [...GEMINI_MENU_BASE, "5-2"];
}

export function buildTaekilFortuneExtraContext(inputs: {
  purpose: PurposeType;
  period: string;
  spouseBirth?: string | null;
}): string {
  const { purpose, period, spouseBirth } = inputs;
  const lines = [
    "[택일 추가 입력]",
    `- 선택한 목적: ${PURPOSE_LABEL[purpose]} (${purpose})`,
    `- 희망 시기 범위: ${period}`,
    `- 배우자 생년월일: ${spouseBirth?.trim() || "미입력"}`,
    "",
    "[목적별 해석 기준]",
    purpose === PURPOSE.WEDDING
      ? "인연성 활성화 + 합운 기준. 배우자 생년월일이 있으면 두 사람 공통 길일 분석을 포함합니다."
      : purpose === PURPOSE.MOVING
        ? "이동 길운 + 역마 활성 기준. 짐 방향·입주 시각·가구 배치 중심 조언."
        : purpose === PURPOSE.BUSINESS
          ? "재성·관성 활성화 기준. 첫 손님 방향·금전 보관 위치·영업 시작 시각 중심 조언."
          : "사주 용신 기운이 강한 날 기준. 이사·개업 기준을 참고하되 특정 목적에 국한하지 않습니다.",
    getSpouseInstruction(purpose, spouseBirth),
    "",
    "[출력 규칙]",
    "모든 점사 내용은 한글로만 작성하십시오.",
    "한자 표기 절대 금지. 천간지지도 한글로만 표기.",
    "AI임을 어떠한 경우에도 절대 밝히지 않습니다.",
  ];
  return lines.filter(Boolean).join("\n");
}

function enrichSubMenuForTaekil(
  mainMenuIndex: number,
  subMenuIndex: number,
  sub: { title: string; interpretation_prompt: string },
  purpose: PurposeType,
): { title: string; interpretation_prompt: string } {
  const key = taekilSectionKey(mainMenuIndex, subMenuIndex);
  let title = sub.title;
  let interpretation_prompt = sub.interpretation_prompt;

  if (key === "1-1") {
    const intro = MENU_1_1_INTRO[purpose];
    if (intro && !interpretation_prompt.includes(intro.slice(0, 24))) {
      interpretation_prompt = `[소개]\n${intro}\n\n${interpretation_prompt}`.trim();
    }
  }

  if (key === "5-2" && showMenu5_2(purpose)) {
    const p = purpose as Exclude<PurposeType, "wedding">;
    title = MENU_5_2_TITLE[p];
    const intro = MENU_5_2_INTRO[p];
    if (intro && !interpretation_prompt.includes(intro.slice(0, 20))) {
      interpretation_prompt = `[소개]\n${intro}\n\n${interpretation_prompt}`.trim();
    }
  }

  return { title, interpretation_prompt };
}

/** 목적에 따라 대메뉴 5 소메뉴 분기 — 스트림·TOC 생성 전 적용 */
export function filterTaekilMenuForPurpose(menu: FortuneMenuPayload, purpose: PurposeType): FortuneMenuPayload {
  const main_menus = menu.main_menus.map((m, mi) => {
    const subs = (m.sub_menus ?? [])
      .map((s, si) => {
        const key = taekilSectionKey(mi, si);
        if (!isTaekilSectionKeyVisible(key, purpose)) return null;
        const enriched = enrichSubMenuForTaekil(mi, si, s, purpose);
        return { ...s, ...enriched };
      })
      .filter((s): s is NonNullable<typeof s> => s != null);
    return { ...m, sub_menus: subs };
  });
  return { main_menus };
}

export type TaekilFortuneResultSlice = {
  toc: FortuneTocItem[];
  tocGroups: FortuneTocMainGroup[] | null;
  sectionHtml: Record<number, string>;
  doneIdx: number[];
};

/** 보관함 재생·구버전 12섹션 저장본 — 목적에 맞게 목차·본문 재인덱싱 */
export function filterTaekilFortuneResult(
  state: TaekilFortuneResultSlice,
  purpose: PurposeType,
): TaekilFortuneResultSlice {
  const indexMap: number[] = [];
  const newToc: FortuneTocItem[] = [];

  for (let i = 0; i < state.toc.length; i++) {
    const key = taekilSectionKeyFromFlatIndex(i);
    if (!isTaekilSectionKeyVisible(key, purpose)) continue;
    indexMap.push(i);
    const item = state.toc[i];
    if (!item) continue;
    if (key === "5-2" && showMenu5_2(purpose)) {
      const p = purpose as Exclude<PurposeType, "wedding">;
      newToc.push({ ...item, title: MENU_5_2_TITLE[p] });
    } else {
      newToc.push({ ...item });
    }
  }

  const newSectionHtml: Record<number, string> = {};
  const newDoneIdx: number[] = [];
  const doneSet = new Set(state.doneIdx);

  indexMap.forEach((oldIdx, newIdx) => {
    const html = state.sectionHtml[oldIdx];
    if (html) newSectionHtml[newIdx] = html;
    if (doneSet.has(oldIdx)) newDoneIdx.push(newIdx);
  });

  let newTocGroups: FortuneTocMainGroup[] | null = state.tocGroups;
  if (state.tocGroups?.length && indexMap.length !== state.toc.length) {
    const remapped: FortuneTocMainGroup[] = [];
    for (const g of state.tocGroups) {
      const subs = (g.subs ?? [])
        .filter((s) => indexMap.includes(s.sectionIndex))
        .map((s) => {
          const newIdx = indexMap.indexOf(s.sectionIndex);
          const oldKey = taekilSectionKeyFromFlatIndex(s.sectionIndex);
          let title = s.title;
          if (oldKey === "5-2" && showMenu5_2(purpose)) {
            title = MENU_5_2_TITLE[purpose as Exclude<PurposeType, "wedding">];
          }
          return { ...s, sectionIndex: newIdx, title };
        });
      if (subs.length) remapped.push({ ...g, subs });
    }
    newTocGroups = remapped.length ? remapped : null;
  }

  return {
    toc: newToc,
    tocGroups: newTocGroups,
    sectionHtml: newSectionHtml,
    doneIdx: newDoneIdx,
  };
}

/** 스트림 API 본문에 붙일 택일 전용 필드 */
export function readTaekilStreamBodyFields(productSlug: string, answers: FortuneExtraAnswers): Record<string, string> {
  if (productSlug !== TAEKIL_GOODDAY_SLUG) return {};
  const { purpose, period, spouseBirth } = readTaekilInputsFromAnswers(answers);
  if (!purpose || !period) return {};
  return {
    taekil_purpose: purpose,
    taekil_period: period,
    ...(spouseBirth ? { taekil_spouse_birth: spouseBirth } : {}),
  };
}
