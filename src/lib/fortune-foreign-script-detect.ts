/** 외국 문자 감지·추출 (서버·클라이언트 공통, 비밀 없음) */

export const FOREIGN_SEGMENT_RE =
  /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u10A0-\u10FF\u1780-\u17FF\u1800-\u18AF]+/gu;

export function foreignScriptNeedsTranslation(text: string): boolean {
  FOREIGN_SEGMENT_RE.lastIndex = 0;
  return FOREIGN_SEGMENT_RE.test(String(text ?? ""));
}

export function findForeignScriptSegments(text: string): string[] {
  const s = String(text ?? "");
  FOREIGN_SEGMENT_RE.lastIndex = 0;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = FOREIGN_SEGMENT_RE.exec(s)) !== null) {
    const seg = m[0].trim();
    if (seg.length >= 1) found.add(seg);
  }
  return [...found];
}
