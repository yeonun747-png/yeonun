"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useState, type ReactNode } from "react";

let bodyScrollLockDepth = 0;
let bodyOverflowBeforeLock = "";

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
      bodyOverflowBeforeLock = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      bodyScrollLockDepth -= 1;
      if (bodyScrollLockDepth === 0) {
        document.body.style.overflow = bodyOverflowBeforeLock;
      }
    };
  }, []);

  if (!target) return <>{children}</>;
  return createPortal(children, target);
}
