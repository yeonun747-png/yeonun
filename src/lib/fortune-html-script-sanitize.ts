/**
 * 점사 HTML/텍스트에서 LLM이 가끔 섞는 키릴·그리스 등을
 * 용어집으로 즉시 치환하거나, 비동기 번역 모듈로 한국어로 바꾼다.
 */

import { findForeignScriptSegments, foreignScriptNeedsTranslation } from "@/lib/fortune-foreign-script-detect";

const FOREIGN_SCRIPT_PATTERNS: RegExp[] = [
  /[\u0400-\u04FF]/gu,
  /[\u0500-\u052F]/gu,
  /[\u2DE0-\u2DFF]/gu,
  /[\uA640-\uA69F]/gu,
  /[\u0370-\u03FF]/gu,
  /[\u1F00-\u1FFF]/gu,
  /[\u0590-\u05FF]/gu,
  /[\u0600-\u06FF]/gu,
  /[\u0750-\u077F]/gu,
  /[\u08A0-\u08FF]/gu,
  /[\u0900-\u097F]/gu,
  /[\u0980-\u09FF]/gu,
  /[\u0A00-\u0AFF]/gu,
  /[\u0B00-\u0B7F]/gu,
  /[\u0B80-\u0BFF]/gu,
  /[\u0C00-\u0C7F]/gu,
  /[\u0C80-\u0CFF]/gu,
  /[\u0D00-\u0D7F]/gu,
  /[\u0E00-\u0E7F]/gu,
  /[\u0E80-\u0EFF]/gu,
  /[\u10A0-\u10FF]/gu,
  /[\u1780-\u17FF]/gu,
  /[\u1800-\u18AF]/gu,
];

/** 자주 나오는 환각 표기 — 즉시 치환 */
export const FORTUNE_FOREIGN_GLOSSARY: Record<string, string> = {
  колодец: "우물",
  колодца: "우물",
};

export { findForeignScriptSegments, foreignScriptNeedsTranslation as hasForeignScriptInFortuneText };

function replaceAllLiteral(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  return haystack.split(needle).join(replacement);
}

function applyReplacements(html: string, map: Record<string, string>): string {
  let s = html;
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const ko = map[key];
    if (ko && ko !== key) s = replaceAllLiteral(s, key, ko);
  }
  return s;
}

/** 용어집만 동기 적용 (스트리밍 청크용) */
export function applyFortuneForeignGlossary(html: string): string {
  return applyReplacements(String(html ?? ""), FORTUNE_FOREIGN_GLOSSARY);
}

/** 번역 API 실패 시 최후 수단 */
export function stripForeignScriptInFortuneText(text: string): string {
  let s = String(text ?? "");
  for (const re of FOREIGN_SCRIPT_PATTERNS) {
    re.lastIndex = 0;
    s = s.replace(re, "");
  }
  return s.replace(/\s{2,}/g, " ");
}

export function stripForeignScriptInFortuneHtml(html: string): string {
  return stripForeignScriptInFortuneText(html);
}

export function applyFortuneForeignReplacements(html: string, map: Record<string, string>): string {
  return applyReplacements(String(html ?? ""), { ...FORTUNE_FOREIGN_GLOSSARY, ...map });
}
