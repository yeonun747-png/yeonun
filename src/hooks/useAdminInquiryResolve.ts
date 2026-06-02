"use client";

import { useCallback, useRef, useState } from "react";

import { notifyAdminInquiriesChanged } from "@/lib/admin-inquiry-events";

export function useAdminInquiryResolve(onResolved?: () => void, onClose?: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onResolvedRef = useRef(onResolved);
  const onCloseRef = useRef(onClose);
  onResolvedRef.current = onResolved;
  onCloseRef.current = onClose;

  const resolve = useCallback(async (id: string, adminReply: string) => {
    if (busyId) return false;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/inquiries/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, admin_reply: adminReply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "처리 실패");
      notifyAdminInquiriesChanged();
      onResolvedRef.current?.();
      onCloseRef.current?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 오류");
      return false;
    } finally {
      setBusyId(null);
    }
  }, [busyId]);

  return { busyId, error, setError, resolve };
}
