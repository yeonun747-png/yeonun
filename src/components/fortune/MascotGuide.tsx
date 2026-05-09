"use client";

import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

import { configureMascotPbrMaterials } from "@/components/mascot/mascotMaterials";
import {
  findAnimationClipByLogicalName,
  findMascotIdleAnimationClip,
  findRunningAnimationClip,
  findWalkingAnimationClip,
} from "@/components/mascot/mascotAnimation";
import { UN, UN_GLB, YEON, YEON_GLB } from "@/components/mascot/mascotAssets";
import { getClipPlaybackMode, pickFromPool, walkPoolFor } from "@/components/mascot/mascotClipPools";
import { getFortuneMascotGlbUrl } from "@/components/mascot/mascotSplitGlbs";
import type { FortuneGuideState, MascotKind, MascotPosKey } from "@/components/fortune/fortuneFlowTypes";

function pickClip(kind: MascotKind, clip?: string) {
  if (clip) return clip;
  return kind === "yeon" ? YEON.idle : UN.idle;
}

/** 고정 가이드 박스 left/top 전환 시간. `finishFacingFront` 폴백과 함께 조정 */
const MASCOT_LAYOUT_MOVE_SEC = 4.25;
/** ease-out만 쓰면 초반에 거리 대부분을 이동해 체감 속도가 거의 안 줄어듦 → 고르게 ease-in-out */
const MASCOT_LAYOUT_MOVE_EASING = "ease-in-out";

/** 클론 스켈레톤에 이전 애니 포즈가 남으면 다음 클립이 일부 본만 덮어 ‘wave처럼’ 보일 수 있음 */
function resetSkinnedBindPose(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh) || !obj.skeleton) return;
    obj.skeleton.pose();
  });
}

