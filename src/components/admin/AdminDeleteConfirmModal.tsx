"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

export function AdminDeleteConfirmModal({
  open,
  title,
  lead,
  meta,
  onConfirm,
  onCancel,
  confirmBusy = false,
}: {
  open: boolean;
  title: string;
  lead: React.ReactNode;
  meta?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmBusy?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirmBusy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmBusy, onCancel, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="y-admin-confirm-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        className="y-admin-confirm-modal-backdrop"
        aria-label="닫기"
        onClick={onCancel}
        disabled={confirmBusy}
      />
      <div className="y-admin-confirm-modal-dialog">
        <h3 id={titleId}>{title}</h3>
        <p className="y-admin-confirm-modal-lead">{lead}</p>
        <p className="y-admin-confirm-modal-meta">
          {meta ? (
            <>
              {meta}
              <br />
            </>
          ) : null}
          삭제 후 복구할 수 없습니다.
        </p>
        <footer className="y-admin-confirm-modal-foot">
          <button type="button" className="y-admin-confirm-modal-ghost" onClick={onCancel} disabled={confirmBusy}>
            취소
          </button>
          <button type="button" className="y-admin-confirm-modal-danger" onClick={onConfirm} disabled={confirmBusy}>
            {confirmBusy ? "삭제 중…" : "삭제"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
