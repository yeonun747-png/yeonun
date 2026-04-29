import type { ManseRyeokData } from "@/lib/manse-ryeok";

/** 오늘 FOR YOU API용: 생년월일시 원문 없이 만세력 요약만 */
export function formatManseBriefKo(m: ManseRyeokData): string {
  const line = (lab: string, p: ManseRyeokData["year"]) =>
    `${lab} ${p.gan}${p.ji} · 십성 ${p.sibsung} · 오행 ${p.ohang}`;
  return [line("년주", m.year), line("월주", m.month), line("일주", m.day), line("시주", m.hour)].join("\n");
}
