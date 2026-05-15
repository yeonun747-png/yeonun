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
          <path d="M10 17l5-5-5-5v10z" />
          <path d="M14 12H3" />
          <path d="M21 3v18" />
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
