import type { SajuInputProfile } from "@/lib/data/content";
import { fortuneProductHasExtraInputs } from "@/lib/fortune-product-extra-config";
import type { FortuneStep } from "@/components/fortune/fortuneFlowTypes";

export type FortuneStepLayout = {
  hasProductExtras: boolean;
  /** 추가 입력(있을 때만 스텝 2) */
  stepExtra: 2;
  stepCharIntro: FortuneStep;
  stepMyungsik: FortuneStep;
  stepOhaeng: FortuneStep;
  stepQuestions: FortuneStep;
  stepPreview: FortuneStep;
  stepResult: FortuneStep;
};

export function getFortuneStepLayout(productSlug: string, sajuInputProfile?: SajuInputProfile): FortuneStepLayout {
  const hasProductExtras = fortuneProductHasExtraInputs(productSlug, { sajuInputProfile });
  if (!hasProductExtras) {
    return {
      hasProductExtras: false,
      stepExtra: 2,
      stepCharIntro: 2,
      stepMyungsik: 3,
      stepOhaeng: 4,
      stepQuestions: 5,
      stepPreview: 6,
      stepResult: 7,
    };
  }
  return {
    hasProductExtras: true,
    stepExtra: 2,
    stepCharIntro: 3,
    stepMyungsik: 4,
    stepOhaeng: 5,
    stepQuestions: 6,
    stepPreview: 7,
    stepResult: 8,
  };
}
