import { UN_CLIP_SEQUENCE, YEON_CLIP_SEQUENCE, YEON_SPLIT_DIR, UN_SPLIT_DIR } from "./mascotAssets";

export type SplitMascotKind = "yeon" | "un";

/** 논리 클립명 → 디스크 파일명 stem (`_withSkin.glb` 앞). 대부분 논리명=stem, 예외만 기록 */
const YEON_CLIP_TO_FILE_STEM: Partial<Record<(typeof YEON_CLIP_SEQUENCE)[number], string>> = {};

const UN_CLIP_TO_FILE_STEM: Partial<Record<(typeof UN_CLIP_SEQUENCE)[number], string>> = {};

function stemForClip(kind: SplitMascotKind, logicalClip: string): string {
  if (kind === "yeon") {
    const key = logicalClip as (typeof YEON_CLIP_SEQUENCE)[number];
    return YEON_CLIP_TO_FILE_STEM[key] ?? logicalClip;
  }
  const key = logicalClip as (typeof UN_CLIP_SEQUENCE)[number];
  return UN_CLIP_TO_FILE_STEM[key] ?? logicalClip;
}

/** 분할 파일 전체 URL (프리로드용) */
export function getAllMascotSplitGlbUrls(): string[] {
  const yeon = YEON_CLIP_SEQUENCE.map((k) => `${YEON_SPLIT_DIR}/${stemForClip("yeon", k)}_withSkin.glb`);
  const un = UN_CLIP_SEQUENCE.map((k) => `${UN_SPLIT_DIR}/${stemForClip("un", k)}_withSkin.glb`);
  return [...yeon, ...un];
}

/** 논리 클립명 → 로드할 GLB URL (항상 분할 파일; 폴백은 idle 등 단일 GLB) */
export function getFortuneMascotGlbUrl(kind: SplitMascotKind, logicalClip: string, combinedFallback: string): string {
  const dir = kind === "yeon" ? YEON_SPLIT_DIR : UN_SPLIT_DIR;
  return `${dir}/${stemForClip(kind, logicalClip)}_withSkin.glb`;
}

export const MASCOT_SPLIT_PRELOAD_URLS: readonly string[] = getAllMascotSplitGlbUrls();

export { YEON_SPLIT_DIR, UN_SPLIT_DIR };
