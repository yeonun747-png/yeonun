"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { usePWAInstall } from "@/lib/pwa/usePWAInstall";
import {
  PWA_FORTUNE_RESULT_ENTER_EVENT,
  PWA_VOICE_CALL_ENDED_EVENT,
} from "@/lib/pwa/pwa-events";
import {
  PWA_FIRST_SEEN_KEY,
  PWA_FORTUNE_RESULT_PROMPTED_KEY,
  PWA_INSTALL_PROMPT_SHOWN_KEY,
  PWA_MIN_DWELL_MS,
  PWA_MIN_PAGE_VIEWS,
  PWA_PAGE_VIEW_COUNT_KEY,
  PWA_VISITED_PATHS_KEY,
} from "@/lib/pwa/pwa-storage";
import { computeIsInstalled } from "@/lib/pwa/pwa-detect";

function sessionPromptBlocked(): boolean {
  try {
    return sessionStorage.getItem(PWA_INSTALL_PROMPT_SHOWN_KEY) === "true";
  } catch {
    return true;
  }
}

function tryOpenPrompt(openInstallPrompt: () => void): void {
  if (computeIsInstalled() || sessionPromptBlocked()) return;
  openInstallPrompt();
}

function incrementPageView(pathname: string): number {
  try {
    const raw = sessionStorage.getItem(PWA_VISITED_PATHS_KEY);
    const paths: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!paths.includes(pathname)) {
      paths.push(pathname);
      sessionStorage.setItem(PWA_VISITED_PATHS_KEY, JSON.stringify(paths));
      sessionStorage.setItem(PWA_PAGE_VIEW_COUNT_KEY, String(paths.length));
    }
    return paths.length;
  } catch {
    return 0;
  }
}

function getPageViewCount(): number {
  try {
    const n = parseInt(sessionStorage.getItem(PWA_PAGE_VIEW_COUNT_KEY) ?? "0", 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function ensureFirstSeen(): void {
  try {
    if (!sessionStorage.getItem(PWA_FIRST_SEEN_KEY)) {
      sessionStorage.setItem(PWA_FIRST_SEEN_KEY, String(Date.now()));
    }
  } catch {
    /* ignore */
  }
}

function dwellElapsed(): boolean {
  try {
    const t = parseInt(sessionStorage.getItem(PWA_FIRST_SEEN_KEY) ?? "0", 10);
    if (!Number.isFinite(t) || t <= 0) return false;
    return Date.now() - t >= PWA_MIN_DWELL_MS;
  } catch {
    return false;
  }
}

function checkGeneralTrigger(openInstallPrompt: () => void): void {
  if (!dwellElapsed()) return;
  if (getPageViewCount() < PWA_MIN_PAGE_VIEWS) return;
  tryOpenPrompt(openInstallPrompt);
}

/** 자동 설치 유도 조건 감지 (첫 접속 즉시 유도 없음) */
export function useInstallTrigger(): void {
  const pathname = usePathname() || "/";
  const { openInstallPrompt, isInstalled } = usePWAInstall();
  const generalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    if (isInstalled) return;
    ensureFirstSeen();
    incrementPageView(pathname);

    if (pathname.includes("/result")) {
      try {
        if (sessionStorage.getItem(PWA_FORTUNE_RESULT_PROMPTED_KEY) !== "true") {
          sessionStorage.setItem(PWA_FORTUNE_RESULT_PROMPTED_KEY, "true");
          tryOpenPrompt(openInstallPrompt);
        }
      } catch {
        /* ignore */
      }
    }

    if (generalTimerRef.current) clearTimeout(generalTimerRef.current);
    generalTimerRef.current = setTimeout(() => {
      checkGeneralTrigger(openInstallPrompt);
    }, PWA_MIN_DWELL_MS);

    return () => {
      if (generalTimerRef.current) clearTimeout(generalTimerRef.current);
    };
  }, [pathname, isInstalled, openInstallPrompt]);

  useEffect(() => {
    if (isInstalled) return;

    const onVoiceEnded = () => tryOpenPrompt(openInstallPrompt);
    const onFortuneResult = () => {
      try {
        if (sessionStorage.getItem(PWA_FORTUNE_RESULT_PROMPTED_KEY) === "true") return;
        sessionStorage.setItem(PWA_FORTUNE_RESULT_PROMPTED_KEY, "true");
      } catch {
        /* ignore */
      }
      tryOpenPrompt(openInstallPrompt);
    };

    window.addEventListener(PWA_VOICE_CALL_ENDED_EVENT, onVoiceEnded);
    window.addEventListener(PWA_FORTUNE_RESULT_ENTER_EVENT, onFortuneResult);

    return () => {
      window.removeEventListener(PWA_VOICE_CALL_ENDED_EVENT, onVoiceEnded);
      window.removeEventListener(PWA_FORTUNE_RESULT_ENTER_EVENT, onFortuneResult);
    };
  }, [isInstalled, openInstallPrompt]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
}
