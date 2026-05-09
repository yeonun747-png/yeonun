/** 분할 GLB 폴더 (ASCII). 파일명: `{클립명}_withSkin.glb` — Three.js 클립 논리명은 `_withSkin` 제거 후 Idle_9, Walking 등 */
export const YEON_SPLIT_DIR = "/mascot/y";
export const UN_SPLIT_DIR = "/mascot/u";

export const YEON_GLB = `${YEON_SPLIT_DIR}/Idle_9_withSkin.glb`;
export const UN_GLB = `${UN_SPLIT_DIR}/Idle_3_withSkin.glb`;

/**
 * 연이 클립 전체 (파일 stem 과 동일, Animation_Running 등).
 */
export const YEON_CLIP_SEQUENCE = [
  "Idle_9",
  "Walking",
  "Excited_Walk_F",
  "Groovy_Walk",
  "Animation_Running",
  "Gangnam_Groove",
  "Cardio_Dance",
  "Shake_It_Off_Dance",
  "Superlove_Pop_Dance",
  "Hip_Hop_Dance_4",
  "You_Groove",
  "Circle_Shuffle",
  "Red_Carpet_Walk",
  "Motivational_Cheer",
  "Cheer_with_Both_Hands",
  "Happy_jump_f",
  "Wave_One_Hand",
  "Wave_for_Help_3",
  "Not_Your_Mom",
] as const;

/**
 * 운이 클립 전체.
 */
export const UN_CLIP_SEQUENCE = [
  "Idle_3",
  "Walking",
  "Running",
  "Skip_Forward",
  "ymca_dance",
  "Cardio_Dance",
  "Shake_It_Off_Dance",
  "Superlove_Pop_Dance",
  "Hip_Hop_Dance_1",
  "Cherish_Pop_Dance",
  "FunnyDancing_01",
  "FunnyDancing_03",
  "Cheer_with_Both_Hands_1",
  "Happy_jump_f",
  "Big_Wave_Hello",
  "Wave_for_Help_4",
  "Motivational_Cheer",
  "Counterstrike",
  "Indoor_Swing",
] as const;

export const YEON = {
  idle: "Idle_9",
  happy: "Cheer_with_Both_Hands",
  thinking: "Wave_for_Help_3",
  walk: "Walking",
  run: "Animation_Running",
  dance: "Gangnam_Groove",
  dance2: "Superlove_Pop_Dance",
  dance3: "You_Groove",
} as const;

export const UN = {
  idle: "Idle_3",
  happy: "Cheer_with_Both_Hands_1",
  jump: "Happy_jump_f",
  dance: "Shake_It_Off_Dance",
  walk: "Walking",
  run: "Running",
} as const;
