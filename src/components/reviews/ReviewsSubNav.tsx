"use client";

import { useRouter } from "next/navigation";

export function ReviewsSubNav({ title = "전체 리뷰" }: { title?: string }) {
  const router = useRouter();

  return (
    <nav className="rv-nav" aria-label="리뷰 페이지">
      <button type="button" className="rv-nav-back" onClick={() => router.back()} aria-label="뒤로">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 18L9 12l6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      <h1 className="rv-nav-title">{title}</h1>
      <div className="rv-nav-placeholder" aria-hidden="true" />
    </nav>
  );
}
