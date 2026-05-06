/** GLB public paths (UTF-8 파일명) */
export const YEON_GLB = "/mascot/연이_all.glb";
export const UN_GLB = "/mascot/운이_all.glb";

/**
 * 연이 GLB 애니 클립 (에디터 ID 0→… 순). 스크린샷 테이블 기준.
 * 21번째 클립명이 있으면 `YEON_CLIP_SEQUENCE` 맨 뒤에 문자열로 추가하면 됩니다.
 */
export const YEON_CLIP_SEQUENCE = [
  "Arm_Circle_Shuffle",
  "Backflip_Jump",
  "Cardio_Dance",
  "Cheer_with_Both_Hands",
  "Excited_Walk_F",
  "Gangnam_Groove",
  "Groovy_Walk",
  "Happy_jump_f",
  "Hip_Hop_Dance_4",
  "Idle_9",
  "Motivational_Cheer",
  "Not_Your_Mom",
  "Red_Carpet_Walk",
  "Running",
  "Shake_It_Off_Dance",
  "Superlove_Pop_Dance",
  "Walking",
  "Wave_One_Hand",
  "Wave_for_Help_3",
  "You_Groove",
] as const;

/**
 * 운이 GLB 애니 클립 (에디터 ID 0→… 순). 스크린샷 테이블 기준.
 */
export const UN_CLIP_SEQUENCE = [
  "Backflip_Jump",
  "Big_Wave_Hello",
  "Cardio_Dance",
  "Cheer_with_Both_Hands_1",
  "Cherish_Pop_Dance",
  "Counterstrike",
  "FunnyDancing_01",
  "FunnyDancing_03",
  "Happy_jump_f",
  "Hip_Hop_Dance_1",
  "Idle_3",
  "Indoor_Swing",
  "Motivational_Cheer",
  "Running",
  "Shake_It_Off_Dance",
  "Skip_Forward",
  "Superlove_Pop_Dance",
  "Walking",
  "Wave_for_Help_4",
  "ymca_dance",
] as const;

/** 이벤트·클릭 등에서 쓰는 논리 이름 → 실제 클립명 (위 시퀀스에 포함된 것만 사용) */
export const YEON = {
  idle: "Idle_9",
  happy: "Cheer_with_Both_Hands",
  /** 풀이 중·크레딧 등 (구 Confused_Scratch 대체: 목록 내 클립) */
  thinking: "Wave_for_Help_3",
  walk: "Walking",
  run: "Running",
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
