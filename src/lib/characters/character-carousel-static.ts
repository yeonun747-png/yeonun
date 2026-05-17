import type { Character } from "@/lib/data/characters";

export type CarouselCharKey = "yeon" | "byeol" | "yeo" | "un";

export const CAROUSEL_CHAR: Record<
  CarouselCharKey,
  { key: CarouselCharKey; han: string; spec: string; name: string; en: string; quote: string; tags: string }
> = {
  yeon: {
    key: "yeon",
    han: "蓮",
    spec: "재회 · 연애 · 궁합",
    name: "연화",
    en: "YEONHWA · 蓮花",
    quote: "오랜만이에요. 그 사람이 자꾸 떠오르시죠? 들여다봐 드릴게요.",
    tags: "#재회 #짝사랑 #이별후 #그사람마음",
  },
  byeol: {
    key: "byeol",
    han: "星",
    spec: "자미두수 · 신년운세",
    name: "별하",
    en: "BYEOLHA · 星河",
    quote: "2026년에 어떤 별이 흐르는지, 같이 보러 갈까요?",
    tags: "#자미두수 #2026운세 #토정비결 #올해",
  },
  yeo: {
    key: "yeo",
    han: "麗",
    spec: "정통 사주 · 평생운",
    name: "여연",
    en: "YEOYEON · 麗淵",
    quote: "바람이 닿지 않는 깊은 물처럼, 사주의 본질을 짚어드립니다.",
    tags: "#평생운 #대운 #직업 #재물",
  },
  un: {
    key: "un",
    han: "雲",
    spec: "작명 · 택일 · 꿈해몽",
    name: "운서",
    en: "UNSEO · 雲棲",
    quote: "한 글자에 운명이 담깁니다. 천천히 풀어가시죠.",
    tags: "#작명 #택일 #꿈해몽 #자녀사주",
  },
};

export const CAROUSEL_CHAR_KEYS = Object.keys(CAROUSEL_CHAR) as CarouselCharKey[];

export function isCarouselCharKey(key: string): key is CarouselCharKey {
  return key in CAROUSEL_CHAR;
}

/** 캐러셀 4인 — DB 왕복 없이 시트 RSC 즉시 시작 */
export function carouselCharacterAsDb(key: CarouselCharKey): Character {
  const c = CAROUSEL_CHAR[key];
  return {
    key: c.key,
    name: c.name,
    han: c.han,
    en: c.en,
    spec: c.spec,
    greeting: c.quote,
  };
}

export function characterSheetHref(key: CarouselCharKey, from: "home" | "meet" = "home") {
  return `/characters/${key}?sheet=1&from=${from}`;
}
