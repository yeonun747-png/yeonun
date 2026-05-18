"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * 메뉴 카드 → 스텝7 실시간 점사 중 이탈 차단(뒤로가기·새로고침 단축키·히스토리 pop 등).
 * 브라우저 새로고침/탭 닫기는 beforeunload 경고만 가능(완전 차단 불가).
 */
export function useFortuneMenuCardExitLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const pushTrap = () => {
      try {
        history.pushState({ fortuneMenuCardExitLock: 1 }, "", window.location.href);
      } catch {
        /* ignore */
      }
    };

    const onPopState = () => {
      pushTrap();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "f5" || ((e.ctrlKey || e.metaKey) && key === "r")) {
        e.preventDefault();
        return;
      }
      if (e.altKey && key === "arrowleft") {
        e.preventDefault();
        return;
      }
      if (key === "backspace" && !isEditableTarget(e.target)) {
        e.preventDefault();
      }
    };

    pushTrap();
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active]);
}
