"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { SearchOverlayTrigger } from "@/components/search/SearchOverlay";

export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useYeonunAuth();
  const showLogin = !loading && !user;

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
        {showLogin ? (
          <button
            type="button"
            className="yBtnLogin"
            onClick={() => {
              const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
              qs.set("modal", "auth");
              router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
            }}
          >
            로그인
          </button>
        ) : null}
        <SearchOverlayTrigger />
      </div>
    </nav>
  );
}

