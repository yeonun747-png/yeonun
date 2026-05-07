import type { MansePillar, ManseRyeokData } from "@/lib/manse-ryeok";

/** 표시용 오행 비율(%) — 네 기둥 천간·지지 8글자 가중(동일 비중) */
export type FiveElementPct = { wood: number; fire: number; earth: number; metal: number; water: number };

const OH_TO_KEY: Record<string, keyof FiveElementPct> = {
  목: "wood",
  화: "fire",
  토: "earth",
  금: "metal",
  수: "water",
};

/** `manse-ryeok` 내부와 동일 매핑 (천간·지지 → 오행 한글) */
const OH_MAP: Record<string, string> = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
  자: "수",
  축: "토",
  인: "목",
  묘: "목",
  진: "토",
  사: "화",
  오: "화",
  미: "토",
  유: "금",
  술: "토",
  해: "수",
};

function ohangFromStemOrBranch(h: string): keyof FiveElementPct | null {
  const oh = OH_MAP[h];
  return oh ? OH_TO_KEY[oh] ?? null : null;
}

export function computeFiveElementPct(manse: ManseRyeokData): FiveElementPct {
  const acc: FiveElementPct = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pillars: MansePillar[] = [manse.year, manse.month, manse.day, manse.hour];
  let n = 0;
  for (const p of pillars) {
    const ga = ohangFromStemOrBranch(p.gan);
    const ji = ohangFromStemOrBranch(p.ji);
    if (ga) {
      acc[ga] += 1;
      n += 1;
    }
    if (ji) {
      acc[ji] += 1;
      n += 1;
    }
  }
  if (n === 0) return acc;
  const f = 100 / n;
  (Object.keys(acc) as (keyof FiveElementPct)[]).forEach((k) => {
    acc[k] = Math.round(acc[k] * f * 10) / 10;
  });
  const sum = acc.wood + acc.fire + acc.earth + acc.metal + acc.water;
  const drift = Math.round((100 - sum) * 10) / 10;
  if (drift !== 0) acc.water = Math.round((acc.water + drift) * 10) / 10;
  return acc;
}

const STRENGTH_LABELS = ["극약", "태약", "중화", "태강", "극강"] as const;

/** 일간 대비 십성 분포를 이용한 체감 신강·신약 슬롯(-5~5) 및 라벨 */
export function computeStrengthSpectrum(manse: ManseRyeokData): { score: number; label: string } {
  const pillars = [manse.year, manse.month, manse.day, manse.hour];
  let bijob = 0;
  let insung = 0;
  let jaese = 0;
  let gwansik = 0;
  for (const p of pillars) {
    for (const s of [p.sibsung, p.jiSibsung]) {
      if (s === "비견" || s === "겁재") bijob += 1;
      else if (s === "편인" || s === "정인") insung += 1;
      else if (s === "편재" || s === "정재" || s === "편관" || s === "정관") jaese += 1;
      else if (s === "식신" || s === "상관") gwansik += 1;
    }
  }
  const selfPower = bijob * 2 + insung;
  const drain = jaese + gwansik * 0.75;
  const raw = selfPower - drain;
  const score = Math.max(-5, Math.min(5, Math.round(raw / 2.2)));
  const labelIdx = Math.min(4, Math.max(0, Math.floor((score + 5) / 2.5)));
  return { score, label: STRENGTH_LABELS[labelIdx] ?? "중화" };
}

/** 배지용 간단 용신 후보(일간 오행 기준 생조·완화) — 참고용 */
export function suggestYongsinBadges(manse: ManseRyeokData): { yong: string; hee: string; gi: string } {
  const dayOh = OH_MAP[manse.day.gan] ?? "목";
  const cycle = ["목", "화", "토", "금", "수"];
  const i = Math.max(0, cycle.indexOf(dayOh));
  const sheng = cycle[(i + 1) % 5];
  const ke = cycle[(i + 3) % 5];
  return { yong: sheng, hee: dayOh, gi: ke };
}
