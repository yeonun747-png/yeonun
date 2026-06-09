"use client";

import { MyInquiryMenuItemClient } from "@/components/my/MyInquiryMenuItemClient";
import { MyInviteMenuItem } from "@/components/my/MyInviteMenuItem";
import { usePWAInstall } from "@/lib/pwa/usePWAInstall";

function PwaInstallMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="y-my-menu-item" onClick={onClick}>
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

/** 게스트 이용 안내 등 — 항목만 (섹션에 다른 메뉴가 있을 때) */
export function MyPwaInstallMenuItem() {
  const { isInstalled, triggerInstall } = usePWAInstall();

  if (isInstalled) return null;

  return <PwaInstallMenuButton onClick={() => void triggerInstall({ userInitiated: true })} />;
}

/** 회원 마이 — 이용 안내 (친구 초대 · PWA 설치 · 문의하기) */
export function MyPwaInstallGuideSection() {
  const { isInstalled, triggerInstall } = usePWAInstall();

  return (
    <div className="y-my-menu-section">
      <div className="y-my-menu-section-title">이용 안내</div>
      <MyInviteMenuItem />
      {!isInstalled ? (
        <PwaInstallMenuButton onClick={() => void triggerInstall({ userInitiated: true })} />
      ) : null}
      <MyInquiryMenuItemClient />
    </div>
  );
}
