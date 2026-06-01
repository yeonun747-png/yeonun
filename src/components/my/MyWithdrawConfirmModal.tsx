"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { signOutAndGoHome } from "@/lib/auth/client-logout";
import { spendableTotalCredits } from "@/lib/credit-balance-local";
import { fetchServerCredits } from "@/lib/credit-client";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  onDismiss: () => void;
};

export function MyWithdrawConfirmModal({ onDismiss }: Props) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cancelBtnRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const server = await fetchServerCredits().catch(() => null);
      if (cancelled) return;
      if (server && typeof server.total === "number") {
        setCredits(Math.max(0, server.total));
        return;
      }
      setCredits(spendableTotalCredits());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmWithdraw = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const sb = supabaseBrowser();
      const tok = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      if (!tok) {
        window.alert("세션이 없습니다.");
        return;
      }
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) {
        window.alert("탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      try {
        window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "회원 탈퇴가 완료되었습니다" } }));
      } catch {
        /* ignore */
      }
      onDismiss();
      window.setTimeout(() => {
        void signOutAndGoHome();
      }, 320);
    } finally {
      setSubmitting(false);
    }
  }, [onDismiss, submitting]);

  const creditLabel =
    credits !== null ? credits.toLocaleString("ko-KR") : null;

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-my-withdraw-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="y-my-withdraw-modal-title"
        aria-describedby="y-my-withdraw-modal-desc"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !submitting) onDismiss();
        }}
      >
        <div className="y-my-withdraw-modal-card" onMouseDown={(e) => e.stopPropagation()}>
          <h2 id="y-my-withdraw-modal-title" className="y-my-withdraw-modal-title">
            회원 탈퇴
          </h2>
          <div id="y-my-withdraw-modal-desc" className="y-my-withdraw-modal-body">
            {credits === null ? (
              <p className="y-my-withdraw-modal-desc">보유 크레딧을 확인하고 있습니다.</p>
            ) : credits > 0 ? (
              <p className="y-my-withdraw-modal-desc">
                보유크레딧이 <strong>{creditLabel}</strong>입니다. 정말로 탈퇴하시겠습니까?
              </p>
            ) : null}
            <p className="y-my-withdraw-modal-desc">
              탈퇴를 신청하면 30일 후 계정과 사주·프로필이 삭제됩니다.
              <br />
              전자상거래법에 따라 결제·환불 기록은 5년간 보관됩니다.
              {credits === 0 ? (
                <>
                  <br />
                  탈퇴하시겠습니까?
                </>
              ) : null}
            </p>
          </div>
          <div className="y-my-withdraw-modal-actions">
            <button
              ref={cancelBtnRef}
              type="button"
              className="y-my-withdraw-modal-btn y-my-withdraw-modal-btn--ghost"
              disabled={submitting}
              onClick={onDismiss}
            >
              취소
            </button>
            <button
              type="button"
              className="y-my-withdraw-modal-btn y-my-withdraw-modal-btn--danger"
              disabled={submitting || credits === null}
              onClick={() => void confirmWithdraw()}
            >
              {submitting ? "처리 중…" : "탈퇴하기"}
            </button>
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
