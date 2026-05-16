"use client";

import { fetchForeignScriptTranslations } from "@/lib/fortune-foreign-script-translate-client";
import {
  applyFortuneForeignGlossary,
  applyFortuneForeignReplacements,
  FORTUNE_FOREIGN_GLOSSARY,
  hasForeignScriptInFortuneText,
  findForeignScriptSegments,
  stripForeignScriptInFortuneHtml,
} from "@/lib/fortune-html-script-sanitize";

/** 용어집 + API 번역으로 치환. 실패·미설정 시 제거 폴백 */
export async function fixForeignScriptInFortuneHtmlAsync(html: string): Promise<string> {
  let s = applyFortuneForeignGlossary(html);
  if (!hasForeignScriptInFortuneText(s)) return s;

  const segments = findForeignScriptSegments(s);
  if (segments.length === 0) return s;

  const translated = await fetchForeignScriptTranslations(segments);
  s = applyFortuneForeignReplacements(s, translated);

  if (hasForeignScriptInFortuneText(s)) {
    s = stripForeignScriptInFortuneHtml(s);
  }
  return s;
}

export { FORTUNE_FOREIGN_GLOSSARY };
