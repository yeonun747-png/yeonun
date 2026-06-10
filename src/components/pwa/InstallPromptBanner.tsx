"use client";

import { useEffect, useState } from "react";

import { usePWAInstall } from "@/lib/pwa/usePWAInstall";

export function InstallPromptBanner() {
  const {
    isInstalled,
    isIOS,
    installPromptOpen,
    iosGuideOpen,
    triggerInstall,
    closeInstallPrompt,
    closeIosGuide,
  } = usePWAInstall();
  const [bodySheetOpen, setBodySheetOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setBodySheetOpen(Boolean(document.body.querySelector(":scope > .y-modal.open")));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.body, { childList: true, subtree: false, attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  if (isInstalled || bodySheetOpen) return null;

  const showAutoPrompt = installPromptOpen;
  const showIosModal = (showAutoPrompt && isIOS) || iosGuideOpen;
  const showAndroidBanner = showAutoPrompt && !isIOS;

  if (!showAndroidBanner && !showIosModal) return null;

  return (
    <>
      {showAndroidBanner ? (
        <div className="y-pwa-install-banner" role="dialog" aria-label="연운 앱 설치 안내">
          <div className="y-pwa-install-banner-inner">
            <div className="y-pwa-install-banner-text">
              <p className="y-pwa-install-banner-title">🌸 연운 앱 설치하고 다음 상담 바로가기</p>
              <p className="y-pwa-install-banner-desc">홈 화면에서 빠르게 접속할 수 있어요</p>
            </div>
            <div className="y-pwa-install-banner-actions">
              <button
                type="button"
                className="y-pwa-install-btn primary"
                onClick={() => void triggerInstall({ fromBanner: true })}
              >
                설치하기
              </button>
              <button
                type="button"
                className="y-pwa-install-btn ghost"
                onClick={() => closeInstallPrompt({ dismissSession: true })}
              >
                다음에
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showIosModal ? (
        <div className="y-pwa-ios-overlay" role="dialog" aria-modal="true" aria-label="iOS 홈 화면 추가 안내">
          <div className="y-pwa-ios-modal">
            <h2 className="y-pwa-ios-title">🌸 연운을 홈 화면에 추가하세요</h2>
            <ol className="y-pwa-ios-steps">
              <li>Safari 하단 공유 버튼(□↑)을 탭하세요</li>
              <li>&quot;홈 화면에 추가&quot;를 선택하세요</li>
              <li>오른쪽 상단 &quot;추가&quot;를 탭하세요</li>
            </ol>
            <div className="y-pwa-ios-share-icon" aria-hidden="true">
              <svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="10" y="18" width="28" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M24 8v20M16 16l8-8 8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>공유</span>
            </div>
            <button
              type="button"
              className="y-pwa-install-btn primary full"
              onClick={() => {
                closeInstallPrompt({ dismissSession: true });
                closeIosGuide();
              }}
            >
              확인했어요
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
