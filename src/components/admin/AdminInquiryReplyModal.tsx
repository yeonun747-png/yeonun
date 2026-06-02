"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { fmtInquiryDateTime } from "@/lib/user-inquiry-format";
import type { UserInquiryRow } from "@/lib/user-inquiries-types";
import { useAdminInquiryResolve } from "@/hooks/useAdminInquiryResolve";

const MIN_REPLY_LEN = 5;

function readReplyText(state: string, ref: HTMLTextAreaElement | null): string {
  const fromRef = ref?.value ?? "";
  return (fromRef.length >= state.length ? fromRef : state).trim();
}

type Props = {
  row: UserInquiryRow | null;
  onClose: () => void;
  onResolved?: () => void;
};

export function AdminInquiryReplyModal({ row, onClose, onResolved }: Props) {
  const rowId = row?.id ?? "";
  const [reply, setReply] = useState("");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const { busyId, error, setError, resolve } = useAdminInquiryResolve(onResolved, onClose);

  useEffect(() => {
    if (!rowId) return;
    setReply(String(row?.admin_reply ?? "").trim());
    setError(null);
    const t = window.setTimeout(() => replyRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [row?.admin_reply, rowId, setError]);

  useEffect(() => {
    if (!rowId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && busyId !== rowId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busyId, onClose, rowId]);

  const replyLen = reply.trim().length;
  const canSubmit = replyLen >= MIN_REPLY_LEN && busyId !== rowId;

  const submit = useCallback(async () => {
    if (!row || !rowId || busyId) return;
    const text = readReplyText(reply, replyRef.current);
    if (text.length < MIN_REPLY_LEN) {
      setError(`답변은 ${MIN_REPLY_LEN}자 이상 입력해 주세요.`);
      return;
    }
    const ok = await resolve(rowId, text);
    if (!ok) return;
  }, [busyId, reply, resolve, row, rowId, setError]);

  if (!row || !rowId || typeof document === "undefined") return null;

  return createPortal(
    <div className="y-admin-inq-modal y-admin-inq-modal--detail" role="dialog" aria-modal="true" aria-labelledby="admin-inq-reply-title">
      <button type="button" className="y-admin-inq-modal-backdrop" aria-label="닫기" onClick={onClose} disabled={busyId === rowId} />
      <div className="y-admin-inq-modal-dialog">
        <header className="y-admin-inq-modal-head">
          <h3 id="admin-inq-reply-title">문의 답변</h3>
          <button type="button" className="y-admin-inq-modal-close" onClick={onClose} disabled={busyId === rowId}>
            ×
          </button>
        </header>
        <div className="y-admin-inq-modal-body y-admin-inq-modal-body--scroll">
          <dl className="y-admin-inq-detail-kv">
            <div>
              <dt>이름</dt>
              <dd>{row.name}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{row.email}</dd>
            </div>
            <div className="full">
              <dt>문의 내용</dt>
              <dd className="y-admin-inq-detail-body">{row.body}</dd>
            </div>
            <div>
              <dt>접수일</dt>
              <dd>{fmtInquiryDateTime(row.created_at)}</dd>
            </div>
          </dl>
          {!row.user_id ? (
            <p className="y-admin-inq-guest-note">게스트 문의입니다. 앱 내 확인은 불가하며 이메일 회신을 병행해 주세요.</p>
          ) : null}
          <label className="y-admin-inq-reply-field">
            <span className="y-admin-inq-reply-label">
              운영자 답변 <span className="y-admin-inq-reply-hint">({MIN_REPLY_LEN}자 이상 · {replyLen.toLocaleString("ko-KR")}자)</span>
            </span>
            <textarea
              ref={replyRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onInput={(e) => setReply(e.currentTarget.value)}
              placeholder="문의자에게 전달할 답변을 입력하세요."
              rows={6}
              maxLength={4000}
              disabled={busyId === rowId}
            />
          </label>
          {error ? (
            <p className="y-admin-inq-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="y-admin-inq-modal-foot">
          <button type="button" className="y-admin-inq-modal-ghost" onClick={onClose} disabled={busyId === rowId}>
            취소
          </button>
          <button
            type="button"
            className="y-admin-inq-modal-primary"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {busyId === rowId ? "등록 중…" : "답변 등록 · 처리완료"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
