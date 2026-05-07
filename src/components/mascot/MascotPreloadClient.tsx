"use client";

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";

import { UN_GLB, YEON_GLB } from "@/components/mascot/mascotAssets";

export function MascotPreloadClient() {
  useEffect(() => {
    // 홈 진입 시 GLB만 미리 로드(표시는 하지 않음)
    useGLTF.preload(YEON_GLB);
    useGLTF.preload(UN_GLB);
  }, []);

  return null;
}

