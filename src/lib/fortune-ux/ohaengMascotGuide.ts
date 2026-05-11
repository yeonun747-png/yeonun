import type { ManseRyeokData } from "@/lib/manse-ryeok";
import { computeFiveElementPct, computeStrengthSpectrum, type FiveElementPct } from "@/lib/fortune-ux/manseViz";

const EL: Record<keyof FiveElementPct, { ko: string; han: string }> = {
  wood: { ko: "목", han: "木" },
  fire: { ko: "화", han: "火" },
  earth: { ko: "토", han: "土" },
  metal: { ko: "금", han: "金" },
  water: { ko: "수", han: "水" },
};

const ORDER: (keyof FiveElementPct)[] = ["wood", "fire", "earth", "metal", "water"];

function dominantKeys(pct: FiveElementPct): (keyof FiveElementPct)[] {
  const max = Math.max(...ORDER.map((k) => pct[k]));
  return ORDER.filter((k) => pct[k] >= max - 0.05);
}

function weakestKeys(pct: FiveElementPct): (keyof FiveElementPct)[] {
  const min = Math.min(...ORDER.map((k) => pct[k]));
  return ORDER.filter((k) => pct[k] <= min + 0.05);
}

/** 오행 막대 그래프·신강 스펙트럼에 따라 마스코트 말풍선 문구를 고릅니다. */
export function getOhaengMascotGuideText(manse: ManseRyeokData): string {
  const pct = computeFiveElementPct(manse);
  const { label: strengthLabel } = computeStrengthSpectrum(manse);
  const dom = dominantKeys(pct);
  const weak = weakestKeys(pct);
  const d0 = EL[dom[0] ?? "wood"];
  const w0 = EL[weak[0] ?? "water"];
  const spread = Math.max(...ORDER.map((k) => pct[k])) - Math.min(...ORDER.map((k) => pct[k]));
  const seed = (dom[0]?.charCodeAt(0) ?? 0) + (weak[0]?.charCodeAt(0) ?? 0) + strengthLabel.length;
  const pick = (arr: string[]) => arr[seed % arr.length] ?? arr[0]!;

  if (dom.length >= 2) {
    const a = EL[dom[0]!];
    const b = EL[dom[1]!];
    return pick([
      `${a.ko}·${b.ko}이 함께 튀어 오르는 그래프예요 🌸 두 기운이 손잡고 도는 명식이에요.`,
      `${a.han}과 ${b.han}이 나란히 높아요 🌙 한쪽으로만 치우치지 않은 재미있는 밸런스예요.`,
      `막대가 말해요 — ${a.ko}와 ${b.ko}가 쌍두마차예요 ✨ 에너지가 두 갈래로 퍼지는 타입이에요.`,
    ]);
  }

  if (spread < 12) {
    return pick([
      "목·화·토·금·수가 고르게 퍼져 있어요 🌸 잔잔한 호수처럼 고른 오행 분포예요.",
      "다섯 기운이 서로 양보하는 그래프예요 🌙 극단 없이 부드럽게 이어져요.",
      "막대 높이가 비슷비슷해요 ✨ 한쪽으로 쏠리지 않는 차분한 사주 느낌이에요.",
    ]);
  }

  if (pct[weak[0]!] <= 5 && spread >= 18) {
    return pick([
      `${d0.ko}(${d0.han})는 풍성한데 ${w0.ko}은 한숨 돋는 그래프예요 🌸 극과 극이 만나는 흥미로운 명식이에요.`,
      `${d0.ko} 막대가 크게 솟고 ${w0.ko}은 낮아요 🌙 보완해 주면 더 단단해질 수 있어요.`,
      `그래프가 말하듯 ${d0.ko} 기운이 앞장서고 ${w0.ko}은 조용해요 ✨ 그래서 용신 방향이 더 또렷해질 수 있어요.`,
    ]);
  }

  if (strengthLabel === "태강" || strengthLabel === "극강") {
    return pick([
      `${d0.ko}(${d0.han}) 기운이 막대에서도 제일 눈에 띄고, 체감도 ${strengthLabel} 쪽이에요 🌸 힘이 넘치는 그래프예요.`,
      `막대가 ${d0.ko} 쪽으로 기울고 신강 스펙트럼도 높아요 🌙 에너지가 팽팽한 명식이에요.`,
      `${d0.ko} 비중 + ${strengthLabel} 조합이에요 ✨ 그래프와 스펙트럼이 같은 방향으로 말해 주네요.`,
    ]);
  }

  if (strengthLabel === "극약" || strengthLabel === "태약") {
    return pick([
      `${d0.ko}(${d0.han})가 그래프에서는 조금 앞서도, 전체 흐름은 ${strengthLabel}에 가깝게 느껴져요 🌸 잔잔하게 흐르는 오행이에요.`,
      `막대는 ${d0.ko}가 살짝 높은데 스펙트럼은 ${strengthLabel}이에요 🌙 겉과 속의 온도 차가 재미있어요.`,
      `${d0.ko} 막대와 ${strengthLabel} 라벨이 만나는 지점이에요 ✨ 부드럽게 퍼지는 분포예요.`,
    ]);
  }

  return pick([
    `${d0.ko}(${d0.han}) 기운이 막대에서 가장 두드러져요 🌸 그래프만 봐도 시선이 가는 명식이에요.`,
    `목·화·토·금·수 중 ${d0.ko} 막대가 가장 길어요 🌙 오행 분포가 한눈에 들어와요.`,
    `${d0.ko} 비중이 높은 편이에요 ✨ ${strengthLabel} 사주와 맞물려 흥미로운 그래프예요.`,
  ]);
}
