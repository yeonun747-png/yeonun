"use client";

import dynamic from "next/dynamic";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { getClipPlaybackMode } from "@/components/mascot/mascotClipPools";
import { MascotGlbErrorBoundary } from "@/components/mascot/MascotGlbErrorBoundary";
import { getFortuneMascotGlbUrl } from "@/components/mascot/mascotSplitGlbs";
import type { FortuneGuideState, MascotKind, MascotPosKey } from "@/components/fortune/fortuneFlowTypes";

function pickClip(kind: MascotKind, clip?: string) {
  if (clip) return clip;
  return kind === "yeon" ? YEON.idle : UN.idle;
}

/** 직선 거리 대비 초 → 화면 이동만 조절 (값↓ = 이동 더 느림). GLB 재생 속도는 별도 timeScale */
const MASCOT_MOVE_PX_PER_SEC = 60;
const MASCOT_MOVE_MIN_SEC = 0.95;
const MASCOT_MOVE_MAX_SEC = 9;
/** 걷기 분할 GLB 재생 — 화면 이동보다 빠르게 (timeScale ↑ = 클립만 빨리) */
const MASCOT_WALK_CLIP_TIME_SCALE = 1.32;
/** 반응용 원샷 클립 */
const MASCOT_ONCE_CLIP_TIME_SCALE = 1.35;
/** ease-out만 쓰면 초반에 거리 대부분을 이동해 체감 속도가 거의 안 줄어듦 → 고르게 ease-in-out */
const MASCOT_LAYOUT_MOVE_EASING = "ease-in-out";

function moveDurationSecForPixels(from: { left: number; top: number }, to: { left: number; top: number }): number {
  const dist = Math.hypot(to.left - from.left, to.top - from.top);
  if (dist < 0.5) return MASCOT_MOVE_MIN_SEC;
  const raw = dist / MASCOT_MOVE_PX_PER_SEC;
  return Math.min(MASCOT_MOVE_MAX_SEC, Math.max(MASCOT_MOVE_MIN_SEC, raw));
}

/** 말풍선 열(왼쪽) + 간격 + 마스코트 85px — `computePosPx` 의 left 는 행 전체의 왼쪽 끝 */
const BUBBLE_COLUMN_PX = 200;
const BUBBLE_MASCOT_GAP_PX = 10;
const MASCOT_GUIDE_LANE_PX = 85;
const BUBBLE_ROW_LEADING_PX = BUBBLE_COLUMN_PX + BUBBLE_MASCOT_GAP_PX;
const MASCOT_ROW_OUTER_W = BUBBLE_ROW_LEADING_PX + MASCOT_GUIDE_LANE_PX;
/** 풀이완성: 말풍선–마스코트 가로 간격(전체 행 left 계산과 CSS gap 과 일치) */
const STEP6_BUBBLE_MASCOT_GAP_PX = 4;
/** 풀이완성(스텝6): 목차 미등장 시 pack 폴백용 추가 상승 */
const STEP6_EXTRA_LIFT_PX = 300;
/** 풀이완성: 목차 카드 기준 앵커를 기존보다 추가로 위로 (px) */
const STEP6_TOC_EXTRA_ABOVE_PX = 150;
/** 메뉴 카드 진입 스텝0: 뷰포트 세로 중앙보다 추가로 올릴 픽셀 */
const STEP0_WELCOME_LIFT_PX = 150;

/**
 * 뷰포트 기준(left/top) → 스테이지 내부 absolute 좌표.
 * padding·border(clientLeft/Top) 반영 — 단순 sr.left 만 쓰면 시작점이 밀려 화면 밖에서 걷기 시작하는 현상 발생.
 */
function viewportPxToStageLocal(stage: HTMLElement, viewportLeft: number, viewportTop: number): { left: number; top: number } {
  const sr = stage.getBoundingClientRect();
  const insetL = stage.clientLeft;
  const insetT = stage.clientTop;
  const originLeft = sr.left + insetL;
  const originTop = sr.top + insetT;
  return {
    left: viewportLeft - originLeft + stage.scrollLeft,
    top: viewportTop - originTop + stage.scrollTop,
  };
}

