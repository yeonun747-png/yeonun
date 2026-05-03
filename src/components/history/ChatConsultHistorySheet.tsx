"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

/** 마이 > 채팅상담 보관함 — 목업 바텀업 시트(핸들·뒤로·닫기·딤) */
export function ChatConsultHistorySheet({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <YeonunSheetPortal>
    <div
      className="y-modal open y-chat-consult-hist-modal"
      role="dialog"
      aria-modal="true"
      aria-label="채팅상담 보관함"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push("/my");
      }}
    >
      <div className="y-modal-sheet y-chat-consult-hist-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" aria-hidden />
        <div className="y-modal-head">
          <Link href="/my" className="y-modal-back" scroll={false} aria-label="뒤로">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <div className="y-modal-title">채팅상담 보관함</div>
          <Link href="/my" className="y-modal-close" scroll={false} aria-label="닫기">
            ×
          </Link>
        </div>
        <div className="y-modal-scroll y-chat-consult-hist-scroll">{children}</div>
      </div>
    </div>
    </YeonunSheetPortal>
  );
}
