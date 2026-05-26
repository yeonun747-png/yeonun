"use client";

import { useEffect, useRef } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { formatFortuneViewedAtKo } from "@/lib/fortune-duplicate-viewed-at";

type Props = {
  viewedAt: string;
  onRetry: () => void;
  onOpenLibrary: () => void;
  onDismiss: () => void;
};

/** 동일 상품·동일 생년월일시 보관함 중복 시 — 점사 상품 클릭 가드 */
export function FortuneDuplicateConfirmSheet({ viewedAt, onRetry, onOpenLibrary, onDismiss }: Props) {
  const libraryBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    libraryBtnRef.current?.focus();
  }, []);

  const whenLabel = formatFortuneViewedAtKo(viewedAt);

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
            이미 본 점사가 있어요
          </h2>
          <p id="y-fortune-dup-desc" className="y-fortune-dup-desc">
            {whenLabel ? (
              <>
                <strong>{whenLabel}</strong>에 점사를 보신 적이 있어요.
                <br />
                그래도 다시 보시겠어요?
              </>
            ) : (
              <>이전에 본 점사가 보관함에 있어요. 그래도 다시 보시겠어요?</>
            )}
          </p>
          <div className="y-fortune-dup-actions">
            <button type="button" className="y-fortune-dup-btn y-fortune-dup-btn--ghost" onClick={onRetry}>
              다시보기
            </button>
            <button
              ref={libraryBtnRef}
              type="button"
              className="y-fortune-dup-btn y-fortune-dup-btn--primary"
              onClick={onOpenLibrary}
            >
              점사보관함 이동
            </button>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
