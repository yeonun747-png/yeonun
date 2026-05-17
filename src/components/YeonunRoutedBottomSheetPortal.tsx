"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

/** 홈/만남 등에서 라우트된 상세를 시트로 열 때 — 배경 블러가 페이지 전체에 적용되도록 body 포털 */
export function YeonunRoutedBottomSheetPortal({
  backHref,
  ariaLabel,
  title,
  children,
  onClose,
}: {
  backHref: string;
  ariaLabel: string;
  title: string;
  children: ReactNode;
  /** 닫기 직전 클라이언트 상태 정리(즉시 시트 등) */
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const close = () => {
    onClose?.();
    // 홈에서 즉시 시트만 띄운 상태(아직 /characters 로 안 바뀜) — 상태만 정리
    if (pathname === backHref) return;
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="y-modal-sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <button type="button" className="y-modal-back" onClick={close} aria-label="뒤로">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="y-modal-title">{title}</div>
            <button type="button" className="y-modal-close" onClick={close} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="y-modal-scroll">{children}</div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
