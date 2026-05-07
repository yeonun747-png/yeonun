import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

export type FortuneMainGroup = {
  mainTitle: string;
  sectionIndices: number[];
};

function fallbackGroupsFromToc(toc: FortuneTocItem[]): FortuneMainGroup[] {
  const out: FortuneMainGroup[] = [];
  let curTitle = "";
  let cur: number[] = [];

  for (let i = 0; i < toc.length; i++) {
    const item = toc[i];
    const mt = (item?.main_title ?? "").trim() || "풀이";
    if (!cur.length) {
      curTitle = mt;
      cur = [i];
      continue;
    }
    if (mt !== curTitle) {
      out.push({ mainTitle: curTitle, sectionIndices: cur });
      curTitle = mt;
      cur = [i];
      continue;
    }
    cur.push(i);
  }
  if (cur.length) out.push({ mainTitle: curTitle, sectionIndices: cur });
  return out.length ? out : [{ mainTitle: "풀이", sectionIndices: toc.map((_, i) => i) }];
}

export function buildFortuneMainGroups(
  toc: FortuneTocItem[],
  tocGroups: FortuneTocMainGroup[] | null,
): FortuneMainGroup[] {
  if (!toc.length) return [];

  if (tocGroups?.length) {
    const groups: FortuneMainGroup[] = [];
    for (const g of tocGroups) {
      const indices = (g.subs ?? [])
        .map((s) => s.sectionIndex)
        .filter((i) => Number.isFinite(i) && i >= 0 && i < toc.length);
      if (!indices.length) continue;
      groups.push({ mainTitle: g.main_title?.trim() || "풀이", sectionIndices: indices });
    }
    if (groups.length) return groups;
  }

  return fallbackGroupsFromToc(toc);
}
