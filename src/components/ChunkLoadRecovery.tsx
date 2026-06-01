"use client";

import { useEffect } from "react";

const RELOAD_KEY = "yeonun:chunk-reload:v1";

/** PWA·배포 직후 stale 청크(ChunkLoadError) 1회 자동 새로고침 */
export function ChunkLoadRecovery() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const msg = `${event.message ?? ""}${event.error instanceof Error ? event.error.message : ""}`;
      if (!/Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module/i.test(msg)) return;
      if (sessionStorage.getItem(RELOAD_KEY)) return;
      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    };

    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  return null;
}
