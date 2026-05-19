import { absoluteUrl, getSiteUrl } from "@/lib/site-url";

/** 공유 본문 포맷 (캐릭터명 / 인용 / 푸터 + 공유 링크) */
export function buildDailyWordShareText(
  characterShortName: string,
  lineText: string,
  shareUrl?: string,
): string {
  const quote = String(lineText ?? "").trim();
  const link = shareUrl?.trim() || absoluteUrl("/today");
  let host = "yeonun.com";
  try {
    host = new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    try {
      host = new URL(getSiteUrl()).hostname.replace(/^www\./i, "");
    } catch {
      /* keep default */
    }
  }

  return `${characterShortName}의 오늘 한 마디\n\n"${quote}"\n\n나만의 사주 기반 운세\n→ ${host}\n${link}`;
}
