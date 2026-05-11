import type { FortuneProductExtraConfig } from "@/lib/fortune-product-extra-config";
import type { FortuneExtraAnswers } from "@/lib/fortune-extra-input-storage";

/** Claude user 블록에 붙일 상품별 추가 입력 섹션 (한국어 평문) */
export function formatFortuneExtraForPrompt(cfg: FortuneProductExtraConfig, answers: FortuneExtraAnswers): string {
  const lines: string[] = ["[상품별 추가 입력]"];
  for (const f of cfg.fields) {
    const v = String(answers[f.id] ?? "").trim();
    if (!v && !f.required) continue;
    lines.push(`- ${f.label}: ${v || "(미입력)"}`);
  }
  if (lines.length <= 1) return "";
  return lines.join("\n");
}
