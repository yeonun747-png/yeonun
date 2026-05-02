"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** 마이 > 상담 히스토리 — 목업 바텀시트 */
export function CallHistorySheet({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div
      className="y-modal open y-call-hist-modal"
      role="dialog"
      aria-modal="true"
      aria-label="상담 히스토리"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push("/my");
      }}
    >
      <div className="y-modal-sheet y-call-hist-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <div className="y-modal-head">
          <Link href="/my" className="y-modal-back" scroll={false} aria-label="뒤로">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <div className="y-modal-title">상담 히스토리</div>
          <Link href="/my" className="y-modal-close" scroll={false} aria-label="닫기">
            ×
          </Link>
        </div>
        <div className="y-modal-scroll y-call-hist-scroll">{children}</div>
      </div>
    </div>
  );
}
