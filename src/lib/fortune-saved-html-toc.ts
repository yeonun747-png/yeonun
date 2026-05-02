import type { FortuneTocItem } from "@/lib/fortune-stream-client";

/** 보관함 등 저장된 점사 HTML에서 목차용 소제목·글자 수 추출 */

function escapeHtmlPcdata(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 다구간 SSE 저장 시 — 모달 화면과 같이 각 소메뉴 블록 앞에 대메뉴명(main_title)을 넣는다.
 * (저장 문자열에는 원래 없어서 보관함 재생 시 대제목이 사라지던 문제 보정)
 */
export function joinSectionHtmlForLibrarySave(
  sectionHtmlByIndex: Record<number, string>,
  tocList: FortuneTocItem[],
): string {
  const indices = Object.keys(sectionHtmlByIndex)
    .map(Number)
    .sort((a, b) => a - b);
  const parts: string[] = [];
  for (const i of indices) {
    const piece = sectionHtmlByIndex[i] ?? "";
    const item = tocList[i];
    const mainLabel = item?.main_title?.trim() ?? "";
    const prevMain = i > 0 ? (tocList[i - 1]?.main_title?.trim() ?? "") : "";
    const showMainKicker = Boolean(mainLabel) && (i === 0 || prevMain !== mainLabel);
    if (showMainKicker) {
      parts.push(`<p class="y-fs-section-main-kicker">${escapeHtmlPcdata(mainLabel)}</p>`);
    }
    parts.push(piece);
  }
  return parts.join("\n");
}

/**
 * 레거시 저장본(대제목 접두사 없음) 재생 시 보정.
 * `subtitle-section` 루트 개수와 평면 목차 길이가 같을 때만 삽입한다.
 */
export function injectMainKickersFromTocIfApplicable(
  html: string,
  tocList: FortuneTocItem[] | null | undefined,
): string {
  const raw = String(html ?? "");
  if (!tocList?.length || !raw.trim()) return raw;
  if (raw.includes("y-fs-section-main-kicker")) return raw;

  const re = /<div\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/gi;
  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    starts.push(m.index);
  }
  if (starts.length === 0 || starts.length !== tocList.length) return raw;

  const pieces: string[] = [];
  let cursor = 0;
  for (let i = 0; i < starts.length; i++) {
    const pos = starts[i];
    const item = tocList[i];
    const mainLabel = item?.main_title?.trim() ?? "";
    const prevMain = i > 0 ? (tocList[i - 1]?.main_title?.trim() ?? "") : "";
    const showMainKicker = Boolean(mainLabel) && (i === 0 || prevMain !== mainLabel);
    pieces.push(raw.slice(cursor, pos));
    if (showMainKicker) {
      pieces.push(`<p class="y-fs-section-main-kicker">${escapeHtmlPcdata(mainLabel)}</p>`);
    }
    cursor = pos;
  }
  pieces.push(raw.slice(cursor));
  return pieces.join("");
}

export function extractSubtitleTitlesFromFortuneHtml(html: string): string[] {
  const titles: string[] = [];
  const re = /<h3[^>]*\bsubtitle-title\b[^>]*>([\s\S]*?)<\/h3>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = String(m[1] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) titles.push(text);
  }
  return titles;
}

export function approxVisibleCharsFromFortuneHtml(html: string): number {
  return String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}
