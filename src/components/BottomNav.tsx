"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  SCROLL_RESET_KEY,
  scrollSavedStorageKey,
  tabKeyFromBottomHref,
} from "@/components/PrimaryTabScrollClient";
import { RoutePrefetcher } from "@/components/RoutePrefetcher";

const PRIMARY_ROUTES = ["/meet", "/today", "/content", "/my"];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="y-bottom-nav" role="navigation" aria-label="주요 메뉴">
      <RoutePrefetcher routes={PRIMARY_ROUTES} />
      <Link
        className={`y-bn-item ${isActive("/") ? "active" : ""}`}
        href="/"
        aria-label="홈"
        onPointerEnter={() => router.prefetch("/")}
        onFocus={() => router.prefetch("/")}
        onClick={(e) => {
          // 같은 홈(/)에서 재클릭 시에도 “최초 접속 상태”로: 쿼리 제거 + 스크롤 최상단
          const hasQuery = typeof window !== "undefined" && window.location.search.length > 1;
          if (pathname === "/" && !hasQuery) {
            e.preventDefault();
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("home"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          if (pathname === "/" && hasQuery) {
            e.preventDefault();
            router.push("/");
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("home"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          try {
            sessionStorage.setItem(SCROLL_RESET_KEY, tabKeyFromBottomHref("/"));
          } catch {
            /* ignore */
          }
        }}
      >
        <div className="y-bn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
          </svg>
        </div>
        <span className="y-bn-label">홈</span>
      </Link>

      <Link
        className={`y-bn-item signature ${isActive("/meet") ? "active" : ""}`}
        href="/meet"
        aria-label="만남"
        onPointerEnter={() => router.prefetch("/meet")}
        onFocus={() => router.prefetch("/meet")}
        onClick={(e) => {
          if (pathname === "/meet") {
            e.preventDefault();
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("meet"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          try {
            sessionStorage.setItem(SCROLL_RESET_KEY, tabKeyFromBottomHref("/meet"));
          } catch {
            /* ignore */
          }
        }}
      >
        <div className="y-bn-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
        </div>
        <span className="y-bn-label">만남</span>
      </Link>

      <Link
        className={`y-bn-item ${isActive("/today") ? "active" : ""}`}
        href="/today"
        aria-label="오늘"
        onPointerEnter={() => router.prefetch("/today")}
        onFocus={() => router.prefetch("/today")}
        onClick={(e) => {
          if (pathname === "/today") {
            e.preventDefault();
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("today"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          try {
            sessionStorage.setItem(SCROLL_RESET_KEY, tabKeyFromBottomHref("/today"));
          } catch {
            /* ignore */
          }
        }}
      >
        <div className="y-bn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3 a9 9 0 0 1 0 18 z" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <span className="y-bn-label">오늘</span>
      </Link>

      <Link
        className={`y-bn-item ${isActive("/content") ? "active" : ""}`}
        href="/content"
        aria-label="풀이"
        onPointerEnter={() => router.prefetch("/content")}
        onFocus={() => router.prefetch("/content")}
        onClick={(e) => {
          if (pathname === "/content") {
            e.preventDefault();
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("content"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          try {
            sessionStorage.setItem(SCROLL_RESET_KEY, tabKeyFromBottomHref("/content"));
          } catch {
            /* ignore */
          }
        }}
      >
        <div className="y-bn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="9" y1="4" x2="9" y2="20" />
          </svg>
        </div>
        <span className="y-bn-label">풀이</span>
      </Link>

      <Link
        className={`y-bn-item ${isActive("/my") ? "active" : ""}`}
        href="/my"
        aria-label="마이"
        onPointerEnter={() => router.prefetch("/my")}
        onFocus={() => router.prefetch("/my")}
        onClick={(e) => {
          if (pathname === "/my") {
            e.preventDefault();
            try {
              sessionStorage.removeItem(scrollSavedStorageKey("my"));
              sessionStorage.removeItem(SCROLL_RESET_KEY);
            } catch {
              /* ignore */
            }
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          try {
            sessionStorage.setItem(SCROLL_RESET_KEY, tabKeyFromBottomHref("/my"));
          } catch {
            /* ignore */
          }
        }}
      >
        <div className="y-bn-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21 a8 8 0 0 1 16 0" />
          </svg>
        </div>
        <span className="y-bn-label">마이</span>
      </Link>
    </nav>
  );
}

