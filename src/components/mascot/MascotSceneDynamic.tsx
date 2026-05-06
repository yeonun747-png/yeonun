"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const MascotScene = dynamic(() => import("@/components/mascot/MascotScene"), {
  ssr: false,
  loading: () => null,
});

/** 서버 `layout.tsx`에서는 `ssr: false` dynamic을 쓸 수 없어 클라이언트 경계에서만 로드합니다. */
export function MascotSceneDynamic() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <MascotScene />;
}
