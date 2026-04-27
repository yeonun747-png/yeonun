"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const goHomeInitial = () => {
    // 같은 홈(/)에서 재클릭 시에도 “최초 접속 상태”로: 쿼리 제거 + 스크롤 최상단
    const hasQuery = typeof window !== "undefined" && window.location.search.length > 1;
    if (pathname !== "/" || hasQuery) {
      router.push("/");
    }
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  return (
    <nav className="yNav" aria-label="상단 메뉴">
      <Link
        className="yLogo"
        href="/"
        aria-label="연운 홈으로"
        onClick={(e) => {
          e.preventDefault();
          goHomeInitial();
        }}
      >
        <span className="yLogoMark">연운</span>
        <span className="yLogoHan">緣運</span>
      </Link>

      <div className="yNavActions">
        <Link className="yBtnLogin" href="/?modal=auth">
          로그인
        </Link>
        <Link className="yBtnIcon" href="/search" aria-label="검색">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      </div>
    </nav>
  );
}

