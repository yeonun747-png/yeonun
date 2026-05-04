"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

type Props = {
  title: string;
  ariaLabel: string;
  children: ReactNode;
  /** 뒤로·닫기·딤 탭 시 이동 (예: /notices, /support). 기본 마이 탭 */
  backHref?: string;
};

/** 마이 탭 하위(결제·설정 등) — 보관함과 동일한 바텀시트(핸들·딤·뒤로·닫기) */
export function MySubpageSheet({ title, ariaLabel, children, backHref = "/my" }: Props) {
  const router = useRouter();

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-lib-list-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) router.push(backHref);
        }}
      >
        <div className="y-modal-sheet y-lib-list-sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <Link href={backHref} className="y-modal-back" scroll={false} aria-label="뒤로">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
            <div className="y-modal-title">{title}</div>
            <Link href={backHref} className="y-modal-close" scroll={false} aria-label="닫기">
              ×
            </Link>
          </div>
          <div className="y-modal-scroll y-lib-sheet-scroll">{children}</div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
