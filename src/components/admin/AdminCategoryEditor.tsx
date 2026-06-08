"use client";

import { useCallback, useRef, useState, type CSSProperties } from "react";

import { AdminDeleteConfirmModal } from "@/components/admin/AdminDeleteConfirmModal";

type Row = Record<string, unknown>;

function text(v: unknown, fallback = "") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

const ACTION_ROW_STYLE: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "nowrap",
  alignItems: "center",
  gap: 8,
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 14px 14px",
};

const SAVE_BTN_STYLE: CSSProperties = {
  flex: "1 1 auto",
  minWidth: 0,
};

const PILL_BTN_STYLE: CSSProperties = {
  flex: "0 0 auto",
};

export function AdminCategoryEditor({ row }: { row: Row }) {
  const slug = text(row.slug, "");
  const label = text(row.label, "");
  const editFormId = `edit-category-${slug}`;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const confirmDelete = useCallback(() => {
    setDeleteOpen(false);
    deleteFormRef.current?.requestSubmit();
  }, []);

  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{label}</strong>
          <em>
            {slug} · sort {text(row.sort_order)}
          </em>
        </span>
        <span className="y-admin-pill">카테고리</span>
      </summary>
      <form id={editFormId} action="/admin/categories" method="post" className="y-admin-form y-admin-edit-form">
        <input name="slug" defaultValue={slug} />
        <input name="label" defaultValue={label} />
        <input name="sort_order" defaultValue={text(row.sort_order, "0")} inputMode="numeric" />
      </form>
      <div
        className="y-admin-crud-edit-actions"
        style={ACTION_ROW_STYLE}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="y-admin-danger-pill"
          style={PILL_BTN_STYLE}
          onClick={() => setDeleteOpen(true)}
        >
          삭제
        </button>
        <button
          form={editFormId}
          type="submit"
          className="y-admin-crud-edit-actions__save y-admin-edit-save-btn"
          style={SAVE_BTN_STYLE}
        >
          수정 저장
        </button>
      </div>
      <form ref={deleteFormRef} action="/admin/categories/delete" method="post" hidden>
        <input type="hidden" name="slug" value={slug} />
      </form>
      <AdminDeleteConfirmModal
        open={deleteOpen}
        title="카테고리 삭제"
        lead={
          <>
            <strong>{label}</strong> 카테고리를 삭제할까요?
          </>
        }
        meta={`slug: ${slug}`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </details>
  );
}
