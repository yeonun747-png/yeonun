import type { MascotKind } from "@/components/fortune/fortuneFlowTypes";
import { UN, YEON } from "@/components/mascot/mascotAssets";

/** 연이 — 스펙상 논리 클립명 (GLB 내 이름과 동일해야 함) */
export const YEON_IDLE_POOL = [YEON.idle] as const;

export const YEON_WALK_POOL = ["Walking", "Excited_Walk_F", "Groovy_Walk"] as const;

export const YEON_HAPPY_POOL = [
  "Cheer_with_Both_Hands",
  "Happy_jump_f",
  "Gangnam_Groove",
  "Motivational_Cheer",
] as const;

export const YEON_DANCE_POOL = [
  "Gangnam_Groove",
  "Cardio_Dance",
  "Shake_It_Off_Dance",
  "Superlove_Pop_Dance",
  "Hip_Hop_Dance_4",
  "You_Groove",
] as const;

export const YEON_SURPRISE_POOL = [
  "Not_Your_Mom",
  "Circle_Shuffle",
  "Red_Carpet_Walk",
  "Gangnam_Groove",
  "You_Groove",
] as const;

export const YEON_WAVE_POOL = ["Wave_One_Hand", "Wave_for_Help_3", "Cheer_with_Both_Hands"] as const;

/** 운이 */
export const UN_IDLE_POOL = [UN.idle] as const;

export const UN_WALK_POOL = ["Walking", "Skip_Forward"] as const;

export const UN_HAPPY_POOL = [
  "Cheer_with_Both_Hands_1",
  "Happy_jump_f",
  "ymca_dance",
  "Motivational_Cheer",
] as const;

export const UN_DANCE_POOL = [
  "ymca_dance",
  "Cardio_Dance",
  "Shake_It_Off_Dance",
  "Superlove_Pop_Dance",
  "Cherish_Pop_Dance",
  "Hip_Hop_Dance_1",
] as const;

export const UN_SURPRISE_POOL = [
  "FunnyDancing_01",
  "FunnyDancing_03",
  "Counterstrike",
  "Indoor_Swing",
  "ymca_dance",
] as const;

export const UN_WAVE_POOL = ["Big_Wave_Hello", "Wave_for_Help_4", "Cheer_with_Both_Hands_1"] as const;

const ALL_WALK = new Set<string>([
  ...YEON_WALK_POOL,
  ...UN_WALK_POOL,
  YEON.walk,
  UN.walk,
]);

export function pickFromPool(pool: readonly string[], lastPlayed: string | null, kind: MascotKind = "yeon"): string {
  if (pool.length === 0) return kind === "yeon" ? YEON.idle : UN.idle;
  if (pool.length === 1) return pool[0]!;
  const candidates = lastPlayed ? pool.filter((c) => c !== lastPlayed) : [...pool];
  const pick = candidates.length > 0 ? candidates : [...pool];
  return pick[Math.floor(Math.random() * pick.length)]!;
}

export function isWalkClipName(clip: string | undefined): boolean {
  if (!clip) return false;
  return ALL_WALK.has(clip);
}

export function walkPoolFor(kind: MascotKind): readonly string[] {
  return kind === "yeon" ? YEON_WALK_POOL : UN_WALK_POOL;
}

export function happyPoolFor(kind: MascotKind): readonly string[] {
  return kind === "yeon" ? YEON_HAPPY_POOL : UN_HAPPY_POOL;
}

export function dancePoolFor(kind: MascotKind): readonly string[] {
  return kind === "yeon" ? YEON_DANCE_POOL : UN_DANCE_POOL;
}

export function surprisePoolFor(kind: MascotKind): readonly string[] {
  return kind === "yeon" ? YEON_SURPRISE_POOL : UN_SURPRISE_POOL;
}

/** 등장·인사 전용 — 서프라이즈 풀과 분리해 단독 트리거로만 재생 */
export function wavePoolFor(kind: MascotKind): readonly string[] {
  return kind === "yeon" ? YEON_WAVE_POOL : UN_WAVE_POOL;
}

export type ClipPlaybackMode = "walk" | "idle" | "once";

export function getClipPlaybackMode(kind: MascotKind, clip?: string): ClipPlaybackMode {
  if (!clip) return "idle";
  if (isWalkClipName(clip)) return "walk";
  const idle = kind === "yeon" ? YEON.idle : UN.idle;
  if (clip === idle) return "idle";
  return "once";
}
