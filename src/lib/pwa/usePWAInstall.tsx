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
  computeIsInstalled,
  detectIOS,
  detectStandalone,
  markInstalledInStorage,
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
  openInstallPrompt: () => void;
  closeInstallPrompt: (opts?: { dismissSession?: boolean }) => void;
  triggerInstall: () => Promise<void>;
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

export function PWAInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInStandaloneMode, setIsInStandaloneMode] = useState(false);
  const [installPromptOpen, setInstallPromptOpen] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  const refreshInstalled = useCallback(() => {
    setIsInStandaloneMode(detectStandalone());
    setIsInstalled(computeIsInstalled());
  }, []);

  useEffect(() => {
    setIsIOS(detectIOS());
    refreshInstalled();
  }, [refreshInstalled]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      if (!isBeforeInstallPromptEvent(e)) return;
      e.preventDefault();
      deferredRef.current = e;
      setDeferredPrompt(e);
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

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.matchMedia("(display-mode: standalone)").addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
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

  const openInstallPrompt = useCallback(() => {
    if (computeIsInstalled()) return;
    try {
      if (sessionStorage.getItem(PWA_INSTALL_PROMPT_SHOWN_KEY) === "true") return;
    } catch {
      /* ignore */
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

  const triggerInstall = useCallback(async () => {
    if (computeIsInstalled()) return;

    if (detectIOS()) {
      openIosGuide();
      return;
    }

    const prompt = deferredRef.current;
    if (!prompt) {
      openInstallPrompt();
      return;
    }

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      releasePromptInternal();
      if (choice.outcome === "accepted") {
        markInstalledInStorage();
        refreshInstalled();
        showInstalledToast();
      }
    } catch {
      releasePromptInternal();
    }
  }, [openInstallPrompt, openIosGuide, refreshInstalled]);

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