function GuideModel({
  kind,
  clipLogical,
  yaw,
  onReady,
  onOnceFinished,
  onWalkMotionReady,
}: {
  kind: MascotKind;
  clipLogical: string;
  yaw: number;
  onReady: () => void;
  onOnceFinished?: () => void;
  /** 분할 GLB 워크 클립이 믹서에서 재생된 직후 — 그 전에 CSS left/top 이동을 시작하면 정지 포즈가 미끄러짐 */
  onWalkMotionReady?: () => void;
}) {
  const fallbackGlb = kind === "yeon" ? YEON_GLB : UN_GLB;
  const glbUrl = getFortuneMascotGlbUrl(kind === "yeon" ? "yeon" : "un", clipLogical, fallbackGlb);
  const mode = getClipPlaybackMode(kind, clipLogical);
  const nightSlow = typeof window !== "undefined" && new Date().getHours() >= 22;

  const { scene, animations } = useGLTF(glbUrl) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const { mixer } = useAnimations(animations, groupRef);
  const { invalidate } = useThree();
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  /** useFrame 분기 — 매 렌더와 클립 모드 일치(워크 GLB 첫 마운트 시 idle로 잘못 두면 미끄러짐처럼 보임) */
  const playbackModeRef = useRef<"walk" | "idle">("idle");
  playbackModeRef.current = mode === "walk" ? "walk" : "idle";
  const walkEnsureRef = useRef<{ lastBadAt: number; lastRestartAt: number }>({ lastBadAt: 0, lastRestartAt: 0 });
  const walkReadyRef = useRef(onWalkMotionReady);
  walkReadyRef.current = onWalkMotionReady;

  /** Walking ↔ Idle 전환 시에만 사용 (제미나이 예시의 fadeOut/fadeIn — actions 전체 순회는 하지 않음) */
  const CLIP_CROSSFADE_SEC = 0.2;

  /** 개발 모드: GLB의 `animations[].name` 순서 확인용 (에디터 테이블·mascotAssets 시퀀스와 대조) */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const lines = animations.map((c, i) => `  [${i}] ${c.name}`).join("\n");
    console.info(`[MascotGuide GLB] ${kind} ← ${glbUrl}\n${lines}`);
  }, [animations, kind, glbUrl]);

  useLayoutEffect(() => {
    configureMascotPbrMaterials(model);
    onReady();
  }, [model, onReady]);

  useLayoutEffect(() => {
    /**
     * Three.js: mixer.clipAction(clip)은 같은 clip·root면 동일 AnimationAction을 반환.
     * drei's actions[name] getter는 클립마다 clipAction을 지연 생성함 → keys/actions 전체 순회는
     * 모든 클립을 믹서에 올려 바인딩이 겹치거나 '순차 재생'처럼 보일 수 있음.
     * 따라서 AnimationClip 배열에서만 고르고 clip 객체 하나로만 clipAction을 연다.
     */
    let clipObj: THREE.AnimationClip | undefined;

    if (mode === "once") {
      clipObj =
        findAnimationClipByLogicalName(animations, clipLogical) ?? (animations.length === 1 ? animations[0] : undefined);
    } else if (mode === "walk") {
      /** 워크 모드에서 idle 클립으로 폴백하면 다리는 멈춘 채 CSS만 이동 → 미끄러짐. 분할 GLB는 보통 애니 1개 → 그 클립 사용 */
      clipObj =
        findAnimationClipByLogicalName(animations, clipLogical) ??
        findWalkingAnimationClip(animations) ??
        findRunningAnimationClip(animations) ??
        animations[0];
    } else {
      /** Idle_9 / Idle_3 · 분할 idle GLB */
      clipObj = findMascotIdleAnimationClip(kind, animations);
    }

    if (!clipObj) {
      mixer.stopAllAction();
      currentActionRef.current = null;
      onReady();
      invalidate();
      return;
    }

    /**
     * drei `useAnimations(clips, groupRef)`는 믹서 `_root`를 바깥 `<group ref={groupRef}>`로 둠.
     * `clipAction(clip, model)`처럼 다른 루트를 넘기면 GLB 트랙 경로와 불일치해 Idle이 본에 안 걸리고
     * 이전 클립 포즈가 남은 것처럼 보일 수 있음 → 두 번째 인자 없이 `_root`와 동일하게 바인딩.
     */
    const applyIdleLoopAndScale = (a: THREE.AnimationAction) => {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.setEffectiveTimeScale(nightSlow ? 0.6 : 1);
      a.paused = false;
      a.enabled = true;
    };

    if (mode === "once") {
      mixer.stopAllAction();
      resetSkinnedBindPose(model);
      const nextAction = mixer.clipAction(clipObj);
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      nextAction.time = 0;
      nextAction.play();
      currentActionRef.current = nextAction;

      const onFin = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== nextAction) return;
        mixer.removeEventListener("finished", onFin);
        onOnceFinished?.();
      };
      mixer.addEventListener("finished", onFin);
      onReady();
      invalidate();
      return () => {
        mixer.removeEventListener("finished", onFin);
      };
    }

    if (mode !== "walk") {
      mixer.stopAllAction();
      resetSkinnedBindPose(model);
      const nextAction = mixer.clipAction(clipObj);
      nextAction.reset();
      applyIdleLoopAndScale(nextAction);
      nextAction.setEffectiveWeight(1);
      nextAction.time = 0;
      nextAction.play();
      currentActionRef.current = nextAction;
      if (process.env.NODE_ENV === "development") {
        const i = animations.indexOf(clipObj);
        console.info("[MascotGuide idle playing]", clipObj.name, "animations[" + i + "]");
      }
      onReady();
      invalidate();
      return;
    }

    const applyWalkLoopAndScale = (a: THREE.AnimationAction) => {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.setEffectiveTimeScale(0.82);
      a.paused = false;
      a.enabled = true;
    };

    const prevAction = currentActionRef.current;
    const nextAction = mixer.clipAction(clipObj);

    /** drei's useFrame은 rAF에서 mixer.update — queueMicrotask로 CSS 이동을 켜면 첫 페인트 전에 클립이 한 번도 적용 안 된 것처럼 보임 */
    const advanceWalkMixerThenScheduleCss = () => {
      const dt = 1 / 45;
      for (let i = 0; i < 10; i++) mixer.update(dt);
      invalidate();
      requestAnimationFrame(() => {
        walkReadyRef.current?.();
      });
    };

    if (prevAction === nextAction && nextAction.isRunning()) {
      nextAction.paused = false;
      nextAction.enabled = true;
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
      nextAction.setEffectiveTimeScale(0.82);
      invalidate();
      advanceWalkMixerThenScheduleCss();
      return;
    }

    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(CLIP_CROSSFADE_SEC);
      nextAction.reset();
      applyWalkLoopAndScale(nextAction);
      nextAction.fadeIn(CLIP_CROSSFADE_SEC).play();
    } else {
      mixer.stopAllAction();
      nextAction.reset();
      applyWalkLoopAndScale(nextAction);
      nextAction.setEffectiveWeight(1);
      nextAction.time = 0;
      nextAction.play();
    }

    currentActionRef.current = nextAction;
    walkEnsureRef.current = { lastBadAt: 0, lastRestartAt: performance.now() };
    onReady();
    invalidate();
    advanceWalkMixerThenScheduleCss();
    return undefined;
  }, [animations, clipLogical, invalidate, kind, mixer, mode, nightSlow, onOnceFinished, onReady]);

  useFrame((state, _delta) => {
    const g = groupRef.current;
    if (!g) return;
    const faceY = -yaw;
    if (playbackModeRef.current === "walk") {
      g.rotation.y = faceY;
      const a = currentActionRef.current;
      if (a) {
        const now = performance.now();
        if (a.paused || !a.enabled || !a.isRunning()) {
          if (walkEnsureRef.current.lastBadAt === 0) walkEnsureRef.current.lastBadAt = now;
          if (now - walkEnsureRef.current.lastBadAt > 300 && now - walkEnsureRef.current.lastRestartAt > 500) {
            a.paused = false;
            a.enabled = true;
            a.setLoop(THREE.LoopRepeat, Infinity);
            a.clampWhenFinished = false;
            a.reset().fadeIn(0.12).play();
            walkEnsureRef.current.lastRestartAt = now;
            walkEnsureRef.current.lastBadAt = 0;
          }
        } else {
          walkEnsureRef.current.lastBadAt = 0;
        }
      }
    } else {
      g.rotation.y = faceY + Math.sin(state.clock.elapsedTime * 0.6) * 0.08;
    }
  });

  return (
    <group ref={groupRef} position={[0, -1.32, 0]} scale={[1.55, 1.55, 1.55]}>
      <primitive object={model} />
    </group>
  );
}

