"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

/** 홈/만남 등에서 라우트된 상세를 시트로 열 때 — 배경 블러가 페이지 전체에 적용되도록 body 포털 */
export function YeonunRoutedBottomSheetPortal({
  backHref,
  ariaLabel,
  title,
  children,
}: {
  backHref: string;
  ariaLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <YeonunSheetPortal>
      <div className="y-modal open" role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <div className="y-modal-sheet">
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <Link className="y-modal-back" href={backHref} scroll={false} aria-label="뒤로">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
            <div className="y-modal-title">{title}</div>
            <Link className="y-modal-close" href={backHref} scroll={false} aria-label="닫기">
              ×
            </Link>
          </div>
          <div className="y-modal-scroll">{children}</div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