function outerLeftFromMascotLeftEdge(mascotLeftEdge: number, viewportW: number, bubbleToMascotGapPx: number = BUBBLE_MASCOT_GAP_PX): number {
  const pad = 8;
  const leading = BUBBLE_COLUMN_PX + bubbleToMascotGapPx;
  const rowOuterW = leading + MASCOT_GUIDE_LANE_PX;
  let outerLeft = mascotLeftEdge - leading;
  outerLeft = Math.min(outerLeft, viewportW - pad - rowOuterW);
  outerLeft = Math.max(pad, outerLeft);
  return outerLeft;
}

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
      nextAction.setEffectiveTimeScale(MASCOT_ONCE_CLIP_TIME_SCALE);
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
      onReady();
      invalidate();
      return;
    }

    const applyWalkLoopAndScale = (a: THREE.AnimationAction) => {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.setEffectiveTimeScale(MASCOT_WALK_CLIP_TIME_SCALE);
      a.paused = false;
      a.enabled = true;
    };

    const prevAction = currentActionRef.current;
    const nextAction = mixer.clipAction(clipObj);

    /** drei's useFrame은 rAF에서 mixer.update — queueMicrotask로 CSS 이동을 켜면 첫 페인트 전에 클립이 한 번도 적용 안 된 것처럼 보임 */
    const advanceWalkMixerThenScheduleCss = () => {
      const dt = 1 / 45;
      for (let i = 0; i < 20; i++) mixer.update(dt);
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
      nextAction.setEffectiveTimeScale(MASCOT_WALK_CLIP_TIME_SCALE);
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
    <MascotGlbErrorBoundary label={glbUrl}>
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
        <MascotGlbErrorBoundary label={`model:${glbUrl}`}>
          <Suspense fallback={null}>
            {/* 분할 GLB(idle↔walk)마다 리마운트해야 워크 믹서가 붙음. key=kind만 두면 같은 인스턴스에서 GLB만 바뀌어 걷기 없이 CSS만 이동하는 증상 발생 */}
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
        </MascotGlbErrorBoundary>
      </Canvas>
    </MascotGlbErrorBoundary>
  );
}

/**
 * 실제 이동 픽셀 벡터로 회전한다.
 * `GuideModel`에서 최종 적용은 `rotation.y = -yaw`이므로, 7c48b43의 축 정의와 같은 `atan2(-dx, dy)`를 저장한다.
 */
function yawForWalkPixels(fromPx: { left: number; top: number }, toPx: { left: number; top: number }, prevYaw: number): number {
  const dx = toPx.left - fromPx.left;
  const dy = toPx.top - fromPx.top;
  const eps = 1.5;
  if (Math.abs(dx) < eps && Math.abs(dy) < eps) return prevYaw;
  return Math.atan2(-dx, dy);
}

const DEFAULT_MILESTONE_STEPS: { myungsik: number; questions: number; preview: number } = {
  myungsik: 3,
  questions: 5,
  preview: 6,
};

