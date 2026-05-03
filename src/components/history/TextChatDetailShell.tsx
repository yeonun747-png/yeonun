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
  /** 대화 목록(뒤로·닫기·딤 클릭)으로 돌아갈 경로 */
  listHref?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <YeonunSheetPortal>
    <div
      className="y-modal open y-tchat-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.push(listHref);
      }}
    >
      <div className="y-modal-sheet y-tchat-detail-sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="y-modal-handle" />
        <header className="y-tchat-detail-head">
          <Link href={listHref} className="y-modal-back" scroll={false} aria-label="목록으로">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
          <div className="y-tchat-detail-head-title">{title}</div>
          <Link href={listHref} className="y-modal-close" scroll={false} aria-label="닫기">
            ×
          </Link>
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
