"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { getClipActionOrFirst } from "./mascotAnimation";
import { YEON, YEON_GLB } from "./mascotAssets";
import type { MascotHandle } from "./useMascotState";
import { clientToWorldOnZPlane, worldToClient } from "./screenToWorld";

useGLTF.preload(YEON_GLB);

function applyToonMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const skinning = obj instanceof THREE.SkinnedMesh;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = mats.map((m) => {
      const mat = m as THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshLambertMaterial;
      const toon = new THREE.MeshToonMaterial({
        map: mat.map ?? undefined,
        color: mat.color ?? new THREE.Color(0xffffff),
      });
      if (skinning) (toon as unknown as { skinning: boolean }).skinning = true;
      return toon;
    });
    obj.material = next.length === 1 ? next[0]! : next;
  });
}

export const MascotYeon = forwardRef<
  MascotHandle,
  { allowMouseFollow: boolean }
>(function MascotYeon({ allowMouseFollow }, ref) {
  const { scene, animations } = useGLTF(YEON_GLB) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene), [scene]);

  /** primitive ref는 마운트 타이밍 이슈가 있어, 믹서 루트는 이 group에만 둡니다. */
  const { actions, mixer } = useAnimations(animations, groupRef);

  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentNameRef = useRef<string | null>(null);
  const currentLoopRef = useRef(true);
  const finishedHandlerRef = useRef<((e: THREE.Event) => void) | null>(null);

  const tailBones = useRef<THREE.Bone[]>([]);
  const earBones = useRef<THREE.Bone[]>([]);
  const tailBaseZ = useRef(new Map<THREE.Bone, number>());
  const earBaseZ = useRef(new Map<THREE.Bone, number>());
  const lotusRef = useRef<THREE.Object3D | null>(null);
  const lotusBaseY = useRef(0);
  const lotusBaseRotY = useRef(0);

  const targetWorld = useRef(new THREE.Vector3());
  const posWorld = useRef(new THREE.Vector3());
  const stillMs = useRef(0);

  const { camera, size, invalidate } = useThree();

  useLayoutEffect(() => {
    applyToonMaterials(model);

    tailBones.current = [];
    earBones.current = [];
    lotusRef.current = null;

    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        for (const b of obj.skeleton.bones) {
          const n = b.name.toLowerCase();
          if (n.includes("tail")) tailBones.current.push(b);
          if (n.includes("ear")) earBones.current.push(b);
        }
      }
      const name = obj.name.toLowerCase();
      if (name.includes("lotus") || name.includes("flower")) {
        lotusRef.current = obj;
        lotusBaseY.current = obj.position.y;
        lotusBaseRotY.current = obj.rotation.y;
      }
    });

    for (const b of tailBones.current) tailBaseZ.current.set(b, b.rotation.z);
    for (const b of earBones.current) earBaseZ.current.set(b, b.rotation.z);
  }, [model]);

  const playClip = useCallback(
    (clipName: string, loop: boolean) => {
      if (currentNameRef.current === clipName && currentLoopRef.current === loop) return;
      const next = getClipActionOrFirst(actions, clipName);
      if (!next || !mixer) return;

      if (finishedHandlerRef.current) {
        mixer.removeEventListener("finished", finishedHandlerRef.current);
        finishedHandlerRef.current = null;
      }

      const prev = currentActionRef.current;
      if (prev && prev !== next) prev.fadeOut(0.3);

      next.reset();
      next.clampWhenFinished = !loop;
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      next.fadeIn(0.3);
      next.play();

      currentActionRef.current = next;
      currentNameRef.current = clipName;
      currentLoopRef.current = loop;

      if (!loop) {
        const onFinished = (e: THREE.Event & { action?: THREE.AnimationAction }) => {
          if (e.action !== next) return;
          mixer.removeEventListener("finished", onFinished);
          finishedHandlerRef.current = null;
          playClip(YEON.idle, true);
        };
        finishedHandlerRef.current = onFinished;
        mixer.addEventListener("finished", onFinished);
      }

      invalidate();
    },
    [actions, invalidate, mixer],
  );

  useImperativeHandle(
    ref,
    () => ({
      playClip,
      setIdleTimeScale: () => {},
    }),
    [playClip],
  );

  /** ref 마운트 직후 idle 재생 (useEffect보다 먼저 실행되어 clipAction이 안 붙는 경우 방지) */
  useLayoutEffect(() => {
    playClip(YEON.idle, true);
  }, [playClip]);

  useEffect(() => {
    if (!allowMouseFollow) return;

    const anchorX = size.width - 20 - 60;
    const anchorY = size.height - 100 - 80;
    const w = clientToWorldOnZPlane(anchorX, anchorY, camera, size, 0);
    targetWorld.current.copy(w);
    posWorld.current.copy(w);

    const onMove = (e: MouseEvent) => {
      const ox = -40;
      const oy = -48;
      const tw = clientToWorldOnZPlane(e.clientX + ox, e.clientY + oy, camera, size, 0);
      targetWorld.current.copy(tw);
      invalidate();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [allowMouseFollow, camera, invalidate, size]);

  useFrame((state, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const scaleBase = size.width <= 480 ? 0.6 : size.width < 768 ? 0.7 : 1.0;

    const ms = dt * 1000;
    const clock = state.clock;

    if (allowMouseFollow) {
      posWorld.current.lerp(targetWorld.current, 0.05);
      g.position.copy(posWorld.current);

      const curPx = worldToClient(posWorld.current, camera, size);
      const tgtPx = worldToClient(targetWorld.current, camera, size);
      const dx = tgtPx.x - curPx.x;
      const dy = tgtPx.y - curPx.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        stillMs.current += ms;
        if (stillMs.current >= 1000 && currentNameRef.current !== YEON.idle) {
          playClip(YEON.idle, true);
        }
      } else {
        stillMs.current = 0;
        if (dist >= 150) {
          if (currentNameRef.current !== YEON.run) playClip(YEON.run, true);
        } else if (dist >= 50) {
          if (currentNameRef.current === YEON.run) playClip(YEON.walk, true);
          else if (currentNameRef.current !== YEON.walk) playClip(YEON.walk, true);
        }
      }

      const face = tgtPx.x < size.width / 2 ? -1 : 1;
      g.scale.set(scaleBase * face, scaleBase, scaleBase);
    } else {
      const anchorX = size.width - 20 - 60;
      const anchorY = size.height - 100 - 80;
      const w = clientToWorldOnZPlane(anchorX, anchorY, camera, size, 0);
      g.position.copy(w);
      g.scale.setScalar(scaleBase);
    }

    for (const b of tailBones.current) {
      const base = tailBaseZ.current.get(b) ?? b.rotation.z;
      b.rotation.z = base + Math.sin(clock.elapsedTime * 2) * 0.3;
    }
    for (const b of earBones.current) {
      const base = earBaseZ.current.get(b) ?? b.rotation.z;
      b.rotation.z = base + Math.sin(clock.elapsedTime * 1.5) * 0.1;
    }

    const lotus = lotusRef.current;
    if (lotus) {
      lotus.position.y = lotusBaseY.current + Math.sin(clock.elapsedTime * 0.8) * 0.05;
      lotus.rotation.y = lotusBaseRotY.current + clock.elapsedTime * 0.005;
    }

    invalidate();
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
});
