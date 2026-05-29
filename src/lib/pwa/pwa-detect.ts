"use client";

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

import { PWA_INSTALLED_LS_KEY } from "@/lib/pwa/pwa-storage";

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

export function computeIsInstalled(): boolean {
  return detectStandalone() || readInstalledFromStorage();
}
