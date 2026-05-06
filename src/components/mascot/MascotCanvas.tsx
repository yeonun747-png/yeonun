"use client";

import { Environment } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
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
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
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
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        invalidate();
        const el = gl.domElement;
        const onLost = (e: Event) => {
          e.preventDefault();
          onContextLost();
        };
        el.addEventListener("webglcontextlost", onLost);
      }}
    >
      <hemisphereLight args={["#ffffff", "#6e6e78", 0.48]} />
      <ambientLight intensity={0.26} />
      <directionalLight position={[6, 11, 7]} intensity={1.25} color="#ffffff" />
      <directionalLight position={[-9, 5, -5]} intensity={0.38} color="#d4dcff" />
      <InvalidateEachFrame />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.48} />
        <MascotYeon ref={yeonRef} allowMouseFollow={allowMouseFollow} />
        <MascotUn ref={unRef} isNight={isNight} />
      </Suspense>
    </Canvas>
  );
}
