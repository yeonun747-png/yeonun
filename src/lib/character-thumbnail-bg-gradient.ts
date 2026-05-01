/**
 * 썸네일 SVG용 — `character_personas.color_hex`(테마)만으로 캐릭터별 배경 linearGradient 생성.
 * 운영 DB 스키마 추가 없이 캐릭터마다 다른 배경 톤을 보장한다.
 */

function clamp255(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${clamp255(r).toString(16).padStart(2, "0")}${clamp255(g).toString(16).padStart(2, "0")}${clamp255(b).toString(16).padStart(2, "0")}`.toUpperCase();
}

function normalizeHex6(raw: string): string | null {
  let s = raw.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  const body = s.slice(1);
  if (/^[0-9a-f]{3}$/i.test(body)) {
    const a = body[0] ?? "0";
    const b = body[1] ?? "0";
    const c = body[2] ?? "0";
    s = `#${a}${a}${b}${b}${c}${c}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(s)) return null;
  return s.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex6(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

function mixRgb(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

export type CharacterThumbnailBgGradient = {
  /** `<linearGradient id="...">...</linearGradient>` 한 덩어리 */
  gradientElementXml: string;
  /** `fill="url(#...)"` 에 쓸 id (XML과 동일해야 함) */
  gradientId: string;
  /** 스톱 컬러 요약(디버그·API 응답용) */
  stopHexes: string[];
};

/**
 * @param characterKey — SVG id에 안전하게 들어가도록 ASCII 위주로 쓴다.
 * @param themeHex — DB `color_hex`
 */
export function buildCharacterThumbnailBgGradient(characterKey: string, themeHex: string): CharacterThumbnailBgGradient {
  const safeKey = characterKey.replace(/[^a-zA-Z0-9_]/g, "_") || "ch";
  const gradientId = `yeonunCharBg_${safeKey}`;
  const theme = hexToRgb(themeHex) ?? { r: 221, g: 88, b: 120 };
  const W = { r: 255, g: 255, b: 255 };

  const stops: { offset: string; t: number }[] = [
    { offset: "0%", t: 0.05 },
    { offset: "32%", t: 0.14 },
    { offset: "66%", t: 0.26 },
    { offset: "100%", t: 0.4 },
  ];

  const stopHexes: string[] = [];
  const stopLines = stops.map(({ offset, t }) => {
    const { r, g, b } = mixRgb(W, theme, t);
    const hx = rgbToHex(r, g, b);
    stopHexes.push(hx);
    return `    <stop offset="${offset}" stop-color="${hx}"/>`;
  });

  const gradientElementXml = [
    `<linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">`,
    ...stopLines,
    `  </linearGradient>`,
  ].join("\n");

  return { gradientElementXml, gradientId, stopHexes };
}
