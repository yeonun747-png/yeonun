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
import type { FortuneGuideState, MascotKind, MascotPosKey } from "@/components/fortune/fortuneFlowTypes";

useGLTF.preload(YEON_GLB);
useGLTF.preload(UN_GLB);

function pickClip(kind: MascotKind, clip?: string) {
  if (clip) return clip;
  return kind === "yeon" ? YEON.idle : UN.idle;
}

/** 클론 스켈레톤에 이전 애니 포즈가 남으면 다음 클립이 일부 본만 덮어 ‘wave처럼’ 보일 수 있음 */
function resetSkinnedBindPose(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh) || !obj.skeleton) return;
    obj.skeleton.pose();
  });
}

function GuideModel({ kind, clip, yaw, onReady }: { kind: MascotKind; clip?: string; yaw: number; onReady: () => void }) {
  const path = kind === "yeon" ? YEON_GLB : UN_GLB;
  const fallback = kind === "yeon" ? YEON.idle : UN.idle;
  /** `Idle_9` 등에 `walk` 부분문자열이 섞이면 안 되므로 걷기는 `Walking` 논리명만 인정 */
  const isWalkClip = clip === YEON.walk || clip === UN.walk;
  const { scene, animations } = useGLTF(path) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene), [scene]);
  const { mixer } = useAnimations(animations, groupRef);
  const { invalidate } = useThree();
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  /** useFrame에서 키 문자열 불일치로 잘못된 액션만 stop 하는 것 방지 */
  const playbackModeRef = useRef<"walk" | "idle">("idle");
  const walkEnsureRef = useRef<{ lastBadAt: number; lastRestartAt: number }>({ lastBadAt: 0, lastRestartAt: 0 });

  /** Walking ↔ Idle 전환 시에만 사용 (제미나이 예시의 fadeOut/fadeIn — actions 전체 순회는 하지 않음) */
  const CLIP_CROSSFADE_SEC = 0.2;

  /** 개발 모드: GLB의 `animations[].name` 순서 확인용 (에디터 테이블·mascotAssets 시퀀스와 대조) */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const lines = animations.map((c, i) => `  [${i}] ${c.name}`).join("\n");
    console.info(`[MascotGuide GLB] ${kind} ← ${path}\n${lines}`);
  }, [animations, kind, path]);

  useLayoutEffect(() => {
    configureMascotPbrMaterials(model);
    onReady();
  }, [model, onReady]);

  useEffect(() => {
    const requestedName = pickClip(kind, clip);
    playbackModeRef.current = isWalkClip ? "walk" : "idle";

    /**
     * Three.js: mixer.clipAction(clip)은 같은 clip·root면 동일 AnimationAction을 반환.
     * drei's actions[name] getter는 클립마다 clipAction을 지연 생성함 → keys/actions 전체 순회는
     * 모든 클립을 믹서에 올려 바인딩이 겹치거나 '순차 재생'처럼 보일 수 있음.
     * 따라서 AnimationClip 배열에서만 고르고 clip 객체 하나로만 clipAction을 연다.
     */
    let clipObj: THREE.AnimationClip | undefined;
    if (isWalkClip) {
      clipObj =
        findAnimationClipByLogicalName(animations, requestedName) ??
        findWalkingAnimationClip(animations) ??
        findRunningAnimationClip(animations) ??
        findAnimationClipByLogicalName(animations, fallback);
    } else {
      /** Idle_9 / Idle_3 만 사용. 느슨한 폴백 시 댄스 등 다른 클립이 잡혀 ‘idle 이 아닌 것’처럼 보임 */
      clipObj = findMascotIdleAnimationClip(kind, animations);
    }

    if (!clipObj) {
      /** idle 클립 탐색 실패 시에도 이전 액션 정지 — 안 하면 걷기/댄스 클립이 그대로 루프됨 */
      mixer.stopAllAction();
      currentActionRef.current = null;
      onReady();
      invalidate();
      return;
    }

    /**
     * drei `useAnimations(clips, groupRef)`는 믹서 `_root`를 바깥 `<group ref={groupRef}>`로 둠.
     * `clipAction(clip, model)`처럼 다른 루트를 넘기면 GLB 트랙 경로와 불일치해 Idle이 본에 안 걸리고
     * 이전 클립 포즈(Superlove 등)가 남은 것처럼 보일 수 있음 → 두 번째 인자 없이 `_root`와 동일하게 바인딩.
     */
    const applyLoopAndScale = (a: THREE.AnimationAction) => {
      a.setLoop(THREE.LoopRepeat, Infinity);
      a.clampWhenFinished = false;
      a.setEffectiveTimeScale(isWalkClip ? 1.35 : 1);
      a.paused = false;
      a.enabled = true;
    };

    /**
     * 정지(idle): 먼저 전부 정지·포즈 리셋 후 clipAction — clipAction을 먼저 만들면 잠깐 이중 바인딩이 생길 수 있음.
     */
    if (!isWalkClip) {
      mixer.stopAllAction();
      resetSkinnedBindPose(model);
      const nextAction = mixer.clipAction(clipObj);
      nextAction.reset();
      applyLoopAndScale(nextAction);
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

    const prevAction = currentActionRef.current;
    const nextAction = mixer.clipAction(clipObj);

    // 이하 걷기만
    if (prevAction === nextAction && nextAction.isRunning()) {
      nextAction.paused = false;
      nextAction.enabled = true;
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
      nextAction.setEffectiveTimeScale(1.35);
      invalidate();
      return;
    }

    if (prevAction && prevAction !== nextAction) {
      prevAction.fadeOut(CLIP_CROSSFADE_SEC);
      nextAction.reset();
      applyLoopAndScale(nextAction);
      nextAction.fadeIn(CLIP_CROSSFADE_SEC).play();
    } else {
      mixer.stopAllAction();
      nextAction.reset();
      applyLoopAndScale(nextAction);
      nextAction.setEffectiveWeight(1);
      nextAction.time = 0;
      nextAction.play();
    }

    currentActionRef.current = nextAction;
    if (isWalkClip) {
      walkEnsureRef.current = { lastBadAt: 0, lastRestartAt: performance.now() };
    }
    onReady();
    invalidate();
    return undefined;
  }, [animations, mixer, clip, fallback, isWalkClip, kind, onReady]);

  useFrame((state, _delta) => {
    const g = groupRef.current;
    if (!g) return;
    // mixer.update는 drei useAnimations가 담당. 여기서는 다른 액션을 매 프레임 스캔하지 않음.
    const faceY = -yaw;
    if (playbackModeRef.current === "walk") {
      g.rotation.y = faceY;
      // Walking이 끊기는 드문 케이스만 '지연 복구' (매 프레임 reset 하면 오히려 초반 프레임만 반복됨)
      const a = currentActionRef.current;
      if (a) {
        const now = performance.now();
        if (a.paused || !a.enabled || !a.isRunning()) {
          if (walkEnsureRef.current.lastBadAt === 0) walkEnsureRef.current.lastBadAt = now;
          // 300ms 이상 '비정상'이 지속될 때만 재시작
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

function GuideCanvas({ kind, clip, yaw, onReady }: { kind: MascotKind; clip?: string; yaw: number; onReady: () => void }) {
  // 카메라는 고정, 회전은 모델에서 처리
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
        <GuideModel kind={kind} clip={clip} yaw={yaw} onReady={onReady} />
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

function walkingClip(kind: MascotKind) {
  return kind === "yeon" ? YEON.walk : UN.walk;
}

function idleClip(kind: MascotKind) {
  return kind === "yeon" ? YEON.idle : UN.idle;
}

function MascotGuideInner({
  guide,
  onArrive,
  layoutTopCenter,
}: {
  guide: FortuneGuideState;
  onArrive?: () => void;
  /** Step0–6: 말풍선 상단 정중앙 + 마스코트 가운데 정렬 */
  layoutTopCenter?: boolean;
}) {
  const guideBoxRef = useRef<HTMLDivElement>(null);
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

  const markModelReady = useCallback(() => {
    setModelReady(true);
  }, []);

  const computePosPx = useCallback((key: MascotPosKey) => {
    const stage = document.querySelector<HTMLElement>(".y-fortune-v2-stage");
    const r = stage?.getBoundingClientRect();
    const stageW = r?.width ?? Math.min(430, window.innerWidth);
    const stageH = r?.height ?? Math.max(1, window.innerHeight - 56);
    const pad = 16;
    const mascotW = 128;
    // y-fortune-v2-guide 는 stage 내부(position: relative)에서 absolute 이므로,
    // 좌표는 '뷰포트'가 아니라 'stage 내부' 기준(px)으로 계산해야 transition이 안정적으로 동작한다.
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
    const maxLeft = Math.max(0, stageW - mascotW);
    const leftL = clamp(pad, 0, maxLeft);
    const leftC = clamp((stageW - mascotW) / 2, 0, maxLeft);
    const leftR = clamp(stageW - pad - mascotW, 0, maxLeft);
    const top110 = 110;
    const top30 = 30;
    const top58 = stageH * 0.58;
    const topMr = Math.max(190, stageH * 0.36);
    const topWelcome = Math.min(stageH * 0.22, 168);

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

  const applyPos = useCallback((key: MascotPosKey) => {
    const el = guideBoxRef.current;
    if (!el) return;
    const p = computePosPx(key);
    // 어떤 CSS가 덮어써도 left/top 이동은 항상 transition 되게 강제
    el.style.transition =
      "left 1.4s cubic-bezier(0.4, 0, 0.2, 1), top 1.4s cubic-bezier(0.4, 0, 0.2, 1)";
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
  }, [computePosPx]);

  useLayoutEffect(() => {
    applyPos(posRef.current);
    const onResize = () => applyPos(posRef.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyPos]);

  const walkTo = useCallback((target: MascotPosKey, callback: () => void) => {
    if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
    const from = posRef.current;
    const nextYaw = yawForMove(from, target, yawRef.current);
    yawRef.current = nextYaw;
    setYaw(nextYaw);
    setIsMoving(true);
    posRef.current = target;
    pendingArriveRef.current = callback;
    const token = (moveTokenRef.current += 1);
    /**
     * 같은 프레임에 class가 바뀌면 브라우저가 이전 좌표를 페인트하기 전에 목표 좌표로 바뀌어
     * transition이 스킵(순간이동처럼 보임)될 수 있어 1프레임 늦춰 이동을 확실히 건다.
     */
    // React state 배치로 중간 좌표가 페인트되지 않아 transition이 스킵될 수 있어,
    // 좌표는 DOM style을 직접(from → reflow → rAF → to) 적용해 100% transition을 보장한다.
    const fromPx = computePosPx(from);
    const toPx = computePosPx(target);
    pendingMoveRef.current = {
      token,
      expectLeft: fromPx.left !== toPx.left,
      expectTop: fromPx.top !== toPx.top,
      doneLeft: false,
      doneTop: false,
    };
    applyPos(from);
    // 강제 reflow로 "from" 좌표를 확정
    guideBoxRef.current?.getBoundingClientRect();
    window.requestAnimationFrame(() => {
      applyPos(target);
      setView((prev) => ({ ...prev, pos: target }));
    });
    // transitionend가 누락되는(리플로우/탭 전환 등) 케이스 대비 폴백 타이머
    fallbackTimerRef.current = window.setTimeout(() => {
      if (!pendingArriveRef.current) return;
      const cb = pendingArriveRef.current;
      pendingArriveRef.current = null;
      pendingMoveRef.current = null;
      setIsMoving(false);
      cb();
    }, 2200);
  }, [applyPos, computePosPx, manualMode]);

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
      if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
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
    // 같은 위치(특히 최초 진입)에서는 지연 없이 즉시 도착 처리
    if (guide.pos === posRef.current) {
      setIsMoving(false);
      setView(guide);
      setBubble({ text: guide.text, name: guide.name });
      setHasArrived(true);
      return undefined;
    }
    // 수동 모드에서는 자동 가이드 이동을 잠시 멈춘다.
    if (manualMode) return undefined;
    walkTo(guide.pos, () => {
      setView(guide);
      setBubble({ text: guide.text, name: guide.name });
      setHasArrived(true);
    });
    return () => {
      if (fallbackTimerRef.current != null) window.clearTimeout(fallbackTimerRef.current);
    };
  }, [guide, walkTo]);

  useEffect(() => {
    if (!modelReady || !hasArrived || readyNotifiedRef.current) return;
    readyNotifiedRef.current = true;
    onArrive?.();
  }, [hasArrived, modelReady, onArrive]);

  return (
    <div
      ref={guideBoxRef}
      className={`y-fortune-v2-guide${layoutTopCenter && !manualMode ? " y-fortune-v2-guide--layout-top-center" : ""}${modelReady ? " is-model-ready" : " is-model-loading"}`}
      data-pos={view.pos}
      aria-live="polite"
    >
      {modelReady ? (
        <div
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
            ? { animation: "yFortuneV2MascotStep 0.38s ease-in-out infinite" }
            : { animation: "yFortuneV2MascotIdle 2.4s ease-in-out infinite" }
        }
      >
        <GuideCanvas
          kind={view.mascot}
          clip={isMoving ? walkingClip(view.mascot) : idleClip(view.mascot)}
          yaw={yaw}
          onReady={markModelReady}
        />
      </div>
    </div>
  );
}

export const MascotGuide = dynamic(() => Promise.resolve(MascotGuideInner), {
  ssr: false,
});
