"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useState, type ReactNode } from "react";

let bodyScrollLockDepth = 0;
let bodyOverflowBeforeLock = "";
let bodyPositionBeforeLock = "";
let bodyTopBeforeLock = "";
let bodyLeftBeforeLock = "";
let bodyRightBeforeLock = "";
let bodyWidthBeforeLock = "";
let htmlOverflowBeforeLock = "";
let lockedScrollY = 0;

/**
 * 바텀업 시트를 body에 포털하여 .yeonunPage overflow 등으로 backdrop-filter가 깨지지 않게 함.
 * (마이탭 만세력 상세와 동일하게 뒤 화면이 블러·딤으로 보이도록)
 */
export function YeonunSheetPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setTarget(document.body);
    bodyScrollLockDepth += 1;
    if (bodyScrollLockDepth === 1) {
      lockedScrollY = window.scrollY;
      bodyOverflowBeforeLock = document.body.style.overflow;
      bodyPositionBeforeLock = document.body.style.position;
      bodyTopBeforeLock = document.body.style.top;
      bodyLeftBeforeLock = document.body.style.left;
      bodyRightBeforeLock = document.body.style.right;
      bodyWidthBeforeLock = document.body.style.width;
      htmlOverflowBeforeLock = document.documentElement.style.overflow;

      // 모바일 브라우저 포함 배경 스크롤 완전 고정
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${lockedScrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";
      document.body.style.width = "100%";
    }
    return () => {
      bodyScrollLockDepth -= 1;
      if (bodyScrollLockDepth === 0) {
        document.body.style.overflow = bodyOverflowBeforeLock;
        document.body.style.position = bodyPositionBeforeLock;
        document.body.style.top = bodyTopBeforeLock;
        document.body.style.left = bodyLeftBeforeLock;
        document.body.style.right = bodyRightBeforeLock;
        document.body.style.width = bodyWidthBeforeLock;
        document.documentElement.style.overflow = htmlOverflowBeforeLock;
        window.scrollTo(0, lockedScrollY);
      }
    };
  }, []);

  if (!target) return <>{children}</>;
  return createPortal(children, target);
}
