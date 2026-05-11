import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import { normFortunePlainTextForCompare } from "@/lib/fortune-section-html-split";

/** 보관함 등 저장된 점사 HTML에서 목차용 소제목·글자 수 추출 */

function escapeHtmlPcdata(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 다구간 SSE 저장 시 — 모달 화면과 같이 각 소메뉴 블록 앞에 대메뉴명(main_title)을 넣는다.
 * (저장 문자열에는 원래 없어서 보관함 재생 시 대제목이 사라지던 문제 보정)
 */
/**
 * 저장·주입 키커 `<p class="…y-fs-section-main-kicker…">` — 따옴표·추가 클래스·앞 공백·BOM 허용
 * (두 번째 대메뉴부터 엄격한 `class="y-fs-section-main-kicker"`만 매칭하면 제거 실패 → 제목 중복)
 */
export const LIBRARY_MAIN_KICKER_PREFIX_RE =
  /^\uFEFF?\s*<p\b[^>]*\bclass\s*=\s*["'][^"']*\by-fs-section-main-kicker\b[^"']*["'][^>]*>[\s\S]*?<\/p>\s*/i;

/** 재생·청크 UI에서 React로 키커를 그릴 때 HTML 선두와 중복되지 않게 제거(연속 선두 키커도 제거) */
export function stripLeadingMainKickerParagraph(html: string): string {
  let s = String(html ?? "");
  for (let n = 0; n < 6; n++) {
    const next = s.replace(LIBRARY_MAIN_KICKER_PREFIX_RE, "");
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * 본문이 `<div class="subtitle-section">`로 시작할 때, 그 div **안** 첫 요소로 남은 대메뉴 키커 `<p>`를 제거한다.
 * (선두 strip은 건너뛰고 React 키커만 그리면 50px 아래에 HTML 키커가 한 번 더 보이던 문제)
 */
const MAIN_KICKER_P_IMMEDIATELY_AFTER_SUBTITLE_SECTION_OPEN_RE =
  /(<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>)\s*<p\b[^>]*\bclass\s*=\s*["'][^"']*\by-fs-section-main-kicker\b[^"']*["'][^>]*>[\s\S]*?<\/p>\s*/i;

export function stripMainKickerInsideOpeningSubtitleSection(html: string): string {
  let s = String(html ?? "");
  for (let n = 0; n < 6; n++) {
    const next = s.replace(MAIN_KICKER_P_IMMEDIATELY_AFTER_SUBTITLE_SECTION_OPEN_RE, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * `<p …>` 시작 태그 어디에든 `y-fs-section-main-kicker`가 있으면 해당 문단 전체 제거.
 * (`class=`만 보던 패턴은 속성 순서·따옴표·추가 클래스 조합에서 누락될 수 있음)
 */
const LIBRARY_MAIN_KICKER_P_BLOCK_LOOSE_GLOBAL_RE =
  /<p\b[^>]*\by-fs-section-main-kicker\b[^>]*>[\s\S]*?<\/p>\s*/giu;

/**
 * 청크 재생 시 React로 대메뉴 키커를 그릴 때 — 본문에 남은 해당 `<p>…</p>`는 전부 제거(선두·subtitle-section 안 등).
 */
export function stripAllLibraryMainKickerParagraphBlocks(html: string): string {
  let s = String(html ?? "");
  for (let n = 0; n < 24; n++) {
    LIBRARY_MAIN_KICKER_P_BLOCK_LOOSE_GLOBAL_RE.lastIndex = 0;
    const next = s.replace(LIBRARY_MAIN_KICKER_P_BLOCK_LOOSE_GLOBAL_RE, "");
    if (next === s) break;
    s = next;
  }
  return s;
}
const SUBTITLE_SECTION_OPEN_RE =
  /<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/gi;

function showMainKickerForJoinedSection(tocList: FortuneTocItem[], i: number): boolean {
  const mainLabel = tocList[i]?.main_title?.trim() ?? "";
  const prevMain = i > 0 ? tocList[i - 1]?.main_title?.trim() ?? "" : "";
  return Boolean(mainLabel) && (i === 0 || prevMain !== mainLabel);
}

/**
 * `joinSectionHtmlForLibrarySave` 로 이어 붙인 보관함 HTML을 `sectionHtml` 맵으로 되돌림.
 * 소메뉴(`subtitle-section`) 개수가 목차 길이와 같을 때만 성공한다.
 */
export function splitJoinedLibraryHtmlToSectionHtml(
  html: string,
  tocList: FortuneTocItem[],
): Record<number, string> | null {
  const raw = sanitizeFortuneJoinedHtmlForLibraryReplay(String(html ?? ""));
  const n = tocList.length;
  if (n === 0) return {};

  const opens: number[] = [];
  SUBTITLE_SECTION_OPEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SUBTITLE_SECTION_OPEN_RE.exec(raw)) !== null) {
    opens.push(m.index);
  }
  if (opens.length !== n) return null;

  let cursor = 0;
  const out: Record<number, string> = {};
  for (let i = 0; i < n; i++) {
    let kickerPrefix = "";
    if (showMainKickerForJoinedSection(tocList, i)) {
      const slice = raw.slice(cursor);
      const km = LIBRARY_MAIN_KICKER_PREFIX_RE.exec(slice);
      if (km) {
        kickerPrefix = km[0];
        cursor += km[0].length;
      }
    }
    if (opens[i] !== cursor) return null;
    const end = i + 1 < n ? opens[i + 1]! : raw.length;
    /** `opens[i+1]` 직전에 끼어 있던 다음 섹션용 키커가 구간에 포함되는 경우 제거 */
    const segment = stripTrailingMainKickerParagraphOnly(raw.slice(cursor, end));
    /** 키커는 경계 맞춤용으로만 걷어낸 뒤 해당 구간 HTML 앞에 다시 붙여 재생 시 대메뉴 제목이 보이게 함 */
    out[i] = (kickerPrefix + segment).trim();
    cursor = end;
  }
  return out;
}

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
    if (showMainKickerForJoinedSection(tocList, i)) {
      const mainLabel = item?.main_title?.trim() ?? "";
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

  const re =
    /<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/gi;
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
    pieces.push(raw.slice(cursor, pos));
    if (showMainKickerForJoinedSection(tocList, i)) {
      const mainLabel = item?.main_title?.trim() ?? "";
      pieces.push(`<p class="y-fs-section-main-kicker">${escapeHtmlPcdata(mainLabel)}</p>`);
    }
    cursor = pos;
  }
  pieces.push(raw.slice(cursor));
  return pieces.join("");
}

/**
 * `joinSectionHtmlForLibrarySave` 경계에서 키커 `<p>`가 다음 `subtitle-section` **앞**이 아니라
 * 이전 `subtitle-content` 닫는 `</div>` 뒤·바깥 `</div>` 앞에 끼면 `splitJoinedLibraryHtmlToSectionHtml`의
 * `[opens[i], opens[i+1])` 구간에 포함되어 이전 섹션 `split.tail` 끝에 남는다. 그 한 줄을 제거한다.
 */
export function stripOrphanMainKickerBetweenClosingDivsBeforeSubtitleSection(html: string): string {
  let s = String(html ?? "");
  const re =
    /(<\/div>)\s*<p\b[^>]*\by-fs-section-main-kicker\b[^>]*>[\s\S]*?<\/p>\s*(<\/div>\s*(?=<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>))/giu;
  for (let n = 0; n < 64; n++) {
    const t = s.replace(re, "$1$2");
    if (t === s) break;
    s = t;
  }
  return s;
}

/** `split` 구간 끝에 잘못 붙은 대메뉴 키커 `<p>`만 제거(문자열 끝이 `</p>`로 끝나는 경우) */
function stripTrailingMainKickerParagraphOnly(html: string): string {
  return String(html ?? "").replace(/(?:\s*<p\b[^>]*\by-fs-section-main-kicker\b[^>]*>[\s\S]*?<\/p>)+\s*$/giu, "");
}

/**
 * 보관함 이어 붙인 HTML을 `splitJoinedLibraryHtmlToSectionHtml`에 넣기 전에 한 번 정리한다.
 */
export function sanitizeFortuneJoinedHtmlForLibraryReplay(html: string): string {
  let s = stripOrphanMainKickerBetweenClosingDivsBeforeSubtitleSection(html);
  s = stripDuplicateMainKickerBeforeSubtitleWhenH3Matches(s);
  return s;
}

/**
 * 이어 붙인 보관함 HTML: 각 `subtitle-section` 바로 앞의 `<p class="…main-kicker…">`와,
 * 그 블록 안 첫 `<h3>` 표시 텍스트가 같으면 해당 `<p>`만 제거한다.
 * (`FortuneResultSectionChunks`를 쓰지 않는 재생 경로에서 큰 키커·작은 h3 이중 노출 방지)
 */
export function stripDuplicateMainKickerBeforeSubtitleWhenH3Matches(html: string): string {
  let s = String(html ?? "");
  const rootRe =
    /<(?:div|section)\b[^>]*\bclass\s*=\s*["'][^"']*\bsubtitle-section\b[^"']*["'][^>]*>/gi;
  for (let iter = 0; iter < 400; iter++) {
    rootRe.lastIndex = 0;
    let removed = false;
    let dm: RegExpExecArray | null;
    while ((dm = rootRe.exec(s)) !== null) {
      const divStart = dm.index;
      const backStart = Math.max(0, divStart - 4000);
      const back = s.slice(backStart, divStart);
      const kickerRe = /<p\b[^>]*\by-fs-section-main-kicker\b[^>]*>([\s\S]*?)<\/p>/gi;
      let last: RegExpExecArray | null = null;
      let k: RegExpExecArray | null;
      while ((k = kickerRe.exec(back)) !== null) last = k;
      if (!last) continue;
      const kickerStart = backStart + last.index;
      const win = s.slice(divStart, divStart + 12000);
      const h3m = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(win);
      if (!h3m) continue;
      const kp = normFortunePlainTextForCompare(last[1] ?? "");
      const hp = normFortunePlainTextForCompare(h3m[1] ?? "");
      if (!kp || !hp) continue;
      const same = kp === hp || kp.replace(/\s/g, "") === hp.replace(/\s/g, "");
      if (!same) continue;
      s = s.slice(0, kickerStart) + s.slice(divStart);
      removed = true;
      break;
    }
    if (!removed) break;
  }
  return s;
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
