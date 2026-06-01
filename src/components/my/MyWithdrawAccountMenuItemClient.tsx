"use client";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { signOutAndGoHome } from "@/lib/auth/client-logout";
import { supabaseBrowser } from "@/lib/supabase/client";

export function MyWithdrawAccountMenuItemClient() {
  const { user } = useYeonunAuth();

  if (!user) return null;

  return (
    <button
      type="button"
      className="y-my-menu-item y-my-menu-item--danger"
      onClick={() => void onWithdraw()}
      aria-label="회원 탈퇴"
    >
      <div className="y-my-menu-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </div>
      <div className="y-my-menu-text">
        <div className="y-my-menu-name">회원 탈퇴</div>
        <div className="y-my-menu-desc">30일 후 계정·연결 정보 완전 삭제</div>
      </div>
      <span className="y-my-menu-arrow">›</span>
    </button>
  );
}

async function onWithdraw() {
  if (
    !window.confirm(
      "탈퇴를 신청하면 30일 후 계정과 사주·프로필이 삭제됩니다.\n전자상거래법에 따라 결제·환불 기록은 5년간 보관됩니다.\n탈퇴하시겠습니까?",
    )
  ) {
    return;
  }
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
  window.setTimeout(() => {
    void signOutAndGoHome();
  }, 320);
}
