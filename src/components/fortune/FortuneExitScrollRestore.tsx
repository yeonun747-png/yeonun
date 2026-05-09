"use client";

import { useEffect } from "react";

/** `fc` 쿼리가 있으면 해당 점사 메뉴 카드로 스크롤 후 주소에서 제거 */
export function FortuneExitScrollRestore() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const fc = sp.get("fc")?.trim();
    if (!fc || !/^[a-z0-9][a-z0-9-]*$/i.test(fc)) return;

    const run = () => {
      const el = document.querySelector<HTMLElement>(`[data-fortune-card="${fc}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
      sp.delete("fc");
      const qs = sp.toString();
      const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    };

    requestAnimationFrame(run);
    window.setTimeout(run, 120);
  }, []);

  return null;
}
