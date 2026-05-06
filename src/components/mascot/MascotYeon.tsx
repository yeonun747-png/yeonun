"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import { configureMascotPbrMaterials } from "./mascotMaterials";
import { YEON_GLB, YEON_CLIP_SEQUENCE } from "./mascotAssets";
import { useMascotSequentialPlayback } from "./useMascotSequentialPlayback";
import type { MascotHandle } from "./useMascotState";
import { clientToWorldOnZPlane, worldToClient } from "./screenToWorld";

useGLTF.preload(YEON_GLB);

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

  const tailBones = useRef<THREE.Bone[]>([]);
  const earBones = useRef<THREE.Bone[]>([]);
  const tailBaseZ = useRef(new Map<THREE.Bone, number>());
  const earBaseZ = useRef(new Map<THREE.Bone, number>());
  const lotusRef = useRef<THREE.Object3D | null>(null);
  const lotusBaseY = useRef(0);
  const lotusBaseRotY = useRef(0);

  const targetWorld = useRef(new THREE.Vector3());
  const posWorld = useRef(new THREE.Vector3());

  const { camera, size, invalidate } = useThree();

  const playClip = useMascotSequentialPlayback(actions, mixer, YEON_CLIP_SEQUENCE, invalidate);

  useLayoutEffect(() => {
    configureMascotPbrMaterials(model);

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

  useImperativeHandle(
    ref,
    () => ({
      playClip,
      setIdleTimeScale: () => {},
    }),
    [playClip],
  );

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

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const scaleBase = size.width <= 480 ? 0.6 : size.width < 768 ? 0.7 : 1.0;
    const clock = state.clock;

    if (allowMouseFollow) {
      posWorld.current.lerp(targetWorld.current, 0.05);
      g.position.copy(posWorld.current);

      const tgtPx = worldToClient(targetWorld.current, camera, size);
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
