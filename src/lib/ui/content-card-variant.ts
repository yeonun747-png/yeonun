/** 풀이 카드 UI 테마 클래스 (y-content-card yeon | byeol-deep 등) */
export function cardVariantForSlug(slug: string, characterKey: string): string {
  const normBase = characterKey === "yeonhwa" || characterKey === "yeon-hwa" ? "yeon" : characterKey;
  if (slug === "lifetime-master") return "yeo-deep";
  if (slug === "newyear-2026") return "byeol-deep";
  if (slug === "wealth-graph") return "cream";
  if (slug === "calendar-2026") return "warm";
  if (slug === "naming-baby") return "un-deep";
  return normBase;
}
