"use client";

import dynamic from "next/dynamic";

const MascotScene = dynamic(() => import("@/components/mascot/MascotScene"), {
  ssr: false,
  loading: () => null,
});

/** 서버 `layout.tsx`에서는 `ssr: false` dynamic을 쓸 수 없어 클라이언트 경계에서만 로드합니다. */
export function MascotSceneDynamic() {
  return <MascotScene />;
}
