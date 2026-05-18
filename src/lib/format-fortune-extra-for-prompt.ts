import type { FortuneProductExtraConfig } from "@/lib/fortune-product-extra-config";
import type { FortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";
import {
  buildTaekilFortuneExtraContext,
  readTaekilInputsFromAnswers,
  TAEKIL_GOODDAY_SLUG,
} from "@/lib/taekil-goodday";

function choiceDisplayLabel(
  options: FortuneProductExtraConfig["fields"][number]["options"],
  value: string,
): string {
  if (!options?.length) return value;
  for (const o of options) {
    if (typeof o === "string") {
      if (o === value) return o;
    } else if (o.value === value) {
      return o.label;
    }
  }
  return value;
}

/** Claude user 블록에 붙일 상품별 추가 입력 섹션 (한국어 평문) */
export function formatFortuneExtraForPrompt(cfg: FortuneProductExtraConfig, answers: FortuneExtraAnswers): string {
  if (cfg.slug === TAEKIL_GOODDAY_SLUG) {
    const { purpose, period, spouseBirth } = readTaekilInputsFromAnswers(answers);
    if (!purpose || !period) return "";
    return buildTaekilFortuneExtraContext({ purpose, period, spouseBirth });
  }

  const lines: string[] = ["[상품별 추가 입력]"];
  for (const f of cfg.fields) {
    const v = String(answers[f.id] ?? "").trim();
    if (!v && !f.required) continue;
    const display = f.kind === "choice" ? choiceDisplayLabel(f.options, v) : v;
    lines.push(`- ${f.label}: ${display || "(미입력)"}`);
  }
  if (lines.length <= 1) return "";
  return lines.join("\n");
}
