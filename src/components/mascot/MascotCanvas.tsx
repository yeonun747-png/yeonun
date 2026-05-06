"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense } from "react";
import { MascotUn } from "./MascotUn";
import { MascotYeon } from "./MascotYeon";
import { useMascotState } from "./useMascotState";

function InvalidateEachFrame() {
  const invalidate = useThree((s) => s.invalidate);
  useFrame(() => invalidate());
  return null;
}

export function MascotCanvas({ onContextLost }: { onContextLost: () => void }) {
  const { yeonRef, unRef, allowMouseFollow, isNight } = useMascotState();

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 9], fov: 45, near: 0.1, far: 200 }}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9000,
        pointerEvents: "none",
      }}
      onCreated={({ gl, invalidate }) => {
        gl.setClearColor(0x000000, 0);
        invalidate();
        const el = gl.domElement;
        const onLost = (e: Event) => {
          e.preventDefault();
          onContextLost();
        };
        el.addEventListener("webglcontextlost", onLost);
      }}
    >
      <ambientLight intensity={0.72} />
      <directionalLight position={[5, 10, 6]} intensity={1.05} />
      <InvalidateEachFrame />
      <Suspense fallback={null}>
        <MascotYeon ref={yeonRef} allowMouseFollow={allowMouseFollow} />
        <MascotUn ref={unRef} isNight={isNight} />
      </Suspense>
    </Canvas>
  );
}
