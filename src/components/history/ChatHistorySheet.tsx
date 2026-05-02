"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** 마이 > 텍스트 대화 기록 — 목업 바텀시트 */
export function ChatHistorySheet({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <div
      className="y-modal open y-tchat-list-modal"
      role="dialog"
      aria-modal="true"
      aria-label="텍스트 대화 기록"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push("/my");
      }}
    >
      <div className="y-modal-sheet y-tchat-list-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <div className="y-modal-head">
          <Link href="/my" className="y-modal-back" scroll={false} aria-label="뒤로">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <div className="y-modal-title">텍스트 대화 기록</div>
          <Link href="/my" className="y-modal-close" scroll={false} aria-label="닫기">
            ×
          </Link>
        </div>
        <div className="y-modal-scroll y-tchat-list-scroll">{children}</div>
      </div>
    </div>
  );
}