function GuideCanvas({
  kind,
  clipLogical,
  yaw,
  onReady,
  onOnceFinished,
  onWalkMotionReady,
}: {
  kind: MascotKind;
  clipLogical: string;
  yaw: number;
  onReady: () => void;
  onOnceFinished?: () => void;
  onWalkMotionReady?: () => void;
}) {
  const fallback = kind === "yeon" ? YEON_GLB : UN_GLB;
  const glbUrl = getFortuneMascotGlbUrl(kind === "yeon" ? "yeon" : "un", clipLogical, fallback);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0.25, 0, 6.35], fov: 36, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: 128, height: 180 }}
      onCreated={({ gl, invalidate }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        invalidate();
      }}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={1.65} />
      <Suspense fallback={null}>
        <GuideModel
          key={glbUrl}
          kind={kind}
          clipLogical={clipLogical}
          yaw={yaw}
          onReady={onReady}
          onOnceFinished={onOnceFinished}
          onWalkMotionReady={onWalkMotionReady}
        />
      </Suspense>
    </Canvas>
  );
}

const POS_ORDER: Record<MascotPosKey, number> = {
  welcome: 1,
  tl: 0,
  bl: 0,
  center: 1,
  tr: 2,
  br: 2,
  mr: 2,
  rt: 2,
};

/** 화면상의 좌/우 이동 방향 판단용(값이 클수록 오른쪽) */
const POS_X: Record<MascotPosKey, number> = {
  tl: -2,
  bl: -2,
  welcome: 0,
  center: 0,
  tr: 2,
  br: 2,
  mr: 2,
  rt: 2,
};

