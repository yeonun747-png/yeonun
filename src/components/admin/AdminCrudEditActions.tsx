"use client";

import { useCallback, useRef, useState } from "react";

import { AdminDeleteConfirmModal } from "@/components/admin/AdminDeleteConfirmModal";

export function AdminCrudEditActions({
  saveFormId,
  saveLabel = "수정 저장",
  saveDisabled = false,
  deleteAction,
  deleteFields,
  deleteModalTitle,
  deleteItemLabel,
  deleteLeadSuffix,
  deleteMeta,
  onDeleteConfirm,
  onClose,
  confirmBusy = false,
}: {
  saveFormId: string;
  saveLabel?: string;
  saveDisabled?: boolean;
  deleteAction?: string;
  deleteFields?: Record<string, string>;
  deleteModalTitle: string;
  deleteItemLabel: string;
  deleteLeadSuffix: string;
  deleteMeta?: string;
  onDeleteConfirm?: () => void | Promise<void>;
  onClose?: () => void;
  confirmBusy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const handleConfirm = useCallback(() => {
    void (async () => {
      if (onDeleteConfirm) {
        await onDeleteConfirm();
        setOpen(false);
        return;
      }
      setOpen(false);
      deleteFormRef.current?.requestSubmit();
    })();
  }, [onDeleteConfirm]);

  return (
    <>
      <div className="y-admin-crud-edit-actions">
        <button
          type="button"
          className="y-admin-crud-edit-actions__delete y-admin-danger-pill"
          onClick={() => setOpen(true)}
          disabled={saveDisabled || confirmBusy}
        >
          삭제
        </button>
        <button
          form={saveFormId}
          type="submit"
          className="y-admin-crud-edit-actions__save y-admin-edit-save-btn"
          disabled={saveDisabled || confirmBusy}
        >
          {saveLabel}
        </button>
        {onClose ? (
          <button type="button" className="y-admin-crud-edit-actions__close y-admin-pill-btn" onClick={onClose} disabled={confirmBusy}>
            닫기
          </button>
        ) : null}
      </div>
      {deleteAction ? (
        <form ref={deleteFormRef} action={deleteAction} method="post" hidden>
          {Object.entries(deleteFields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      ) : null}
      <AdminDeleteConfirmModal
        open={open}
        title={deleteModalTitle}
        lead={
          <>
            <strong>{deleteItemLabel}</strong> {deleteLeadSuffix}
          </>
        }
        meta={deleteMeta}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
        confirmBusy={confirmBusy}
      />
    </>
  );
}
