import type { AnimationAction, AnimationClip } from "three";

import { UN_CLIP_SEQUENCE, YEON_CLIP_SEQUENCE } from "./mascotAssets";

function lastClipSegment(clipKey: string) {
  const afterPipe = clipKey.split("|").pop() ?? clipKey;
  return afterPipe.split("/").pop() ?? afterPipe;
}

/** GLB/에디터에서 `Walking_withSkin` 처럼 붙는 접미사 제거 → 논리 클립명 `Walking` 과 매칭 */
export function clipSegmentWithoutWithSkin(clipKey: string): string {
  return lastClipSegment(clipKey).replace(/_withSkin$/i, "");
}

/** `mixamo.com|Idle_9` · `Idle_9` · 경로에 Idle 포함 등 모든 구분자로 쪼개서 토큰 일치 검사 */
function clipNameHasSegment(name: string, token: string): boolean {
  const t = token.toLowerCase();
  return name
    .split(/[|\\/]/)
    .map((s) => s.trim())
    .some((part) => part.toLowerCase() === t);
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
    keys.find((k) => clipSegmentWithoutWithSkin(k) === logicalName) ??
    keys.find((k) => lastClipSegment(k).toLowerCase() === lower) ??
    keys.find((k) => lastClipSegment(k).toLowerCase().replace(/[\s_-]+/g, "") === normalizedLogical);

  if (!pick && /idle/i.test(logicalName)) {
    const num = logicalName.match(/(\d+)/)?.[1];
    if (num) {
      const re = new RegExp(`^Idle_${num}$`, "i");
      pick = keys.find((k) => re.test(clipSegmentWithoutWithSkin(k)));
    }
    if (!pick) {
      pick =
        keys.find((k) => /^Idle_\d+$/i.test(clipSegmentWithoutWithSkin(k))) ??
        keys.find((k) => /idle/i.test(clipSegmentWithoutWithSkin(k))) ??
        undefined;
    }
  }

  return pick ? (actions[pick] as AnimationAction) : null;
}

/**
 * GLB의 AnimationClip 배열에서 논리 이름으로 클립만 고른다.
 * drei's `actions` getter를 건드리지 않기 위해 사용 — Three.js 권장: clip 객체로 clipAction 한 번만 연결.
 */
export function findAnimationClipByLogicalName(clips: AnimationClip[], logicalName: string): AnimationClip | undefined {
  const lower = logicalName.toLowerCase();
  const normalizedLogical = lower.replace(/[\s_-]+/g, "");

  /**
   * 전체 이름 includes(lower) 금지: 예) logical `Idle_9` 인데 `Idle_90`·`Idle_19` 가
   * `"…idle_90…".includes("idle_9")` 로 먼저 매칭되는 오류 방지.
   */
  let pick =
    clips.find((c) => c.name === logicalName) ??
    clips.find((c) => c.name.toLowerCase() === lower) ??
    clips.find((c) => lastClipSegment(c.name) === logicalName) ??
    clips.find((c) => clipSegmentWithoutWithSkin(c.name) === logicalName) ??
    clips.find((c) => lastClipSegment(c.name).toLowerCase() === lower) ??
    clips.find(
      (c) => lastClipSegment(c.name).toLowerCase().replace(/[\s_-]+/g, "") === normalizedLogical,
    );

  if (!pick && /idle/i.test(logicalName)) {
    /** 배열 앞쪽의 임의 Idle_* 가 아니라, 이름과 같은 번호의 Idle 만 (실패 시에만 첫 idle) */
    const num = logicalName.match(/(\d+)/)?.[1];
    if (num) {
      const re = new RegExp(`^Idle_${num}$`, "i");
      pick = clips.find((c) => re.test(clipSegmentWithoutWithSkin(c.name)));
    }
    if (!pick) {
      pick =
        clips.find((c) => /^Idle_\d+$/i.test(clipSegmentWithoutWithSkin(c.name))) ??
        clips.find((c) => /idle/i.test(clipSegmentWithoutWithSkin(c.name)));
    }
  }

  return pick;
}

/**
 * GLB `animations[]` 순서 = 에디터 테이블 ID 순(사용자 확인). idle 슬롯은 고정 인덱스.
 * 이름-only 매칭·lookbehind 정규식보다 이 경로가 가장 안전(Superlove 등 엉뚱한 클립 방지).
 */
/** 분할 GLB는 보통 애니가 1개뿐이라 인덱스 고정은 보조용 */
const MASCOT_IDLE_CLIP_INDEX: Record<"yeon" | "un", number> = {
  yeon: 0,
  un: 0,
};

/** 점사 마스코트: 연이 = Idle_9, 운이 = Idle_3 */
export function findMascotIdleAnimationClip(kind: "yeon" | "un", clips: AnimationClip[]): AnimationClip | undefined {
  const token = kind === "yeon" ? "Idle_9" : "Idle_3";
  const preferIdx = MASCOT_IDLE_CLIP_INDEX[kind];

  if (clips[preferIdx]) {
    const seg = clipSegmentWithoutWithSkin(clips[preferIdx].name).trim();
    if (seg === token || seg.toLowerCase() === token.toLowerCase()) {
      return clips[preferIdx];
    }
  }

  const byLastSeg = clips.find((c) => {
    const seg = clipSegmentWithoutWithSkin(c.name).trim();
    return seg === token || seg.toLowerCase() === token.toLowerCase();
  });
  if (byLastSeg) return byLastSeg;

  const byAnySeg = clips.find((c) => clipNameHasSegment(c.name, token));
  if (byAnySeg) return byAnySeg;

  const seq = kind === "yeon" ? YEON_CLIP_SEQUENCE : UN_CLIP_SEQUENCE;
  const idx = (seq as readonly string[]).indexOf(token);
  if (idx >= 0 && idx < clips.length) {
    return clips[idx];
  }

  return undefined;
}

/** 걷기: 표준 클립명 `Walking` 우선(Excited_Walk_F 등 제외) */
export function findWalkingAnimationClip(clips: AnimationClip[]): AnimationClip | undefined {
  const bySeg = clips.find((c) => /^Walking$/i.test(clipSegmentWithoutWithSkin(c.name)));
  if (bySeg) return bySeg;
  return clips.find((c) => /walk/i.test(clipSegmentWithoutWithSkin(c.name)));
}

export function findRunningAnimationClip(clips: AnimationClip[]): AnimationClip | undefined {
  const seg = (c: AnimationClip) => clipSegmentWithoutWithSkin(c.name);
  return (
    clips.find((c) => /^Running$/i.test(seg(c))) ??
    clips.find((c) => /^Animation_Running$/i.test(seg(c))) ??
    clips.find((c) => /run/i.test(seg(c)))
  );
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
