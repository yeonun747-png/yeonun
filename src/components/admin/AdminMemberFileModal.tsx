"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  AdminMemberFilePanel,
  type AdminMemberFileAdjustProps,
  type AdminMemberFileTab,
} from "@/components/admin/AdminMemberFilePanel";
import { useAdminInquiryResolve } from "@/hooks/useAdminInquiryResolve";
import type { AdminMemberFile } from "@/lib/admin-cs-member";

export function AdminMemberFileModal({
  userId,
  onClose,
  initialTab = "info",
  enableCreditAdjust = false,
}: {
  userId: string | null;
  onClose: () => void;
  initialTab?: AdminMemberFileTab;
  /** CS Credits 화면 등에서만 true */
  enableCreditAdjust?: boolean;
}) {
  const open = Boolean(userId);
  const [file, setFile] = useState<AdminMemberFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deltaPaid, setDeltaPaid] = useState("");
  const [deltaFree, setDeltaFree] = useState("");
  const [adjustKind, setAdjustKind] = useState<"cs_refund" | "admin_adjust">("cs_refund");
  const [memo, setMemo] = useState("");
  const [refId, setRefId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "ok" | "err">("info");

  const { busyId: resolvingInquiryId, resolve: resolveInquiryRaw } = useAdminInquiryResolve(async () => {
    if (!userId) return;
    setMessageTone("ok");
    setMessage("문의를 처리완료했습니다.");
    await loadFile(userId);
  });

  const resolveInquiry = useCallback(
    (inquiryId: string) => {
      void resolveInquiryRaw(inquiryId);
    },
    [resolveInquiryRaw],
  );

  const loadFile = useCallback(async (uid: string) => {
    const res = await fetch(`/api/admin/credits/file?user_id=${encodeURIComponent(uid)}`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok || !data.file) throw new Error(data.error || "조회 실패");
    setFile(data.file as AdminMemberFile);
  }, []);

  useEffect(() => {
    if (!userId) {
      setFile(null);
      setError(null);
      setMessage(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    setError(null);
    setMessage(null);
    void loadFile(userId)
      .catch((e) => {
        if (!cancelled) {
          setFile(null);
          setError(e instanceof Error ? e.message : "회원 파일 조회 오류");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadFile, userId]);

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

  const applyAdjust = useCallback(async () => {
    if (!userId || !enableCreditAdjust) return;
    const dp = Number(deltaPaid) || 0;
    const df = Number(deltaFree) || 0;
    if (dp === 0 && df === 0) {
      setMessageTone("err");
      setMessage("조정 크레딧을 입력해 주세요.");
      return;
    }
    if (!memo.trim()) {
      setMessageTone("err");
      setMessage("사유(메모)를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/credits/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          delta_paid: dp,
          delta_free: df,
          kind: adjustKind,
          memo: memo.trim(),
          ref_id: refId.trim() || undefined,
          ref_type: refId.trim() ? "order" : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "조정 실패");
      setDeltaPaid("");
      setDeltaFree("");
      setMemo("");
      setMessageTone("ok");
      setMessage("반영되었습니다.");
      await loadFile(userId);
    } catch (e) {
      setMessageTone("err");
      setMessage(e instanceof Error ? e.message : "조정 오류");
    } finally {
      setBusy(false);
    }
  }, [adjustKind, deltaFree, deltaPaid, enableCreditAdjust, loadFile, memo, refId, userId]);

  if (!open || typeof document === "undefined") return null;

  const adjust: AdminMemberFileAdjustProps | undefined =
    enableCreditAdjust && file
      ? {
          busy,
          deltaPaid,
          deltaFree,
          adjustKind,
          memo,
          refId,
          onDeltaPaid: setDeltaPaid,
          onDeltaFree: setDeltaFree,
          onAdjustKind: setAdjustKind,
          onMemo: setMemo,
          onRefId: setRefId,
          onAdjust: () => void applyAdjust(),
        }
      : undefined;

  return createPortal(
    <div className="y-admin-cs-modal" role="dialog" aria-modal="true" aria-labelledby="admin-cs-modal-title">
      <button type="button" className="y-admin-cs-modal-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="y-admin-cs-modal-dialog">
        <header className="y-admin-cs-modal-head">
          <h2 id="admin-cs-modal-title" className="y-admin-cs-modal-title">
            회원 CS
          </h2>
          <button type="button" className="y-admin-cs-modal-close" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="y-admin-cs-modal-body">
          {message ? (
            <p className={`y-admin-member-credits-msg y-admin-member-credits-msg--${messageTone}`} role="status">
              {message}
            </p>
          ) : null}
          {busy && !file ? (
            <p className="y-admin-member-credits-empty">회원 파일을 불러오는 중…</p>
          ) : error ? (
            <p className="y-admin-member-credits-msg y-admin-member-credits-msg--err" role="alert">
              {error}
            </p>
          ) : file ? (
            <AdminMemberFilePanel
              file={file}
              initialTab={initialTab}
              adjust={adjust}
              inquiryResolve={{
                busyId: resolvingInquiryId,
                onResolve: resolveInquiry,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
