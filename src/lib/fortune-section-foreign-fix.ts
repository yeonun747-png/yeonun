"use client";

import { fixForeignScriptInFortuneHtmlAsync } from "@/lib/fortune-foreign-script-fix";
import { hasForeignScriptInFortuneText } from "@/lib/fortune-html-script-sanitize";

const sectionFixGen = new Map<number, number>();

/** 섹션 HTML이 끝난 뒤 외국 문자열을 한국어로 치환해 setHtml 호출 */
export function scheduleFortuneSectionForeignFix(
  index: number,
  getHtml: () => string,
  setHtml: (index: number, html: string) => void,
): void {
  const gen = (sectionFixGen.get(index) ?? 0) + 1;
  sectionFixGen.set(index, gen);

  void (async () => {
    const html = getHtml();
    if (!html || !hasForeignScriptInFortuneText(html)) return;
    const fixed = await fixForeignScriptInFortuneHtmlAsync(html);
    if (sectionFixGen.get(index) !== gen) return;
    if (fixed && fixed !== html) setHtml(index, fixed);
  })();
}

export async function fixFortuneFullHtmlIfNeeded(html: string): Promise<string> {
  if (!html || !hasForeignScriptInFortuneText(html)) return html;
  return fixForeignScriptInFortuneHtmlAsync(html);
}
