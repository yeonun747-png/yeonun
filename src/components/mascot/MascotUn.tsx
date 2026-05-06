"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { getClipActionOrFirst } from "./mascotAnimation";
import { configureMascotPbrMaterials } from "./mascotMaterials";
import { UN, UN_GLB, UN_CLIP_SEQUENCE } from "./mascotAssets";
import { useMascotSequentialPlayback } from "./useMascotSequentialPlayback";
import type { MascotHandle } from "./useMascotState";
import { clientToWorldOnZPlane } from "./screenToWorld";

useGLTF.preload(UN_GLB);

export const MascotUn = forwardRef<MascotHandle, { isNight: boolean }>(function MascotUn({ isNight }, ref) {
  const { scene, animations } = useGLTF(UN_GLB) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => cloneSkinned(scene), [scene]);

  /** 운이 GLB는 클립 타깃이 씬 루트인 경우가 많아, 믹서 루트를 group이 아닌 클론 루트에 직접 둡니다. */
  const { actions, mixer } = useAnimations(animations, model);

  const earBones = useRef<THREE.Bone[]>([]);
  const earBaseZ = useRef(new Map<THREE.Bone, number>());
  const moonRef = useRef<THREE.Object3D | null>(null);
  const moonBaseY = useRef(0);
  const moonBaseRotZ = useRef(0);

  const idleTimeScaleRef = useRef(1);

  const { camera, size, invalidate } = useThree();

  const playClip = useMascotSequentialPlayback(
    actions,
    mixer,
    UN_CLIP_SEQUENCE,
    invalidate,
    UN.idle,
    idleTimeScaleRef,
  );

  useLayoutEffect(() => {
    configureMascotPbrMaterials(model);

    earBones.current = [];
    moonRef.current = null;

    model.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh && obj.skeleton) {
        for (const b of obj.skeleton.bones) {
          const n = b.name.toLowerCase();
          if (n.includes("ear")) earBones.current.push(b);
        }
      }
      const name = obj.name.toLowerCase();
      if (name.includes("moon")) {
        moonRef.current = obj;
        moonBaseY.current = obj.position.y;
        moonBaseRotZ.current = obj.rotation.z;
      }
    });

    for (const b of earBones.current) earBaseZ.current.set(b, b.rotation.z);
  }, [model]);

  const applyIdleTimeScale = useCallback(() => {
    const idle = getClipActionOrFirst(actions, UN.idle);
    if (!idle) return;
    idle.setEffectiveTimeScale(idleTimeScaleRef.current);
  }, [actions]);

  useImperativeHandle(
    ref,
    () => ({
      playClip,
      setIdleTimeScale: (s: number) => {
        idleTimeScaleRef.current = s;
        applyIdleTimeScale();
        invalidate();
      },
    }),
    [applyIdleTimeScale, invalidate, playClip],
  );

  useEffect(() => {
    idleTimeScaleRef.current = isNight ? 0.5 : 1;
    applyIdleTimeScale();
  }, [applyIdleTimeScale, isNight]);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const scaleBase = size.width <= 480 ? 0.6 : size.width < 768 ? 0.7 : 1.0;
    g.scale.setScalar(scaleBase);

    const anchorX = 20 + 60;
    const anchorY = size.height - 100 - 80;
    const w = clientToWorldOnZPlane(anchorX, anchorY, camera, size, 0);
    g.position.copy(w);

    const clock = state.clock;
    const earPhase = 0.5;
    for (const b of earBones.current) {
      const base = earBaseZ.current.get(b) ?? b.rotation.z;
      b.rotation.z = base + Math.sin(clock.elapsedTime * 1.5 + earPhase) * 0.1;
    }

    const moon = moonRef.current;
    if (moon) {
      moon.position.y = moonBaseY.current + Math.sin(clock.elapsedTime * 0.7 + 1) * 0.04;
      moon.rotation.z = moonBaseRotZ.current + Math.sin(clock.elapsedTime * 0.5) * 0.08;
    }

    invalidate();
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
});
