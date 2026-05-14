"use client";

import type { ReactNode } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

export function LegalInlineSheet({
  title,
  ariaLabel,
  children,
  onClose,
}: {
  title: string;
  ariaLabel: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-lib-list-modal"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="y-modal-sheet y-lib-list-sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <button type="button" className="y-modal-back" onClick={onClose} aria-label="뒤로">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
            <div className="y-modal-title">{title}</div>
            <button type="button" className="y-modal-close" onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="y-modal-scroll y-lib-sheet-scroll">
            <div className="y-sub-scroll-page">
              <main style={{ maxWidth: 720, margin: "0 auto", padding: "8px 16px 40px" }}>{children}</main>
            </div>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
