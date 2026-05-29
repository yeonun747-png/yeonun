"use client";

import { useInstallTrigger } from "@/lib/pwa/useInstallTrigger";
import { InstallPromptBanner } from "@/components/pwa/InstallPromptBanner";

/** 전역 PWA 자동 유도 + 배너/모달 */
export function PwaInstallTriggerHost() {
  useInstallTrigger();
  return <InstallPromptBanner />;
}
