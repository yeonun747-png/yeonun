"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav className="y-bottom-nav" role="navigation" aria-label="주요 메뉴">
      <Link
        className={`y-bn-item ${isActive("/") ? "active" : ""}`}
        href="/"
        aria-label="홈"
        onClick={(e) => {
          // 같은 홈(/)에서 재클릭 시에도 “최초 접속 상태”로: 쿼리 제거 + 스크롤 최상단
          const hasQuery = typeof window !== "undefined" && window.location.search.length > 1;
          if (pathname === "/" && !hasQuery) {
            e.preventDefault();
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
            return;
          }
          if (pathname === "/" && hasQuery) {
            e.preventDefault();
            router.push("/");
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
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

