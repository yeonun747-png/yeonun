"use client";

import { usePWAInstall } from "@/lib/pwa/usePWAInstall";

export function MyPwaInstallMenuItem() {
  const { isInstalled, triggerInstall } = usePWAInstall();

  if (isInstalled) return null;

  return (
    <button type="button" className="y-my-menu-item" onClick={() => void triggerInstall()}>
      <div className="y-my-menu-icon" aria-hidden="true">
        <span style={{ fontSize: 18 }}>📲</span>
      </div>
      <div className="y-my-menu-text">
        <div className="y-my-menu-name">홈 화면에 연운 아이콘 추가</div>
        <div className="y-my-menu-desc">앱처럼 빠르게 연운을 이용하세요</div>
      </div>
      <span className="y-my-menu-arrow">›</span>
    </button>
  );
}
