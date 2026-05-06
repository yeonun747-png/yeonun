"use client";

import type { AnimationAction } from "three";
import * as THREE from "three";
import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { getClipActionOrFirst } from "./mascotAnimation";

/**
 * GLB 애니 클립을 `clipSequence` 순서로 한 번씩 재생하고 끝나면 다음으로 넘어가 무한 반복합니다.
 * 외부 `playClip(name, false)`는 해당 클립이 시퀀스에 있으면 그 인덱스부터 순환을 이어갑니다.
 */
export function useMascotSequentialPlayback(
  actions: Record<string, AnimationAction | null | undefined>,
  mixer: THREE.AnimationMixer | null | undefined,
  clipSequence: readonly string[],
  invalidate: () => void,
  idleClip?: string,
  idleTimeScaleRef?: MutableRefObject<number>,
): (clipName: string, loop: boolean) => void {
  const currentActionRef = useRef<AnimationAction | null>(null);
  const finishedHandlerRef = useRef<((e: THREE.Event) => void) | null>(null);

  const applyTimeScale = useCallback(
    (clipName: string, action: AnimationAction) => {
      if (idleClip && clipName === idleClip && idleTimeScaleRef) {
        action.setEffectiveTimeScale(idleTimeScaleRef.current);
      } else {
        action.setEffectiveTimeScale(1);
      }
    },
    [idleClip, idleTimeScaleRef],
  );

  const runSequential = useCallback(
    (startIdx: number) => {
      if (!mixer || clipSequence.length === 0) return;

      if (finishedHandlerRef.current) {
        mixer.removeEventListener("finished", finishedHandlerRef.current);
        finishedHandlerRef.current = null;
      }

      const len = clipSequence.length;
      const idx = ((startIdx % len) + len) % len;
      const clipName = clipSequence[idx]!;
      const next = getClipActionOrFirst(actions, clipName);
      if (!next) return;

      const prev = currentActionRef.current;
      if (prev && prev !== next) prev.fadeOut(0.3);

      next.reset();
      next.clampWhenFinished = true;
      next.setLoop(THREE.LoopOnce, 1);
      applyTimeScale(clipName, next);
      next.fadeIn(0.3);
      next.play();

      currentActionRef.current = next;

      const onFinished = (e: THREE.Event & { action?: AnimationAction }) => {
        if (e.action !== next) return;
        mixer.removeEventListener("finished", onFinished);
        finishedHandlerRef.current = null;
        runSequential(idx + 1);
      };
      finishedHandlerRef.current = onFinished;
      mixer.addEventListener("finished", onFinished);
      invalidate();
    },
    [actions, applyTimeScale, clipSequence, invalidate, mixer],
  );

  const playClip = useCallback(
    (clipName: string, loop: boolean) => {
      if (!mixer) return;

      if (loop) {
        if (finishedHandlerRef.current) {
          mixer.removeEventListener("finished", finishedHandlerRef.current);
          finishedHandlerRef.current = null;
        }
        const next = getClipActionOrFirst(actions, clipName);
        if (!next) return;
        const prev = currentActionRef.current;
        if (prev && prev !== next) prev.fadeOut(0.3);
        next.reset();
        next.clampWhenFinished = false;
        next.setLoop(THREE.LoopRepeat, Infinity);
        applyTimeScale(clipName, next);
        next.fadeIn(0.3);
        next.play();
        currentActionRef.current = next;
        invalidate();
        return;
      }

      const hit = clipSequence.indexOf(clipName);
      if (hit >= 0) {
        runSequential(hit);
        return;
      }

      if (finishedHandlerRef.current) {
        mixer.removeEventListener("finished", finishedHandlerRef.current);
        finishedHandlerRef.current = null;
      }
      const next = getClipActionOrFirst(actions, clipName);
      if (!next) {
        runSequential(0);
        return;
      }
      const prev = currentActionRef.current;
      if (prev && prev !== next) prev.fadeOut(0.3);
      next.reset();
      next.clampWhenFinished = true;
      next.setLoop(THREE.LoopOnce, 1);
      next.setEffectiveTimeScale(1);
      next.fadeIn(0.3);
      next.play();
      currentActionRef.current = next;
      const onFinished = (e: THREE.Event & { action?: AnimationAction }) => {
        if (e.action !== next) return;
        mixer.removeEventListener("finished", onFinished);
        finishedHandlerRef.current = null;
        runSequential(0);
      };
      finishedHandlerRef.current = onFinished;
      mixer.addEventListener("finished", onFinished);
      invalidate();
    },
    [actions, applyTimeScale, clipSequence, invalidate, mixer, runSequential],
  );

  useLayoutEffect(() => {
    runSequential(0);
  }, [runSequential]);

  return playClip;
}
