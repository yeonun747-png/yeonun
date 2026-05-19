import { absoluteUrl } from "@/lib/site-url";

export type DailyWordSharePayload = {
  /** Web Share API — OG URL이 있으면 url만(중복 방지), 없으면 텍스트+링크 */
  native: ShareData;
  /** 클립보드 / url 필드 미지원 fallback */
  clipText: string;
};

/** 클립보드용: 인용 문장 + URL 한 줄 */
export function buildDailyWordShareClipText(lineText: string, shareUrl?: string): string {
  const quote = String(lineText ?? "").trim();
  const link = shareUrl?.trim() || absoluteUrl("/today");
  return `"${quote}"\n${link}`;
}

export function buildDailyWordSharePayload(lineText: string, shareUrl?: string): DailyWordSharePayload {
  const clipText = buildDailyWordShareClipText(lineText, shareUrl);
  const link = shareUrl?.trim();

  if (link) {
    // title·text·url을 함께 넘기면 앱마다 제목·URL이 중복 붙음 → OG 링크만 전달
    return { native: { url: link }, clipText };
  }

  return { native: { text: clipText }, clipText };
}
