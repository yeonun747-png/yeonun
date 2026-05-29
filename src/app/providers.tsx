"use client";

import type { ReactNode } from "react";

import { PWAInstallProvider } from "@/lib/pwa/usePWAInstall";
import { PwaInstallTriggerHost } from "@/components/pwa/PwaInstallTriggerHost";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PWAInstallProvider>
      {children}
      <PwaInstallTriggerHost />
    </PWAInstallProvider>
  );
}
