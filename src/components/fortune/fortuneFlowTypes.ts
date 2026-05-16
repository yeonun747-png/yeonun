import type { Character } from "@/lib/data/characters";
import type { Product } from "@/lib/data/content";
import type { FortuneQuestionItem } from "@/lib/fortune-ux/defaultQuestions";
import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";
import type { ManseRyeokData } from "@/lib/manse-ryeok";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

/** 8 = 풀이 결과(상품별 추가 입력 스텝 삽입 시에만 사용) */
export type FortuneStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type SlideDirection = "forward" | "back";
export type MascotKind = "yeon" | "un";
export type MascotPosKey = "welcome" | "center" | "tl" | "tr" | "bl" | "br" | "mr" | "rt";

export type FortuneFlowForm = FortuneBirthPayload;

export type FortuneGuideState = {
  mascot: MascotKind;
  pos: MascotPosKey;
  text: string;
  name: string;
  clip?: string;
};

export type FortuneResultState = {
  toc: FortuneTocItem[];
  tocGroups: FortuneTocMainGroup[] | null;
  sectionHtml: Record<number, string>;
  /** 섹션별 section_end 수신 인덱스 — PART 완료 판정용 */
  doneIdx: number[];
  claudeHtml: string;
  claudeMode: boolean;
  complete: boolean;
  orderNo: string | null;
};

export type FortuneStepSharedProps = {
  product: Product;
  character: Character | null;
  characterDisplayName: string;
  form: FortuneFlowForm;
  manse: ManseRyeokData | null;
  questions: readonly FortuneQuestionItem[];
};
