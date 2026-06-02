"use client";

import { useEffect, useRef } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";

type Props = {
  open: boolean;
  onConfirm: () => void;
};

/** 스텝7 실시간 점사 중 이탈 시도 시 안내 */
export function FortuneStreamWaitAlert({ open, onConfirm }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-fortune-dup-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="y-fortune-stream-wait-title"
        aria-describedby="y-fortune-stream-wait-desc"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onConfirm();
        }}
      >
        <div className="y-fortune-dup-card" onMouseDown={(e) => e.stopPropagation()}>
          <h2 id="y-fortune-stream-wait-title" className="y-fortune-dup-title">
            점사 진행 중
          </h2>
          <p id="y-fortune-stream-wait-desc" className="y-fortune-dup-desc">
            점사가 완료될때까지 기다려주세요
          </p>
          <div className="y-fortune-dup-actions">
            <button
              ref={confirmRef}
              type="button"
              className="y-fortune-dup-btn y-fortune-dup-btn--primary"
              onClick={onConfirm}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
