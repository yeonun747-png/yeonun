"use client";

import { useEffect, useRef } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { formatFortuneViewedAtKo } from "@/lib/fortune-duplicate-viewed-at";

type Props = {
  viewedAt: string;
  onOpenLibrary: () => void;
  onDismiss: () => void;
};

/** 동일 상품·동일 생년월일시 보관함 중복 시 — 점사 상품 클릭 가드 */
export function FortuneDuplicateConfirmSheet({ viewedAt, onOpenLibrary, onDismiss }: Props) {
  const libraryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    libraryBtnRef.current?.focus();
  }, []);

  const whenLabel = formatFortuneViewedAtKo(viewedAt);
  const desc = whenLabel
    ? `${whenLabel}에 점사를 보신적이 있어요.`
    : "이전에 점사를 보신적이 있어요.";

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-fortune-dup-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="y-fortune-dup-title"
        aria-describedby="y-fortune-dup-desc"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onDismiss();
        }}
      >
        <div className="y-fortune-dup-card" onMouseDown={(e) => e.stopPropagation()}>
          <h2 id="y-fortune-dup-title" className="y-fortune-dup-title">
            이미 점사를 본적이 있어요.
          </h2>
          <p id="y-fortune-dup-desc" className="y-fortune-dup-desc">
            {desc}
          </p>
          <div className="y-fortune-dup-actions">
            <button
              ref={libraryBtnRef}
              type="button"
              className="y-fortune-dup-btn y-fortune-dup-btn--primary"
              onClick={onOpenLibrary}
            >
              완료된 점사보기
            </button>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
