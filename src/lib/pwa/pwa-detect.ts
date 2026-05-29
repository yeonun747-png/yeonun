"use client";

import { PWA_INSTALLED_LS_KEY } from "@/lib/pwa/pwa-storage";

type RelatedApplication = { platform: string; id?: string; url?: string };

type NavigatorWithRelated = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApplication[]>;
};

export function detectIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function readInstalledFromStorage(): boolean {
  try {
    return localStorage.getItem(PWA_INSTALLED_LS_KEY) === "true";
  } catch {
    return false;
  }
}

export function markInstalledInStorage(): void {
  try {
    localStorage.setItem(PWA_INSTALLED_LS_KEY, "true");
  } catch {
    /* ignore */
  }
}

/** 홈 화면에서 제거 후 Chrome이 다시 설치를 제안할 때 플래그 해제 */
export function clearInstalledInStorage(): void {
  try {
    localStorage.removeItem(PWA_INSTALLED_LS_KEY);
  } catch {
    /* ignore */
  }
}

/** PWA 앱으로 실행 중이거나, 브라우저에서 설치 완료 직후(제거 전) */
export function computeIsInstalled(): boolean {
  if (detectStandalone()) return true;
  return readInstalledFromStorage();
}

/** Chromium getInstalledRelatedApps — null이면 API 미지원 */
export async function probeInstalledRelatedApps(): Promise<boolean | null> {
  if (typeof navigator === "undefined") return null;
  const fn = (navigator as NavigatorWithRelated).getInstalledRelatedApps;
  if (!fn) return null;
  try {
    const apps = await fn.call(navigator);
    return apps.some((app) => app.platform === "webapp");
  } catch {
    return null;
  }
}

/**
 * 브라우저 탭에서 localStorage 설치 플래그와 실제 PWA 설치 상태를 맞춤.
 * PC Chrome/Edge: 아이콘 삭제 시 getInstalledRelatedApps로 감지해 플래그 해제.
 */
export async function reconcileInstalledState(): Promise<boolean> {
  if (detectStandalone()) {
    markInstalledInStorage();
    return true;
  }

  const stored = readInstalledFromStorage();
  const related = await probeInstalledRelatedApps();

  if (related === true) {
    if (!stored) markInstalledInStorage();
    return true;
  }

  if (related === false) {
    if (stored) clearInstalledInStorage();
    return false;
  }

  return stored;
}
