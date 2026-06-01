"use client";

import { useCallback, useState } from "react";

import { notifyAdminInquiriesChanged } from "@/lib/admin-inquiry-events";

export function useAdminInquiryResolve(onResolved?: () => void) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolve = useCallback(
    async (id: string) => {
      if (busyId) return false;
      setBusyId(id);
      setError(null);
      try {
        const res = await fetch("/api/admin/inquiries/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "처리 실패");
        notifyAdminInquiriesChanged();
        onResolved?.();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 오류");
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [busyId, onResolved],
  );

  return { busyId, error, setError, resolve };
}
