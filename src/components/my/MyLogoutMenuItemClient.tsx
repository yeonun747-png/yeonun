"use client";

import { signOutAndGoHome } from "@/lib/auth/client-logout";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
export function MyLogoutMenuItemClient() {
  const { user } = useYeonunAuth();

  if (!user) return null;

  return (
    <button
      type="button"
      className="y-my-menu-item"
      onClick={() => {
        if (!window.confirm("로그아웃 하시겠어요?")) return;
        void signOutAndGoHome();
      }}
      aria-label="로그아웃"
    >
      <div className="y-my-menu-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </div>
      <div className="y-my-menu-text">
        <div className="y-my-menu-name">로그아웃</div>
        <div className="y-my-menu-desc">다시 시작하려면 로그아웃하세요</div>
      </div>
      <span className="y-my-menu-arrow">›</span>
    </button>
  );
}
