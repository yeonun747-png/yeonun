"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

/** BottomNav와 동일한 5탭 구역 */
export const SCROLL_RESET_KEY = "yeonun:bn-scroll-reset";
const SCROLL_SAVED_PREFIX = "yeonun:tab-scroll-y:";

export type PrimaryTabKey = "home" | "meet" | "today" | "content" | "my";

export function tabKeyFromPathname(pathname: string): PrimaryTabKey | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/meet")) return "meet";
  if (pathname.startsWith("/today")) return "today";
  if (pathname.startsWith("/content")) return "content";
  if (pathname.startsWith("/my")) return "my";
  return null;
}

/** 스크롤을 “탭 루트”로만 기억 (목록 등). 상세 URL에서는 덮어쓰지 않음 */
export function isTabScrollAnchorPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/meet" ||
    pathname === "/today" ||
    pathname === "/content" ||
    pathname === "/my"
  );
}

export function tabKeyFromBottomHref(href: string): PrimaryTabKey {
  if (href === "/") return "home";
  if (href === "/meet") return "meet";
  if (href === "/today") return "today";
  if (href === "/content") return "content";
  if (href === "/my") return "my";
  return "home";
}

export function scrollSavedStorageKey(tab: PrimaryTabKey): string {
  return `${SCROLL_SAVED_PREFIX}${tab}`;
}

/**
 * 5탭 루트에서만 window 스크롤을 sessionStorage에 두고,
 * 하단 탭 클릭 시에만 최상단으로 맞춤( BottomNav가 SCROLL_RESET_KEY 설정 ).
 */
export function PrimaryTabScrollClient() {
  const pathname = usePathname() || "/";
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isTabScrollAnchorPath(pathname)) return;
    const tab = tabKeyFromPathname(pathname);
    if (!tab) return;
    const key = scrollSavedStorageKey(tab);
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        try {
          if (document.body.style.position === "fixed") return;
          sessionStorage.setItem(key, String(window.scrollY));
        } catch {
          /* ignore */
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [pathname]);

  useLayoutEffect(() => {
    const tab = tabKeyFromPathname(pathname);
    if (!tab) return;

    let resetKey: string | null = null;
    try {
      resetKey = sessionStorage.getItem(SCROLL_RESET_KEY);
    } catch {
      resetKey = null;
    }

    const scrollKey = scrollSavedStorageKey(tab);

    if (resetKey === tab) {
      try {
        sessionStorage.removeItem(SCROLL_RESET_KEY);
        sessionStorage.removeItem(scrollKey);
      } catch {
        /* ignore */
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    if (!isTabScrollAnchorPath(pathname)) return;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(scrollKey);
    } catch {
      raw = null;
    }
    const y = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(y) && y > 0) {
      window.scrollTo({ top: y, left: 0, behavior: "auto" });
    }
  }, [pathname]);

  return null;
}
