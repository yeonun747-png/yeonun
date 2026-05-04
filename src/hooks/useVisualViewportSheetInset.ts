"use client";

import { type RefObject, useLayoutEffect } from "react";

/**
 * 모바일 브라우저에서 가상 키보드가 올라올 때, fixed 하단 시트가
 * 레이아웃 뷰포트 하단에 붙어 입력 영역이 키보드에 가려지는 현상을 줄입니다.
 *
 * visualViewport와 innerHeight 차이만큼 모달 루트에 padding-bottom을 두고,
 * 시트 높이를 visualViewport.height에 맞춥니다. (transform 미사용 → 시트 열림 애니메이션과 충돌 없음)
 */
export function useVisualViewportSheetInset(
  rootRef: RefObject<HTMLElement | null>,
  sheetRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const root = rootRef.current;
    const sheet = sheetRef.current;
    if (!vv || !root || !sheet) return;

    const sync = () => {
      const ih = window.innerHeight;
      const h = vv.height;
      const ot = vv.offsetTop;
      const delta = Math.max(0, ih - ot - h);
      root.style.paddingBottom = `${delta}px`;
      sheet.style.height = `${h}px`;
      sheet.style.maxHeight = `${h}px`;
    };

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    sync();

    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      root.style.paddingBottom = "";
      sheet.style.height = "";
      sheet.style.maxHeight = "";
    };
  }, [rootRef, sheetRef]);
}
