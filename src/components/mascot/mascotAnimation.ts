import type { AnimationAction } from "three";

function lastClipSegment(clipKey: string) {
  const afterPipe = clipKey.split("|").pop() ?? clipKey;
  return afterPipe.split("/").pop() ?? afterPipe;
}

/** GLB 클립명이 `mixamo.com|Idle_9` 등으로 들어올 때 논리 이름으로 액션 찾기 */
export function getClipAction(
  actions: Record<string, AnimationAction | null | undefined>,
  logicalName: string,
): AnimationAction | null {
  const direct = actions[logicalName];
  if (direct) return direct;

  const lower = logicalName.toLowerCase();
  const keys = Object.keys(actions).filter((k) => actions[k] != null);
  if (keys.length === 0) return null;

  const normalizedLogical = lower.replace(/[\s_-]+/g, "");

  let pick =
    keys.find((k) => k === logicalName) ??
    keys.find((k) => k.toLowerCase() === lower) ??
    keys.find((k) => lastClipSegment(k) === logicalName) ??
    keys.find((k) => lastClipSegment(k).toLowerCase() === lower) ??
    keys.find((k) => k.toLowerCase().includes(lower)) ??
    keys.find((k) => k.toLowerCase().endsWith(lower)) ??
    keys.find((k) => lastClipSegment(k).toLowerCase().replace(/[\s_-]+/g, "") === normalizedLogical);

  if (!pick && /idle/i.test(logicalName)) {
    pick =
      keys.find((k) => /idle/i.test(lastClipSegment(k))) ?? keys.find((k) => /idle/i.test(k)) ?? undefined;
  }

  return pick ? (actions[pick] as AnimationAction) : null;
}

/** 카메라/조명 전용 클립 등은 제외하고 캐릭터 애니 우선 */
function pickFallbackClipKey(keys: string[]): string | undefined {
  if (keys.length === 0) return undefined;

  const skip = (k: string) =>
    /camera|sun\.|directional|ambient|spotlight|auxiliary|preview|take\s*\d|scene\s*rotation|orbit/i.test(
      k.toLowerCase(),
    );

  const usable = keys.filter((k) => !skip(k));
  const pool = usable.length ? usable : keys;

  const idle = pool.find((k) => /idle/i.test(k));
  if (idle) return idle;

  const characterish = pool.find((k) =>
    /walk|run|jump|dance|cheer|happy|shake|groove|stand|sit|wave/i.test(k),
  );
  if (characterish) return characterish;

  return pool[0];
}

/** 매칭 실패 시 보조 클립 재생 (첫 키가 카메라 클립이면 캐릭터가 안 움직임) */
export function getClipActionOrFirst(
  actions: Record<string, AnimationAction | null | undefined>,
  logicalName: string,
): AnimationAction | null {
  const strict = getClipAction(actions, logicalName);
  if (strict) return strict;
  const keys = Object.keys(actions).filter((k) => actions[k] != null);
  const pick = pickFallbackClipKey(keys);
  return pick ? (actions[pick] as AnimationAction) : null;
}
