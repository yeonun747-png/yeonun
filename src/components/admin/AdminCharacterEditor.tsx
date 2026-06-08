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

export function AdminCharacterEditor({ row }: { row: Row }) {
  const key = text(row.key, "");
  const name = text(row.name, "");
  const editFormId = `edit-character-${key}`;
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
          <strong>
            {name} · {text(row.han)}
          </strong>
          <em>
            {key} · {text(row.spec)}
          </em>
        </span>
        <span className="y-admin-pill good">캐릭터</span>
      </summary>
      <form id={editFormId} action="/admin/characters" method="post" className="y-admin-form y-admin-edit-form">
        <input name="key" defaultValue={key} />
        <input name="name" defaultValue={name} />
        <input name="han" defaultValue={text(row.han, "")} />
        <input name="en" defaultValue={text(row.en, "")} />
        <input name="spec" defaultValue={text(row.spec, "")} />
        <textarea name="greeting" defaultValue={text(row.greeting, "")} />
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
      <form ref={deleteFormRef} action="/admin/characters/delete" method="post" hidden>
        <input type="hidden" name="key" value={key} />
      </form>
      <AdminDeleteConfirmModal
        open={deleteOpen}
        title="캐릭터 삭제"
        lead={
          <>
            <strong>{name}</strong> 캐릭터를 삭제할까요?
          </>
        }
        meta={`key: ${key}`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </details>
  );
}
