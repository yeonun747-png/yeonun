/** 공유 본문 포맷 (스펙: 캐릭터명의 오늘 한 마디 / 인용 / 푸터) */
export function buildDailyWordShareText(characterShortName: string, lineText: string): string {
  const quote = String(lineText ?? "").trim();
  return `${characterShortName}의 오늘 한 마디\n\n"${quote}"\n\n나만의 사주 기반 운세\n→ yeonun.ai`;
}
