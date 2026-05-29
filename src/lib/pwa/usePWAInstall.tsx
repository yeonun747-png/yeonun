"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { BeforeInstallPromptEvent } from "@/lib/pwa/before-install-prompt";
import { isBeforeInstallPromptEvent } from "@/lib/pwa/before-install-prompt";
import {
  clearInstalledInStorage,
  computeIsInstalled,
  detectIOS,
  detectStandalone,
  markInstalledInStorage,
  reconcileInstalledState,
} from "@/lib/pwa/pwa-detect";
import { PWA_INSTALL_PROMPT_SHOWN_KEY } from "@/lib/pwa/pwa-storage";

export type PWAInstallContextValue = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOS: boolean;
  isInStandaloneMode: boolean;
  /** 자동 유도 배너/모달 표시 */
  installPromptOpen: boolean;
  /** 마이 탭·설치하기 등에서 연 iOS 안내 모달 */
  iosGuideOpen: boolean;
  openInstallPrompt: (opts?: { userInitiated?: boolean }) => void;
  closeInstallPrompt: (opts?: { dismissSession?: boolean }) => void;
  triggerInstall: (opts?: { userInitiated?: boolean; fromBanner?: boolean }) => Promise<void>;
  releasePrompt: () => void;
  openIosGuide: () => void;
  closeIosGuide: () => void;
};

const PWAInstallContext = createContext<PWAInstallContextValue | null>(null);

function markPromptShownSession(): void {
  try {
    sessionStorage.setItem(PWA_INSTALL_PROMPT_SHOWN_KEY, "true");
  } catch {
    /* ignore */
  }
}

function showInstalledToast(): void {
  window.dispatchEvent(
    new CustomEvent("yeonun:toast", { detail: { message: "연운이 홈 화면에 추가됐어요 🌸" } }),
  );
}

function showManualInstallHint(): void {
  window.dispatchEvent(
    new CustomEvent("yeonun:toast", {
      detail: {
        message: "주소창 오른쪽 「앱 설치」 또는 「앱에서 열기」 버튼을 확인해주세요",
      },
    }),
  );
}

function showAlreadyInstalledHint(): void {
  window.dispatchEvent(
    new CustomEvent("yeonun:toast", {
      detail: {
        message: "연운이 이미 설치되어 있어요. 주소창 「앱에서 열기」로 실행할 수 있습니다",
      },
    }),
  );
}

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() =>
    typeof window !== "undefined" ? computeIsInstalled() : false,
  );
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const refreshInstalled = useCallback(() => {
    setIsInStandaloneMode(detectStandalone());
    void reconcileInstalledState().then(setIsInstalled);
  }, []);

  useEffect(() => {
    setIsIOS(detectIOS());
    refreshInstalled();
  }, [refreshInstalled]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      if (!isBeforeInstallPromptEvent(e)) return;
      e.preventDefault();
      // 제거 후 재방문 시 Chrome이 다시 설치 이벤트를 주면 → 마이 메뉴·유도 배너 복구
      clearInstalledInStorage();
      deferredRef.current = e;
      setDeferredPrompt(e);
      refreshInstalled();
    };

    const onInstalled = () => {
      markInstalledInStorage();
      refreshInstalled();
      releasePromptInternal();
      setInstallPromptOpen(false);
      setIosGuideOpen(false);
      showInstalledToast();
    };

    const onDisplayMode = () => refreshInstalled();

    const onPageShow = () => refreshInstalled();
    const onVis = () => {
      if (document.visibilityState === "visible") refreshInstalled();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVis);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVis);
      window.matchMedia("(display-mode: standalone)").removeEventListener("change", onDisplayMode);
    };
  }, [refreshInstalled]);

  const releasePromptInternal = () => {
    deferredRef.current = null;
    setDeferredPrompt(null);
  };

  const releasePrompt = useCallback(() => {
    releasePromptInternal();
  }, []);

  const runNativeInstall = useCallback(async (): Promise<boolean> => {
    const prompt = deferredRef.current;
    if (!prompt) return false;

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      releasePromptInternal();
      setInstallPromptOpen(false);
      if (choice.outcome === "accepted") {
        markInstalledInStorage();
        refreshInstalled();
        showInstalledToast();
      }
      return true;
    } catch {
      releasePromptInternal();
      return false;
    }
  }, [refreshInstalled]);

  const openInstallPrompt = useCallback((opts?: { userInitiated?: boolean }) => {
    if (computeIsInstalled()) return;
    if (!opts?.userInitiated) {
      try {
        if (sessionStorage.getItem(PWA_INSTALL_PROMPT_SHOWN_KEY) === "true") return;
      } catch {
        /* ignore */
      }
    }
    setInstallPromptOpen(true);
  }, []);

  const closeInstallPrompt = useCallback((opts?: { dismissSession?: boolean }) => {
    setInstallPromptOpen(false);
    if (opts?.dismissSession !== false) markPromptShownSession();
  }, []);

  const openIosGuide = useCallback(() => {
    if (computeIsInstalled()) return;
    setIosGuideOpen(true);
  }, []);

  const closeIosGuide = useCallback(() => {
    setIosGuideOpen(false);
    markPromptShownSession();
  }, []);

  const triggerInstall = useCallback(
    async (opts?: { userInitiated?: boolean; fromBanner?: boolean }) => {
      const installed = await reconcileInstalledState();
      setIsInstalled(installed);
      if (installed) {
        setInstallPromptOpen(false);
        if (opts?.fromBanner || opts?.userInitiated) showAlreadyInstalledHint();
        return;
      }

      if (detectIOS()) {
        if (opts?.userInitiated) {
          setIosGuideOpen(true);
        } else {
          openIosGuide();
        }
        return;
      }

      const ranNative = await runNativeInstall();
      if (ranNative) return;

      if (opts?.fromBanner) {
        const related = await reconcileInstalledState();
        setIsInstalled(related);
        if (related) {
          setInstallPromptOpen(false);
          showAlreadyInstalledHint();
          return;
        }
        showManualInstallHint();
        return;
      }

      openInstallPrompt({ userInitiated: opts?.userInitiated });
    },
    [openInstallPrompt, openIosGuide, runNativeInstall],
  );

  const value = useMemo<PWAInstallContextValue>(
    () => ({
      deferredPrompt,
      isInstalled,
      isIOS,
      isInStandaloneMode,
      installPromptOpen,
      iosGuideOpen,
      openInstallPrompt,
      closeInstallPrompt,
      triggerInstall,
      releasePrompt,
      openIosGuide,
      closeIosGuide,
    }),
    [
      closeInstallPrompt,
      closeIosGuide,
      deferredPrompt,
      installPromptOpen,
      iosGuideOpen,
      isIOS,
      isInStandaloneMode,
      isInstalled,
      openInstallPrompt,
      openIosGuide,
      releasePrompt,
      triggerInstall,
    ],
  );

  return <PWAInstallContext.Provider value={value}>{children}</PWAInstallContext.Provider>;
}

export function usePWAInstall(): PWAInstallContextValue {
  const ctx = useContext(PWAInstallContext);
  if (!ctx) throw new Error("usePWAInstall must be used within PWAInstallProvider");
  return ctx;
}
