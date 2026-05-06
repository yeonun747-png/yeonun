/** GLB public paths (UTF-8 파일명) */
export const YEON_GLB = "/mascot/연이_all.glb";
export const UN_GLB = "/mascot/운이_all.glb";

/** 연이 애니 클립명 */
export const YEON = {
  idle: "Idle_9",
  happy: "Cheer_with_Both_Hands",
  thinking: "Confused_Scratch",
  walk: "Walking",
  run: "Running",
  dance: "Gangnam_Groove",
  dance2: "Superlove_Pop_Dance",
  dance3: "You_Groove",
} as const;

/** 운이 애니 클립명 */
export const UN = {
  idle: "Idle_3",
  happy: "Cheer_with_Both_Hands_1",
  jump: "Happy_jump_f",
  dance: "Shake_It_Off_Dance",
  walk: "Walking",
  run: "Running",
} as const;

/** 연이: 순차 반복 재생 순서 */
export const YEON_CLIP_SEQUENCE = [
  YEON.idle,
  YEON.happy,
  YEON.thinking,
  YEON.walk,
  YEON.run,
  YEON.dance,
  YEON.dance2,
  YEON.dance3,
] as const;

/** 운이: 순차 반복 재생 순서 */
export const UN_CLIP_SEQUENCE = [
  UN.idle,
  UN.happy,
  UN.jump,
  UN.dance,
  UN.walk,
  UN.run,
] as const;