function MascotGuideInner({
  guide,
  fortuneStep,
  milestoneSteps,
  bubbleDockFixedLeft,
  bubbleDockExtraWide,
  bubbleReplayToken,
  onArrive,
  layoutTopCenter,
  reactClip,
  onReactClipDone,
}: {
  guide: FortuneGuideState;
  /** Fortune 스텝 번호(마스코트는 7 미만에서만 마운트) */
  fortuneStep: number;
  /** 상품 추가 입력 스텝 삽입 시 명식·질문·미리보기 스텝 인덱스 보정 */
  milestoneSteps?: { myungsik: number; questions: number; preview: number };
  /** 사주명식(탭 설명)·오행분석: 헤더 아래 왼쪽 슬롯에 말풍선 고정 */
  bubbleDockFixedLeft?: boolean;
  /** 명식 탭 설명만 말풍선 폭 대폭 확대(뷰포트와 겹쳐도 됨) */
  bubbleDockExtraWide?: boolean;
  /** 동일 문구 재탭 시 말풍선·15초 페이드 타이머 재시작(0이면 무시) */
  bubbleReplayToken?: number;
  onArrive?: () => void;
  /** Step0–6: 말풍선 상단 정중앙 + 마스코트 가운데 정렬 */
  layoutTopCenter?: boolean;
  /** 답변 반응 등 1회 재생 후 idle 로 돌아가야 할 논리 클립명 */
  reactClip?: string | null;
  onReactClipDone?: () => void;
}) {
  /** 부모가 매 렌더 `milestoneSteps={{...}}`를 넘기면 참조만 바뀌어 computePosPx/walkTo가 매번 새로 만들어지고, guide 동기화 effect가 걷기 중에도 재실행되어 `guide.pos===posRef`+`setYaw(0)`로 회전이 지워짐 */
  const ms = useMemo(
    () => milestoneSteps ?? DEFAULT_MILESTONE_STEPS,
    [milestoneSteps?.myungsik, milestoneSteps?.questions, milestoneSteps?.preview],
  );
  const guideBoxRef = useRef<HTMLDivElement>(null);
  const bubbleOuterRef = useRef<HTMLDivElement>(null);
  /** 명식 넓은 말풍선 래퍼: CSS vw/fixed 조합 대신 실제 레이아웃 폭(clientWidth·visualViewport)으로 기하 적용 */
  const fixedBubbleWrapRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(guide);
  const [bubble, setBubble] = useState({ text: guide.text, name: guide.name });
  const [yaw, setYaw] = useState(0);
  const yawRef = useRef(0);
  const [modelReady, setModelReady] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  /** 레이아웃 이동 walkTo 진행 중(회전 대기 포함) — reactClip이 idle을 덮어 서프라이즈로 걷는 현상 방지 */
  const [walkLayoutCycle, setWalkLayoutCycle] = useState(false);
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
  const [walkClipLogical, setWalkClipLogical] = useState<string>(() => (guide.mascot === "yeon" ? YEON.walk : UN.walk));
  const [bubbleFade, setBubbleFade] = useState<"show" | "fading" | "gone">("show");
  const bubbleFadeTimersRef = useRef<{ t1: number | null; t2: number | null }>({ t1: null, t2: null });
  /** 마운트 시 한 번만 논리 좌표→픽셀 동기화 — 스텝만 바뀌고 키가 같을 때 매번 applyPos 하면 실제 도착 위치가 덮임 */
  const layoutSnapOnceRef = useRef(false);
  /**
   * 스텝6 미만: 마스코트 캔버스 박스 뷰포트 TL — 가이드 박스가 스택(폭85)·행(스페이서200+갭)으로 바뀌어도 캐릭터 위치만 연속됨.
   * 옛날 가이드 TL만 쓰면 스텝6에서 행 기준 left가 달라져 화면 밖에서 걷기 시작하는 것처럼 보임.
   */
  const lastMascotViewportTLRef = useRef<{ left: number; top: number } | null>(null);
  const mascotCanvasOuterRef = useRef<HTMLDivElement>(null);
  const prevFortuneStepForAnchorRef = useRef(fortuneStep);
  /** 질문(5)→풀이완성(6): walkTo 시작점 — 가이드 박스 기준 뷰포트 TL(역산 후 저장) */
  const step6EntryViewportAnchorRef = useRef<{ left: number; top: number } | null>(null);

  const bubbleLeftOfMascot = fortuneStep === ms.preview;
  const useFixedBubbleDock = Boolean(bubbleDockFixedLeft);
  /** 도착 후·이동 중이 아닐 때만 말풍선 표시(이동 시작 시 즉시 숨김) */
  const showSpeechBubble = modelReady && hasArrived && !isMoving;

  const markModelReady = useCallback(() => {
    setModelReady(true);
  }, []);

  const clearReactClip = useCallback(() => {
    onReactClipDone?.();
  }, [onReactClipDone]);

  const computePosPx = useCallback(
    (key: MascotPosKey) => {
      const stage = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
      const r = stage?.getBoundingClientRect();
      const stageW = r?.width ?? Math.min(430, window.innerWidth);
      const stageH = r?.height ?? Math.max(1, window.innerHeight - 56);
      const stageLeft = r?.left ?? 0;
      const stageTop = r?.top ?? 0;
      const pad = 16;
      const mascotW = MASCOT_GUIDE_LANE_PX;
      const vw = window.innerWidth;
      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const maxLeft = Math.max(0, stageW - mascotW);
      const mascotLeftL = stageLeft + clamp(pad, 0, maxLeft);
      const mascotLeftC = stageLeft + clamp((stageW - mascotW) / 2, 0, maxLeft);
      const mascotLeftR = stageLeft + clamp(stageW - pad - mascotW, 0, maxLeft);
      const step6Lift = fortuneStep === ms.preview;
      /** 풀이완성: 헤더에 더 붙임 + 추가로 위로 올림은 pack에서 적용 */
      const topNearHeader = stageTop + (step6Lift ? 2 : 12);
      const topUpper = stageTop + (step6Lift ? 2 : 10);
      const top58 = stageTop + stageH * 0.58;
      const topMr = stageTop + Math.max(140, stageH * 0.34);
      const topWelcome = stageTop + Math.min(stageH * 0.12, 56);
      /** 질문 스텝: 스테이지 세로 중앙 부근 */
      const topScreenCenter = stageTop + Math.max(48, Math.min(stageH - 180, (stageH - 120) / 2));

      const liftTop = (t: number) => (step6Lift ? Math.max(stageTop + 2, t - STEP6_EXTRA_LIFT_PX) : t);

      const bubbleGapPx = fortuneStep === ms.preview ? STEP6_BUBBLE_MASCOT_GAP_PX : BUBBLE_MASCOT_GAP_PX;

      const pack = (mascotLeft: number, top: number) => ({
        left: bubbleLeftOfMascot ? outerLeftFromMascotLeftEdge(mascotLeft, vw, bubbleGapPx) : mascotLeft,
        top: liftTop(top),
      });

      const finalizePos = (px: { left: number; top: number }) =>
        fortuneStep === ms.preview && stage ? viewportPxToStageLocal(stage, px.left, px.top) : px;

      const mascotBoxH = 120;
      /** 질문 카드 상단보다 20px 위에서 멈춤 */
      if (fortuneStep === ms.questions && key === "center") {
        const card = document.querySelector<HTMLElement>(".y-fortune-v2-question-card");
        if (card) {
          const cr = card.getBoundingClientRect();
          const rawTop = cr.top - 20 - mascotBoxH;
          return finalizePos({
            left: bubbleLeftOfMascot ? outerLeftFromMascotLeftEdge(mascotLeftC, vw, bubbleGapPx) : mascotLeftC,
            top: Math.max(stageTop + 8, rawTop),
          });
        }
      }

      /** 풀이완성: 목차 카드 위 — 스테이지 로컬 좌표로 두어 스크롤 시 본문과 동반 이동 */
      if (fortuneStep === ms.preview && (key === "tr" || key === "rt")) {
        const toc = document.querySelector<HTMLElement>(".y-fortune-v2-toc-card");
        if (toc) {
          const tr = toc.getBoundingClientRect();
          const rawTop = tr.top - 8 - mascotBoxH - STEP6_TOC_EXTRA_ABOVE_PX;
          const desiredTop = Math.max(stageTop + 2, rawTop);
          return finalizePos({
            left: bubbleLeftOfMascot ? outerLeftFromMascotLeftEdge(mascotLeftR, vw, bubbleGapPx) : mascotLeftR,
            top: desiredTop,
          });
        }
      }

      switch (key) {
        case "tl":
          return finalizePos(pack(mascotLeftL, topNearHeader));
        case "tr":
          return finalizePos(pack(mascotLeftR, topUpper));
        case "rt":
          return finalizePos(pack(mascotLeftR, topUpper));
        case "mr":
          return finalizePos(pack(mascotLeftR, topMr));
        case "bl":
          return finalizePos(pack(mascotLeftL, top58));
        case "br":
          return finalizePos(pack(mascotLeftR, top58));
        case "welcome":
          /** 메뉴 카드 진입(스텝0): 뷰포트 정중앙에서 추가로 위로 */
          if (fortuneStep === 0) {
            const iw = window.innerWidth;
            const ih = window.innerHeight;
            return finalizePos({
              left: (iw - MASCOT_GUIDE_LANE_PX) / 2,
              top: Math.max(4, (ih - mascotBoxH) / 2 - STEP0_WELCOME_LIFT_PX),
            });
          }
          return finalizePos(pack(mascotLeftC, topWelcome));
        case "center":
          return finalizePos(pack(mascotLeftC, topScreenCenter));
        default:
          return finalizePos(pack(mascotLeftC, topNearHeader));
      }
    },
    [bubbleLeftOfMascot, fortuneStep, ms],
  );

  const applyPosCoords = useCallback((p: { left: number; top: number }, durationSec?: number | null) => {
    const el = guideBoxRef.current;
    if (!el) return;
    if (durationSec == null || durationSec <= 0) {
      el.style.transition = "none";
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
    } else {
      const dur = `${durationSec}s`;
      el.style.transition = `left ${dur} ${MASCOT_LAYOUT_MOVE_EASING}, top ${dur} ${MASCOT_LAYOUT_MOVE_EASING}`;
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
    }
    if (fortuneStep < ms.preview) {
      void el.offsetHeight;
      const mc = mascotCanvasOuterRef.current;
      if (mc) {
        const br = mc.getBoundingClientRect();
        lastMascotViewportTLRef.current = { left: br.left, top: br.top };
      }
    }
  }, [fortuneStep, ms.preview]);

  const applyPos = useCallback(
    (key: MascotPosKey) => {
      applyPosCoords(computePosPx(key));
    },
    [applyPosCoords, computePosPx],
  );

  /** 워크 분할 GLB 로드·믹서 재생 전에 CSS 이동을 시작하면 미끄러짐 — 목표 좌표를 두고 `onWalkMotionReady`에서만 적용 */
  const pendingWalkLayoutRef = useRef<{
    toPx: { left: number; top: number };
    target: MascotPosKey;
    durationSec: number;
  } | null>(null);
  const walkLayoutFallbackTimerRef = useRef<number | null>(null);

  const flushPendingWalkLayout = useCallback(() => {
    const p = pendingWalkLayoutRef.current;
    if (!p) return;
    pendingWalkLayoutRef.current = null;
    if (walkLayoutFallbackTimerRef.current != null) {
      window.clearTimeout(walkLayoutFallbackTimerRef.current);
      walkLayoutFallbackTimerRef.current = null;
    }
    applyPosCoords(p.toPx, p.durationSec);
    setView((prev) => ({ ...prev, pos: p.target }));
  }, [applyPosCoords]);

  useLayoutEffect(() => {
    if (!layoutSnapOnceRef.current) {
      layoutSnapOnceRef.current = true;
      applyPos(posRef.current);
    }
    const onLayout = () => {
      if (pendingArriveRef.current || pendingMoveRef.current) return;
      applyPos(posRef.current);
    };
    window.addEventListener("resize", onLayout);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", onLayout);
    vv?.addEventListener("scroll", onLayout);
    return () => {
      window.removeEventListener("resize", onLayout);
      vv?.removeEventListener("resize", onLayout);
      vv?.removeEventListener("scroll", onLayout);
    };
  }, [applyPos, fortuneStep, ms]);

  /** 질문 스텝: 매 레이아웃마다 마스코트 박스 뷰포트 스냅샷 */
  useLayoutEffect(() => {
    if (fortuneStep !== ms.questions || !guideBoxRef.current) return;
    const mc = mascotCanvasOuterRef.current;
    if (!mc) return;
    void guideBoxRef.current.offsetHeight;
    const br = mc.getBoundingClientRect();
    lastMascotViewportTLRef.current = { left: br.left, top: br.top };
  }, [fortuneStep, hasArrived, isMoving, view.pos, ms.questions]);

  /** 질문→미리보기: fixed·세로 스택 → absolute·가로 행 — 마스코트 TL 보존 후 가이드 TL을 역산해 스테이지 로컬 적용 */
  useLayoutEffect(() => {
    const prev = prevFortuneStepForAnchorRef.current;
    prevFortuneStepForAnchorRef.current = fortuneStep;

    if (fortuneStep !== ms.preview) {
      step6EntryViewportAnchorRef.current = null;
      return;
    }
    if (prev !== ms.questions) return;

    const stageEl = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
    const guideEl = guideBoxRef.current;
    const mascotEl = mascotCanvasOuterRef.current;
    if (!stageEl || !guideEl || !mascotEl) return;

    void guideEl.offsetHeight;
    const gr = guideEl.getBoundingClientRect();
    const mr = mascotEl.getBoundingClientRect();
    const dx = mr.left - gr.left;
    const dy = mr.top - gr.top;

    let mascotTL = lastMascotViewportTLRef.current ? { ...lastMascotViewportTLRef.current } : null;
    if (!mascotTL) {
      mascotTL = { left: mr.left, top: mr.top };
    }

    const guideViewportTL = { left: mascotTL.left - dx, top: mascotTL.top - dy };
    step6EntryViewportAnchorRef.current = guideViewportTL;
    applyPosCoords(viewportPxToStageLocal(stageEl, guideViewportTL.left, guideViewportTL.top), 0);
  }, [fortuneStep, applyPosCoords, ms.preview, ms.questions]);

  /** 질문·풀이완성: DOM이 한 박자 늦게 올라와도 목표 Y를 다시 맞춤 */
  useLayoutEffect(() => {
    if (manualMode || isMoving || !hasArrived) return;
    if (fortuneStep !== ms.questions && fortuneStep !== ms.preview) return;
    /** 미리보기 스텝 첫 렌더: posRef가 아직 질문 스텝인데 computePosPx를 호출하면 잘못된 좌표로 덮어 걷기 시작점이 깨짐 */
    if (fortuneStep === ms.preview && guide.pos !== posRef.current) return;
    const snap = () => applyPosCoords(computePosPx(posRef.current), 0);
    snap();
    const t1 = window.setTimeout(snap, 48);
    const t2 = window.setTimeout(snap, 200);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [applyPosCoords, computePosPx, fortuneStep, guide.pos, hasArrived, isMoving, manualMode, ms.preview, ms.questions, view.pos]);

  /** 이동 방향으로 먼저 회전(idle) 후, 워킹 클립 루프로 실제 이동 — 풀이완성은 지연 없이 바로 걷기 */
  const TURN_BEFORE_WALK_MS = 150;

  const walkTo = useCallback(
    (target: MascotPosKey, callback: () => void, opts?: { fromPixels?: { left: number; top: number } }) => {
      const turnMs = fortuneStep === ms.preview ? 0 : TURN_BEFORE_WALK_MS;
      if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
      pendingWalkLayoutRef.current = null;
      if (walkLayoutFallbackTimerRef.current != null) {
        window.clearTimeout(walkLayoutFallbackTimerRef.current);
        walkLayoutFallbackTimerRef.current = null;
      }

      const mk = view.mascot;
      /** 레이아웃 이동은 루프형 기본 걸음만 — Excited_Walk_F 등은 재생·이동 타이밍이 어색함 */
      const picked = mk === "yeon" ? YEON.walk : UN.walk;
      const walkGlbUrl = getFortuneMascotGlbUrl(mk === "yeon" ? "yeon" : "un", picked, mk === "yeon" ? YEON_GLB : UN_GLB);
      void useGLTF.preload(walkGlbUrl);

      const fromKey = posRef.current;
      pendingArriveRef.current = callback;
      const token = (moveTokenRef.current += 1);
      const box = guideBoxRef.current;
      const stageEl = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
      const step6Anchor = step6EntryViewportAnchorRef.current;
      const fromPx =
        opts?.fromPixels ??
        (fortuneStep === ms.preview && step6Anchor && stageEl
          ? (() => {
              step6EntryViewportAnchorRef.current = null;
              return viewportPxToStageLocal(stageEl, step6Anchor.left, step6Anchor.top);
            })()
          : box && stageEl && fortuneStep === ms.preview
            ? (() => {
                const br = box.getBoundingClientRect();
                return viewportPxToStageLocal(stageEl, br.left, br.top);
              })()
            : computePosPx(fromKey));
      const toPx = computePosPx(target);
      const nextYaw = yawForWalkPixels(fromPx, toPx, yawRef.current);
      yawRef.current = nextYaw;
      setYaw(nextYaw);

      // 회전 구간: 정면 idle 아님 — 바라보는 각도만 목표 방향으로(idle 클립)
      setIsMoving(false);

      posRef.current = target;
      const moveDurSec = moveDurationSecForPixels(fromPx, toPx);
      const noTranslate = fromPx.left === toPx.left && fromPx.top === toPx.top;

      pendingMoveRef.current = {
        token,
        expectLeft: !noTranslate && fromPx.left !== toPx.left,
        expectTop: !noTranslate && fromPx.top !== toPx.top,
        doneLeft: false,
        doneTop: false,
      };

      applyPosCoords(fromPx, 0);
      guideBoxRef.current?.getBoundingClientRect();

      const finishFacingFront = () => {
        flushPendingWalkLayout();
        if (walkLayoutFallbackTimerRef.current != null) {
          window.clearTimeout(walkLayoutFallbackTimerRef.current);
          walkLayoutFallbackTimerRef.current = null;
        }
        setWalkLayoutCycle(false);
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
          window.setTimeout(finishFacingFront, turnMs);
        });
        fallbackTimerRef.current = window.setTimeout(finishFacingFront, turnMs + 600);
        return;
      }

      clearReactClip();
      setWalkLayoutCycle(true);
      setWalkClipLogical(picked);

      const startWalkTranslate = () => {
        pendingWalkLayoutRef.current = { toPx, target, durationSec: moveDurSec };
        if (walkLayoutFallbackTimerRef.current != null) {
          window.clearTimeout(walkLayoutFallbackTimerRef.current);
        }
        walkLayoutFallbackTimerRef.current = window.setTimeout(() => {
          flushPendingWalkLayout();
          walkLayoutFallbackTimerRef.current = null;
        }, turnMs + Math.ceil(moveDurSec * 1000) + 180);

        setWalkClipLogical(picked);
        setIsMoving(true);
      };

      window.requestAnimationFrame(() => {
        window.setTimeout(startWalkTranslate, turnMs);
      });

      fallbackTimerRef.current = window.setTimeout(finishFacingFront, turnMs + Math.ceil(moveDurSec * 1000) + 420);
    },
    [applyPosCoords, clearReactClip, computePosPx, flushPendingWalkLayout, fortuneStep, ms.preview, view.mascot],
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
      setWalkLayoutCycle(false);
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
    /** walkTo가 즉시 posRef=목표로 맞춤 → 논리 위치는 이미 도착으로 보이나 pending 이동 중이면 아래에서 setYaw(0) 하면 안 됨 */
    if (guide.pos === posRef.current && pendingArriveRef.current) {
      return undefined;
    }
    readyNotifiedRef.current = false;
    setHasArrived(false);
    if (guide.pos === posRef.current) {
      if (manualMode) {
        setIsMoving(false);
        yawRef.current = 0;
        setYaw(0);
        setView(guide);
        setBubble({ text: guide.text, name: guide.name });
        setHasArrived(true);
        return undefined;
      }
      setIsMoving(false);
      yawRef.current = 0;
      setYaw(0);
      setView(guide);
      setBubble({ text: guide.text, name: guide.name });
      setHasArrived(true);
      return undefined;
    }
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
    const el = fixedBubbleWrapRef.current;
    if (!el || !useFixedBubbleDock) return;

    const clearWideInline = () => {
      el.style.removeProperty("left");
      el.style.removeProperty("right");
      el.style.removeProperty("width");
      el.style.removeProperty("max-width");
      el.style.removeProperty("margin-left");
      el.style.removeProperty("margin-right");
      el.style.removeProperty("transform");
    };

    if (!bubbleDockExtraWide) {
      clearWideInline();
      return undefined;
    }

    const applyWideBubbleLayout = () => {
      const cw =
        window.visualViewport?.width ??
        document.documentElement.clientWidth ??
        window.innerWidth;
      const gutter = 16;
      const innerMax = Math.max(0, cw - 2 * gutter);
      const w = Math.min(560, innerMax);
      const left = Math.max(gutter, (cw - w) / 2);
      el.style.setProperty("left", `${left}px`);
      el.style.setProperty("right", "auto");
      el.style.setProperty("width", `${w}px`);
      el.style.setProperty("max-width", `${w}px`);
      el.style.setProperty("margin-left", "0");
      el.style.setProperty("margin-right", "0");
      el.style.setProperty("transform", "none");
    };

    applyWideBubbleLayout();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", applyWideBubbleLayout);
    vv?.addEventListener("scroll", applyWideBubbleLayout);
    window.addEventListener("resize", applyWideBubbleLayout);
    return () => {
      vv?.removeEventListener("resize", applyWideBubbleLayout);
      vv?.removeEventListener("scroll", applyWideBubbleLayout);
      window.removeEventListener("resize", applyWideBubbleLayout);
      clearWideInline();
    };
  }, [bubbleDockExtraWide, bubble.text, hasArrived, modelReady, showSpeechBubble, useFixedBubbleDock]);

  useLayoutEffect(() => {
    const bubbleEl = bubbleOuterRef.current;
    const guideEl = guideBoxRef.current;
    if (!bubbleEl || !guideEl || !modelReady || !hasArrived) return;
    if (useFixedBubbleDock) {
      bubbleEl.style.setProperty("--bubble-adjust-x", "0px");
      bubbleEl.style.setProperty("--bubble-adjust-y", "0px");
      return;
    }
    if (bubbleLeftOfMascot) {
      bubbleEl.style.setProperty("--bubble-adjust-x", "0px");
      bubbleEl.style.setProperty("--bubble-adjust-y", "0px");
      return;
    }
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
  }, [bubble.text, bubbleLeftOfMascot, guide.text, hasArrived, modelReady, useFixedBubbleDock, view.pos]);

  /** 명식 스텝만 15초, 그 외 5초 뒤 말풍선 페이드아웃 */
  useEffect(() => {
    const cur = bubbleFadeTimersRef.current;
    if (cur.t1 != null) window.clearTimeout(cur.t1);
    if (cur.t2 != null) window.clearTimeout(cur.t2);
    bubbleFadeTimersRef.current = { t1: null, t2: null };

    if (!modelReady || !hasArrived || isMoving) {
      setBubbleFade("show");
      return undefined;
    }

    setBubbleFade("show");
    const delayMs = fortuneStep === ms.myungsik ? 15_000 : 5000;
    bubbleFadeTimersRef.current.t1 = window.setTimeout(() => {
      setBubbleFade("fading");
      bubbleFadeTimersRef.current.t2 = window.setTimeout(() => setBubbleFade("gone"), 1000);
    }, delayMs);

    return () => {
      const c = bubbleFadeTimersRef.current;
      if (c.t1 != null) window.clearTimeout(c.t1);
      if (c.t2 != null) window.clearTimeout(c.t2);
      bubbleFadeTimersRef.current = { t1: null, t2: null };
    };
  }, [bubble.text, bubble.name, bubbleReplayToken, fortuneStep, hasArrived, isMoving, modelReady]);

  /** 명식 주(柱) 재탭: guide.text가 같아도 말풍선 다시 표시 */
  useEffect(() => {
    if (!bubbleReplayToken) return;
    setBubble({ text: guide.text, name: guide.name });
    setBubbleFade("show");
  }, [bubbleReplayToken, guide.name, guide.text]);

  const bubbleFadeClass = bubbleFade === "fading" ? " is-bubble-fading" : bubbleFade === "gone" ? " is-bubble-gone" : "";

  const clipLogical =
    isMoving
      ? walkClipLogical
      : walkLayoutCycle
        ? pickClip(view.mascot, view.clip)
        : reactClip ?? pickClip(view.mascot, view.clip);

  const bubbleDockClass = useFixedBubbleDock
    ? " y-fortune-v2-bubble--fixed-dock"
    : bubbleLeftOfMascot
      ? " y-fortune-v2-bubble--beside-mascot"
      : " y-fortune-v2-bubble--stacked";

  const bubbleCard =
    modelReady && showSpeechBubble ? (
      <div
        ref={bubbleOuterRef}
        className={`y-fortune-v2-bubble y-fortune-v2-bubble--${view.mascot} y-fortune-v2-bubble--anchor-${view.pos}${bubbleDockClass}${bubbleFadeClass}`}
        key={`${bubble.text}-${view.pos}-${fortuneStep}-${useFixedBubbleDock ? "fx" : "in"}-${bubbleReplayToken ?? 0}`}
      >
        <div className="y-fortune-v2-bubble-name">{bubble.name}가 전해요</div>
        <div className="y-fortune-v2-bubble-text">{bubble.text}</div>
      </div>
    ) : null;

  const fixedBubblePortal =
    useFixedBubbleDock && bubbleCard && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={fixedBubbleWrapRef}
            className={`y-fortune-v2-bubble-fixed-wrap${bubbleDockExtraWide ? " y-fortune-v2-bubble-fixed-wrap--wide" : ""}`}
          >
            {bubbleCard}
          </div>,
          document.body,
        )
      : null;

  const bubbleInGuide =
    !useFixedBubbleDock && bubbleCard
      ? bubbleCard
      : !useFixedBubbleDock && bubbleLeftOfMascot
        ? (
            <div className="y-fortune-v2-bubble-spacer" aria-hidden />
          )
        : null;

  const mascotCanvas = (
    <div
      ref={mascotCanvasOuterRef}
      className={`y-fortune-v2-mascot-canvas ${isMoving ? "is-walking" : "is-idle"}`}
      style={
        isMoving
          ? { animation: "yFortuneV2MascotStep 0.3s ease-in-out infinite" }
          : { animation: "yFortuneV2MascotIdle 2s ease-in-out infinite" }
      }
    >
      <GuideCanvas
        kind={view.mascot}
        clipLogical={clipLogical}
        yaw={yaw}
        onReady={markModelReady}
        onOnceFinished={reactClip && !isMoving && !walkLayoutCycle ? clearReactClip : undefined}
        onWalkMotionReady={flushPendingWalkLayout}
      />
    </div>
  );

  return (
    <>
      {fixedBubblePortal}
      <div
        ref={guideBoxRef}
        className={`y-fortune-v2-guide${bubbleLeftOfMascot ? " y-fortune-v2-guide--bubble-left" : ""}${layoutTopCenter && !manualMode ? " y-fortune-v2-guide--layout-top-center" : ""}${modelReady ? " is-model-ready" : " is-model-loading"}`}
        data-pos={view.pos}
        aria-live="polite"
      >
        {bubbleLeftOfMascot ? (
          <div className="y-fortune-v2-guide-mascot-row">
            {bubbleInGuide}
            {mascotCanvas}
          </div>
        ) : (
          <div className="y-fortune-v2-guide-mascot-stack">
            {bubbleInGuide}
            {mascotCanvas}
          </div>
        )}
      </div>
    </>
  );
}

export const MascotGuide = dynamic(() => Promise.resolve(MascotGuideInner), {
  ssr: false,
});