/** 화면상의 상/하 이동 방향 판단용(값이 클수록 아래) */
const POS_Y: Record<MascotPosKey, number> = {
  tl: 0,
  tr: 0,
  rt: 0,
  center: 1,
  welcome: 1,
  mr: 1,
  bl: 2,
  br: 2,
};

function yawForMove(from: MascotPosKey, to: MascotPosKey, prevYaw: number): number {
  const fx = POS_X[from] ?? 0;
  const fy = POS_Y[from] ?? 0;
  const tx = POS_X[to] ?? 0;
  const ty = POS_Y[to] ?? 0;
  const dx = tx - fx;
  const dy = ty - fy;
  if (dx === 0 && dy === 0) return prevYaw;
  /**
   * 연속 회전: 이동 벡터 각도만큼 바라보기.
   * 좌표계 정의:
   * - dy > 0 : 아래로 이동 → 정면(0 rad)
   * - dy < 0 : 위로 이동   → 뒤통수(π rad)
   * - dx > 0 : 오른쪽 이동 → 오른쪽(-π/2 rad)
   * - dx < 0 : 왼쪽 이동   → 왼쪽(π/2 rad)
   *
   * 따라서 yaw = atan2(-dx, dy)
   */
  return Math.atan2(-dx, dy);
}

function MascotGuideInner({
  guide,
  onArrive,
  layoutTopCenter,
  reactClip,
  onReactClipDone,
}: {
  guide: FortuneGuideState;
  onArrive?: () => void;
  /** Step0–6: 말풍선 상단 정중앙 + 마스코트 가운데 정렬 */
  layoutTopCenter?: boolean;
  /** 답변 반응 등 1회 재생 후 idle 로 돌아가야 할 논리 클립명 */
  reactClip?: string | null;
  onReactClipDone?: () => void;
}) {
  const guideBoxRef = useRef<HTMLDivElement>(null);
  const bubbleOuterRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(guide);
  const [bubble, setBubble] = useState({ text: guide.text, name: guide.name });
  const [yaw, setYaw] = useState(0);
  const yawRef = useRef(0);
  const [modelReady, setModelReady] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const pendingArriveRef = useRef<(() => void) | null>(null);
  const pendingMoveRef = useRef<{
    token: number;
    expectLeft: boolean;
    expectTop: boolean;
    doneLeft: boolean;
    doneTop: boolean;
  } | null>(null);
  const moveTokenRef = useRef(0);
  const posRef = useRef<MascotPosKey>(guide.pos);
  const readyNotifiedRef = useRef(false);
  const lastWalkClipRef = useRef<string | null>(null);
  const prevWalkTickRef = useRef<number | null>(null);
  const [walkClipLogical, setWalkClipLogical] = useState<string>(() => YEON.walk);

  const markModelReady = useCallback(() => {
    setModelReady(true);
  }, []);

  const clearReactClip = useCallback(() => {
    onReactClipDone?.();
  }, [onReactClipDone]);

  const computePosPx = useCallback((key: MascotPosKey) => {
    const stage = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
    const r = stage?.getBoundingClientRect();
    const stageW = r?.width ?? Math.min(430, window.innerWidth);
    const stageH = r?.height ?? Math.max(1, window.innerHeight - 56);
    const stageLeft = r?.left ?? 0;
    const stageTop = r?.top ?? 0;
    const pad = 16;
    const mascotW = 85;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const maxLeft = Math.max(0, stageW - mascotW);
    const leftL = stageLeft + clamp(pad, 0, maxLeft);
    const leftC = stageLeft + clamp((stageW - mascotW) / 2, 0, maxLeft);
    const leftR = stageLeft + clamp(stageW - pad - mascotW, 0, maxLeft);
    const top110 = stageTop + 110;
    const top30 = stageTop + 30;
    const top58 = stageTop + stageH * 0.58;
    const topMr = stageTop + Math.max(190, stageH * 0.36);
    const topWelcome = stageTop + Math.min(stageH * 0.22, 168);

    const root7 = document.querySelector(".y-fortune-v2-root[data-step=\"7\"]");
    const anchor = root7?.querySelector<HTMLElement>(".y-fortune-v2-step7-next-anchor");
    if (anchor && (key === "rt" || key === "tr")) {
      const ar = anchor.getBoundingClientRect();
      const boxH = 120;
      let left = ar.right + 8 - mascotW;
      let top = ar.top + ar.height / 2 - boxH / 2;
      left = clamp(left, 8, window.innerWidth - mascotW - 8);
      top = clamp(top, 8, window.innerHeight - boxH - 8);
      return { left, top };
    }

    switch (key) {
      case "tl":
        return { left: leftL, top: top110 };
      case "tr":
        return { left: leftR, top: top30 };
      case "rt":
        return { left: leftR, top: top30 };
      case "mr":
        return { left: leftR, top: topMr };
      case "bl":
        return { left: leftL, top: top58 };
      case "br":
        return { left: leftR, top: top58 };
      case "welcome":
        return { left: leftC, top: topWelcome };
      case "center":
      default:
        return { left: leftC, top: top110 };
    }
  }, []);

  const applyPosCoords = useCallback((p: { left: number; top: number }) => {
    const el = guideBoxRef.current;
    if (!el) return;
    const dur = `${MASCOT_LAYOUT_MOVE_SEC}s`;
    el.style.transition = `left ${dur} ${MASCOT_LAYOUT_MOVE_EASING}, top ${dur} ${MASCOT_LAYOUT_MOVE_EASING}`;
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
  }, []);

  const applyPos = useCallback(
    (key: MascotPosKey) => {
      applyPosCoords(computePosPx(key));
    },
    [applyPosCoords, computePosPx],
  );

  /** 워크 분할 GLB 로드·믹서 재생 전에 CSS 이동을 시작하면 미끄러짐 — 목표 좌표를 두고 `onWalkMotionReady`에서만 적용 */
  const pendingWalkLayoutRef = useRef<{ toPx: { left: number; top: number }; target: MascotPosKey } | null>(null);
  const walkLayoutFallbackTimerRef = useRef<number | null>(null);

  const flushPendingWalkLayout = useCallback(() => {
    const p = pendingWalkLayoutRef.current;
    if (!p) return;
    pendingWalkLayoutRef.current = null;
    if (walkLayoutFallbackTimerRef.current != null) {
      window.clearTimeout(walkLayoutFallbackTimerRef.current);
      walkLayoutFallbackTimerRef.current = null;
    }
    applyPosCoords(p.toPx);
    setView((prev) => ({ ...prev, pos: p.target }));
  }, [applyPosCoords]);

  useLayoutEffect(() => {
    applyPos(posRef.current);
    const onResize = () => applyPos(posRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyPos]);

  /** 이동 방향으로 먼저 회전(idle) 후, 워킹 클립 루프로 실제 이동 */
  const TURN_BEFORE_WALK_MS = 220;

  const walkTo = useCallback(
    (target: MascotPosKey, callback: () => void, opts?: { fromPixels?: { left: number; top: number } }) => {
      if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
      pendingWalkLayoutRef.current = null;
      if (walkLayoutFallbackTimerRef.current != null) {
        window.clearTimeout(walkLayoutFallbackTimerRef.current);
        walkLayoutFallbackTimerRef.current = null;
      }

      const mk = view.mascot;
      const picked = pickFromPool(walkPoolFor(mk), lastWalkClipRef.current, mk);
      lastWalkClipRef.current = picked;
      const walkGlbUrl = getFortuneMascotGlbUrl(mk === "yeon" ? "yeon" : "un", picked, mk === "yeon" ? YEON_GLB : UN_GLB);
      void useGLTF.preload(walkGlbUrl);

      const from = posRef.current;
      const nextYaw = yawForMove(from, target, yawRef.current);
      yawRef.current = nextYaw;
      setYaw(nextYaw);

      // 회전 구간: 정면 idle 아님 — 바라보는 각도만 목표 방향으로(idle 클립)
      setIsMoving(false);

      posRef.current = target;
      pendingArriveRef.current = callback;
      const token = (moveTokenRef.current += 1);
      const fromPx = opts?.fromPixels ?? computePosPx(from);
      const toPx = computePosPx(target);
      const noTranslate = fromPx.left === toPx.left && fromPx.top === toPx.top;

      pendingMoveRef.current = {
        token,
        expectLeft: !noTranslate && fromPx.left !== toPx.left,
        expectTop: !noTranslate && fromPx.top !== toPx.top,
        doneLeft: false,
        doneTop: false,
      };

      applyPosCoords(fromPx);
      guideBoxRef.current?.getBoundingClientRect();

      const finishFacingFront = () => {
        flushPendingWalkLayout();
        if (walkLayoutFallbackTimerRef.current != null) {
          window.clearTimeout(walkLayoutFallbackTimerRef.current);
          walkLayoutFallbackTimerRef.current = null;
        }
        if (!pendingArriveRef.current) return;
        const cb = pendingArriveRef.current;
        pendingArriveRef.current = null;
        pendingMoveRef.current = null;
        if (fallbackTimerRef.current != null) {
          window.clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        yawRef.current = 0;
        setYaw(0);
        setIsMoving(false);
        cb();
      };

      if (noTranslate) {
        window.requestAnimationFrame(() => {
          window.setTimeout(finishFacingFront, TURN_BEFORE_WALK_MS);
        });
        fallbackTimerRef.current = window.setTimeout(finishFacingFront, TURN_BEFORE_WALK_MS + 600);
        return;
      }

      const startWalkTranslate = () => {
        pendingWalkLayoutRef.current = { toPx, target };
        if (walkLayoutFallbackTimerRef.current != null) {
          window.clearTimeout(walkLayoutFallbackTimerRef.current);
        }
        walkLayoutFallbackTimerRef.current = window.setTimeout(() => {
          flushPendingWalkLayout();
          walkLayoutFallbackTimerRef.current = null;
        }, TURN_BEFORE_WALK_MS + 1200);

        setWalkClipLogical(picked);
        setIsMoving(true);
      };

      window.requestAnimationFrame(() => {
        window.setTimeout(startWalkTranslate, TURN_BEFORE_WALK_MS);
      });

      fallbackTimerRef.current = window.setTimeout(
        finishFacingFront,
        TURN_BEFORE_WALK_MS + Math.ceil(MASCOT_LAYOUT_MOVE_SEC * 1000) + 650,
      );
    },
    [applyPosCoords, computePosPx, flushPendingWalkLayout, view.mascot],
  );

  useEffect(() => {
    const el = guideBoxRef.current;
    if (!el) return;
    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el) return;
      if (e.propertyName !== "left" && e.propertyName !== "top") return;
      if (!pendingArriveRef.current) return;
      const pm = pendingMoveRef.current;
      if (pm) {
        if (e.propertyName === "left") pm.doneLeft = true;
        if (e.propertyName === "top") pm.doneTop = true;
        const leftOk = !pm.expectLeft || pm.doneLeft;
        const topOk = !pm.expectTop || pm.doneTop;
        if (!leftOk || !topOk) return;
      }
      const cb = pendingArriveRef.current;
      pendingArriveRef.current = null;
      pendingMoveRef.current = null;
      if (fallbackTimerRef.current != null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (walkLayoutFallbackTimerRef.current != null) {
        window.clearTimeout(walkLayoutFallbackTimerRef.current);
        walkLayoutFallbackTimerRef.current = null;
      }
      yawRef.current = 0;
      setYaw(0);
      setIsMoving(false);
      cb();
    };
    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [view.mascot]);

  const manualMoveTo = useCallback(
    (target: MascotPosKey) => {
      walkTo(target, () => setHasArrived(true));
    },
    [view.mascot, walkTo],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // M: 수동 이동 모드 토글
      if (e.key === "m" || e.key === "M") {
        setManualMode((v) => !v);
        return;
      }
      if (!manualMode) return;
      const cur = posRef.current;
      // 현재 위치 기준으로 한 칸씩 이동(항상 tl/tr로 고정 이동하지 않게)
      const stepLeft = () => {
        if (cur === "tr" || cur === "rt" || cur === "mr" || cur === "br") return "center";
        if (cur === "center" || cur === "welcome") return "tl";
        return cur; // 이미 left 계열이면 유지
      };
      const stepRight = () => {
        if (cur === "tl" || cur === "bl") return "center";
        if (cur === "center" || cur === "welcome") return "tr";
        return cur; // 이미 right 계열이면 유지
      };
      const stepUp = () => {
        if (cur === "bl") return "tl";
        if (cur === "br") return "tr";
        if (cur === "center" || cur === "welcome") return "tr"; // 상단 우측으로(오행 그래프 회피용)
        return cur;
      };
      const stepDown = () => {
        if (cur === "tl") return "bl";
        if (cur === "tr") return "br";
        if (cur === "center" || cur === "welcome") return "bl";
        return cur;
      };

      if (e.key === "ArrowLeft") manualMoveTo(stepLeft());
      if (e.key === "ArrowRight") manualMoveTo(stepRight());
      if (e.key === "ArrowUp") manualMoveTo(stepUp());
      if (e.key === "ArrowDown") manualMoveTo(stepDown());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [manualMode, manualMoveTo]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!manualMode) return;
      const stage = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      const x = (e.clientX - r.left) / Math.max(1, r.width);
      const y = (e.clientY - r.top) / Math.max(1, r.height);
      const isLeft = x < 0.33;
      const isRight = x > 0.66;
      const isTop = y < 0.5;
      let target: MascotPosKey = "center";
      if (isLeft && isTop) target = "tl";
      else if (isLeft && !isTop) target = "bl";
      else if (isRight && isTop) target = "tr";
      else if (isRight && !isTop) target = "br";
      else target = "center";
      manualMoveTo(target);
    };
    window.addEventListener("click", onClick, { capture: true });
    return () => window.removeEventListener("click", onClick, { capture: true } as any);
  }, [manualMode, manualMoveTo]);

  useEffect(() => {
    readyNotifiedRef.current = false;
    setHasArrived(false);
    const tick = guide.walkTick ?? 0;
    // 같은 슬롯에서 파트만 바뀐 경우(스텝7): 화면 오른쪽 밖에서 도크 앵커까지 걷기
    if (guide.pos === posRef.current) {
      if (manualMode) {
        setIsMoving(false);
        yawRef.current = 0;
        setYaw(0);
        setView(guide);
        setBubble({ text: guide.text, name: guide.name });
        setHasArrived(true);
        prevWalkTickRef.current = tick;
        return undefined;
      }
      const replayWalk =
        prevWalkTickRef.current !== null &&
        tick > prevWalkTickRef.current &&
        Boolean(document.querySelector('.y-fortune-v2-root[data-step="7"] .y-fortune-v2-step7-next-anchor'));
      if (replayWalk) {
        prevWalkTickRef.current = tick;
        const toPx = computePosPx(guide.pos);
        walkTo(
          guide.pos,
          () => {
            setView(guide);
            setBubble({ text: guide.text, name: guide.name });
            setHasArrived(true);
          },
          { fromPixels: { left: window.innerWidth + 120, top: toPx.top } },
        );
        return () => {
          if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
        };
      }
      prevWalkTickRef.current = tick;
      setIsMoving(false);
      yawRef.current = 0;
      setYaw(0);
      setView(guide);
      setBubble({ text: guide.text, name: guide.name });
      setHasArrived(true);
      return undefined;
    }
    prevWalkTickRef.current = tick;
    if (manualMode) return undefined;
    walkTo(guide.pos, () => {
      setView(guide);
      setBubble({ text: guide.text, name: guide.name });
      setHasArrived(true);
    });
    return () => {
      if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [computePosPx, guide, manualMode, walkTo]);

  useEffect(() => {
    if (!modelReady || !hasArrived || readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onArrive?.();
  }, [hasArrived, modelReady, onArrive]);

  useLayoutEffect(() => {
    const bubbleEl = bubbleOuterRef.current;
    const guideEl = guideBoxRef.current;
    if (!bubbleEl || !guideEl || !modelReady || !hasArrived) return;
    const pad = 8;
    const maxD = 200;
    let ax = 0;
    let ay = 0;
    for (let iter = 0; iter < 6; iter++) {
      bubbleEl.style.setProperty("--bubble-adjust-x", `${ax}px`);
      bubbleEl.style.setProperty("--bubble-adjust-y", `${ay}px`);
      const br = bubbleEl.getBoundingClientRect();
      const gr = guideEl.getBoundingClientRect();
      const mcx = gr.left + gr.width / 2;
      const mcy = gr.top + gr.height / 2;
      const bcx = br.left + br.width / 2;
      const bcy = br.top + br.height / 2;
      let dx = bcx - mcx;
      let dy = bcy - mcy;
      const dist = Math.hypot(dx, dy);
      let ox = 0;
      let oy = 0;
      if (dist > maxD && dist > 0) {
        const s = maxD / dist;
        ox += mcx + dx * s - bcx;
        oy += mcy + dy * s - bcy;
      }
      if (br.left + ox < pad) ox += pad - (br.left + ox);
      if (br.right + ox > window.innerWidth - pad) ox -= br.right + ox - (window.innerWidth - pad);
      if (br.top + oy < pad) oy += pad - (br.top + oy);
      if (br.bottom + oy > window.innerHeight - pad) oy -= br.bottom + oy - (window.innerHeight - pad);
      ax += ox;
      ay += oy;
      if (Math.abs(ox) < 0.25 && Math.abs(oy) < 0.25) break;
    }
    bubbleEl.style.setProperty("--bubble-adjust-x", `${Math.round(ax)}px`);
    bubbleEl.style.setProperty("--bubble-adjust-y", `${Math.round(ay)}px`);
  }, [bubble.text, guide.text, hasArrived, modelReady, view.pos]);

  const clipLogical =
    reactClip ??
    (isMoving ? walkClipLogical : pickClip(view.mascot, view.clip));

  return (
    <div
      ref={guideBoxRef}
      className={`y-fortune-v2-guide${layoutTopCenter && !manualMode ? " y-fortune-v2-guide--layout-top-center" : ""}${modelReady ? " is-model-ready" : " is-model-loading"}`}
      data-pos={view.pos}
      aria-live="polite"
    >
      {modelReady ? (
        <div
          ref={bubbleOuterRef}
          className={`y-fortune-v2-bubble y-fortune-v2-bubble--${view.mascot} y-fortune-v2-bubble--anchor-${view.pos}`}
          key={`${bubble.text}-${view.pos}`}
        >
          <div className="y-fortune-v2-bubble-name">{bubble.name}가 전해요</div>
          <div className="y-fortune-v2-bubble-text">{bubble.text}</div>
        </div>
      ) : null}
      <div
        className={`y-fortune-v2-mascot-canvas ${isMoving ? "is-walking" : "is-idle"}`}
        // 어떤 CSS/OS 설정이 있어도 이동 중 '걷기 리듬'이 반드시 보이게 인라인으로 강제
        style={
          isMoving
            ? { animation: "yFortuneV2MascotStep 0.56s ease-in-out infinite" }
            : { animation: "yFortuneV2MascotIdle 2.4s ease-in-out infinite" }
        }
      >
        <GuideCanvas
          kind={view.mascot}
          clipLogical={clipLogical}
          yaw={yaw}
          onReady={markModelReady}
          onOnceFinished={reactClip ? clearReactClip : undefined}
          onWalkMotionReady={flushPendingWalkLayout}
        />
      </div>
    </div>
  );
}

export const MascotGuide = dynamic(() => Promise.resolve(MascotGuideInner), {
  ssr: false,
});
