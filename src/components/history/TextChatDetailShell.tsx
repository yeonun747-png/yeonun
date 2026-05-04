"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

export function TextChatDetailShell({
  title,
  retentionLine,
  consultHref,
  listHref = "/history/chats",
  children,
}: {
  title: string;
  retentionLine: string;
  consultHref: string;
  /** 목록으로 직접 이동(fallback); 일반적으로 router.back()과 동일한 스택 동작 */
  listHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const backToList = () => {
    if (typeof window !== "undefined" && window.history.length <= 1) {
      router.push(listHref);
      return;
    }
    router.back();
  };

  return (
    <YeonunSheetPortal>
    <div
      className="y-modal open y-tchat-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) backToList();
      }}
    >
      <div className="y-modal-sheet y-tchat-detail-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <header className="y-tchat-detail-head">
          <button type="button" className="y-modal-back" aria-label="목록으로" onClick={backToList}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="y-tchat-detail-head-title">{title}</div>
          <button type="button" className="y-modal-close" aria-label="닫기" onClick={backToList}>
            ×
          </button>
        </header>
        <div className="y-tchat-detail-scroll">{children}</div>
        <footer className="y-tchat-detail-foot">
          <p className="y-tchat-detail-retention">{retentionLine}</p>
          <Link href={consultHref} className="y-tchat-detail-cta">
            이 주제로 다시 상담하기 →
          </Link>
        </footer>
      </div>
    </div>
    </YeonunSheetPortal>
  );
}
