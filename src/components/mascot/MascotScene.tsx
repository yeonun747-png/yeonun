"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { MascotBubble } from "./MascotBubble";
import { MascotCanvas } from "./MascotCanvas";
import { YEON, UN } from "./mascotAssets";
import { MascotStateProvider, useMascotState } from "./useMascotState";

function supportsWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function MascotSceneInner() {
  const { yeonBubble, unBubble, hideYeonBubble, hideUnBubble, yeonRef, unRef, sayYeon, sayUn } =
    useMascotState();
  const [ctxLost, setCtxLost] = useState(false);

  const onYeonClick = useCallback(() => {
    const pool = [YEON.dance3, YEON.dance, YEON.happy] as const;
    const clip = pool[Math.floor(Math.random() * pool.length)]!;
    yeonRef.current?.playClip(clip, false);
    const lines = [
      "안녕하세요! 저 연이에요 🌸",
      "오늘 인연 풀이 받아보셨나요?",
      "궁금한 게 있으면 말씀해요!",
    ] as const;
    sayYeon(lines[Math.floor(Math.random() * lines.length)]!, 2800);
  }, [sayYeon, yeonRef]);

  const onUnClick = useCallback(() => {
    unRef.current?.playClip(UN.jump, false);
    const lines = [
      "달이 오늘 밝게 빛나고 있어요",
      "운이 좋은 날이에요 ✨",
      "......(수줍)",
    ] as const;
    sayUn(lines[Math.floor(Math.random() * lines.length)]!, 2800);
  }, [sayUn, unRef]);

  if (ctxLost) return null;

  return (
    <>
      <MascotCanvas onContextLost={() => setCtxLost(true)} />
      <MascotBubble anchor="yeon" payload={yeonBubble} onClear={hideYeonBubble} />
      <MascotBubble anchor="un" payload={unBubble} onClear={hideUnBubble} />
      <button
        type="button"
        aria-label="연이와 인사하기"
        onClick={onYeonClick}
        style={{
          position: "fixed",
          right: 10,
          bottom: 90,
          width: 140,
          height: 220,
          zIndex: 9001,
          cursor: "pointer",
          background: "transparent",
          border: 0,
          padding: 0,
        }}
      />
      <button
        type="button"
        aria-label="운이와 인사하기"
        onClick={onUnClick}
        style={{
          position: "fixed",
          left: 10,
          bottom: 90,
          width: 140,
          height: 220,
          zIndex: 9001,
          cursor: "pointer",
          background: "transparent",
          border: 0,
          padding: 0,
        }}
      />
    </>
  );
}

export default function MascotScene() {
  const [ok] = useState(() => supportsWebGL());
  const pathname = usePathname();

  // 홈/점사/마이/오늘/풀이(content): 전역 마스코트 비표시(홈은 별도 프리로드 유지)
  if (
    !ok ||
    pathname === "/" ||
    pathname.startsWith("/fortune") ||
    pathname.startsWith("/my") ||
    pathname.startsWith("/today") ||
    pathname.startsWith("/content")
  )
    return null;

  return (
    <MascotStateProvider>
      <MascotSceneInner />
    </MascotStateProvider>
  );
}
