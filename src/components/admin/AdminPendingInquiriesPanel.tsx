"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AdminInquiryQueueTable } from "@/components/admin/AdminInquiryQueueTable";
import { useAdminInquiryResolve } from "@/hooks/useAdminInquiryResolve";
import { YEONUN_ADMIN_INQUIRIES_CHANGED } from "@/lib/admin-inquiry-events";
import type { UserInquiryRow } from "@/lib/user-inquiries-server";

type QueuePayload = {
  pending: UserInquiryRow[];
  resolved: UserInquiryRow[];
};

async function fetchInquiryQueue(): Promise<QueuePayload> {
  const res = await fetch("/api/admin/inquiries", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");
  return {
    pending: (data.pending ?? []) as UserInquiryRow[],
    resolved: (data.resolved ?? []) as UserInquiryRow[],
  };
}

export function AdminInquiryQueueModal({
  open,
  onClose,
  onOpenMember,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMember?: (userId: string) => void;
}) {
  const [queue, setQueue] = useState<QueuePayload>({ pending: [], resolved: [] });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchInquiryQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  const { busyId, error, resolve } = useAdminInquiryResolve(reload);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onChange = () => void reload();
    window.addEventListener(YEONUN_ADMIN_INQUIRIES_CHANGED, onChange);
    return () => window.removeEventListener(YEONUN_ADMIN_INQUIRIES_CHANGED, onChange);
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="y-admin-inq-modal" role="dialog" aria-modal="true" aria-labelledby="admin-inq-queue-title">
      <button type="button" className="y-admin-inq-modal-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="y-admin-inq-modal-dialog y-admin-inq-modal-dialog--wide">
        <header className="y-admin-inq-modal-head">
          <h3 id="admin-inq-queue-title">미처리 문의</h3>
          <button type="button" className="y-admin-inq-modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="y-admin-inq-modal-body y-admin-inq-modal-body--scroll">
          {error ? (
            <p className="y-admin-inq-error" role="alert">
              {error}
            </p>
          ) : null}
          {loading && queue.pending.length === 0 ? (
            <p className="y-admin-inq-empty">불러오는 중…</p>
          ) : (
            <AdminInquiryQueueTable
              rows={queue.pending}
              mode="pending"
              busyId={busyId}
              onResolve={(id) => void resolve(id)}
              onOpenMember={onOpenMember}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
