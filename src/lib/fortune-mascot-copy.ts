/** 마스코트 말풍선용 로컬 카피 — 추후 DB(answer_react 등)로 치환 */

export function pickRandom<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)]!;
}

export const ANSWER_REACT_LINES = [
  "좋아요. 이 답변은 풀이 뒤 코멘트에만 살짝 반영할게요.",
  "고마워요, 그 마음 잘 담아둘게요.",
  "알겠어요. 풀이에 살짝 녹여볼게요.",
] as const;

export const ALL_DONE_LINES = [
  "풀이가 모두 끝났어요 🌸 오늘의 마음을 잘 간직해 주세요",
  "여기까지예요. 오늘 하루도 따뜻하게 보내세요.",
] as const;

export const CLICK_REACT_LINES = [
  "저 불렀어요? 🌸",
  "여기 있어요!",
  "잠깐 쉬었다 갈게요.",
] as const;

export const NIGHT_TIME_LINES = [
  "밤이 깊었어요 🌙 내일도 좋은 일만 가득하세요.",
  "늦은 시간이에요. 천천히 쉬어가요.",
] as const;

/** situation: step_transition — 스텝 예고 (스펙 문구 + 랜덤 확장용) */
export const STEP_TRANSITION_LINES: Record<string, readonly string[]> = {
  "0-1": ["생년월일을 알려주시면 바로 볼게요 🌸"],
  "1-2": ["별하선생님을 소개해드릴게요! 🌸"],
  "2-3": ["명식 카드가 나왔어요! 같이 봐요 🌸"],
  "3-4": ["오행 에너지를 분석해볼게요 🌸"],
  "4-5": ["별하선생님이 여쭤보고 싶은 게 있대요 🌸"],
  "5-6": ["풀이가 거의 완성됐어요! 🌸"],
};

export function randomStepTransitionLine(from: number, to: number): string | undefined {
  const key = `${from}-${to}`;
  const pool = STEP_TRANSITION_LINES[key];
  return pool ? pickRandom(pool) : undefined;
}
