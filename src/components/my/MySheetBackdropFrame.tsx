"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";

const MY_SHEET_SCROLL_Y_KEY = "yeonun:my-sheet-scroll-y";
/** v2: 스냅샷 DOM이 querySelector에 잡히던 버그로 저장된 잘못된 HTML 무효화 */
const SHEET_BACKDROP_HTML_KEY = "yeonun:sheet-backdrop-html.v2";

/** 스냅샷 백드롭 안의 복제 DOM은 제외 — 그렇지 않으면 DFS 상 항상 스냅샷이 먼저 매칭되어 실제 .yeonunPage·포털 시트를 못 잡음 */
function queryLiveSheetDom(selector: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(selector);
  for (const el of nodes) {
    if (!el.closest(".y-my-sheet-backdrop-frame")) return el;
  }
  return null;
}

export function rememberSheetBackdropScrollY() {
  try {
    const currentSheet = queryLiveSheetDom(".y-modal.open");
    const currentPage = queryLiveSheetDom(".yeonunPage");
    const prevHtml = sessionStorage.getItem(SHEET_BACKDROP_HTML_KEY) ?? "";

    /** 라우트에 yeonunPage가 없을 때(공지 목록 등): 직전 스냅샷을 유지하고 현재 시트만 이어 붙여 2차 시트·블러가 백드롭에 남음 */
    let rawSnapshotHtml = "";
    if (currentPage) {
      rawSnapshotHtml = [currentPage.outerHTML, currentSheet?.outerHTML ?? ""].filter(Boolean).join("");
    } else if (currentSheet && prevHtml) {
      const aria = currentSheet.getAttribute("aria-label") ?? "";
      const alreadyHas = aria.length > 0 && prevHtml.includes(`aria-label="${aria}"`);
      rawSnapshotHtml = alreadyHas ? prevHtml : prevHtml + currentSheet.outerHTML;
    } else if (currentSheet) {
      rawSnapshotHtml = currentSheet.outerHTML;
    } else if (prevHtml) {
      rawSnapshotHtml = prevHtml;
    }

    const snapshotHtml = rawSnapshotHtml
      .replace(/\by-modal\s+open\b/g, "y-modal open y-modal--snapshot")
      .replace(/\bopen\s+y-modal\b/g, "open y-modal y-modal--snapshot");

    if (currentPage) {
      sessionStorage.setItem(MY_SHEET_SCROLL_Y_KEY, String(Math.max(0, window.scrollY || 0)));
    }

    if (snapshotHtml) sessionStorage.setItem(SHEET_BACKDROP_HTML_KEY, snapshotHtml);
  } catch {
    // sessionStorage를 사용할 수 없는 환경에서는 기본 top 상태로 둔다.
  }
}

export function SheetBackdropFrame({ children }: { children?: ReactNode }) {
  const [scrollY, setScrollY] = useState(0);
  const [snapshotHtml, setSnapshotHtml] = useState("");

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(MY_SHEET_SCROLL_Y_KEY);
        const n = raw ? Number(raw) : 0;
        setScrollY(Number.isFinite(n) ? Math.max(0, n) : 0);
        setSnapshotHtml(sessionStorage.getItem(SHEET_BACKDROP_HTML_KEY) ?? "");
      } catch {
        setScrollY(0);
        setSnapshotHtml("");
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="y-my-sheet-backdrop-frame" aria-hidden="true">
      <div className="y-my-sheet-backdrop-page" style={{ transform: `translate3d(0, -${scrollY}px, 0)` }}>
        {snapshotHtml ? <div dangerouslySetInnerHTML={{ __html: snapshotHtml }} /> : children}
      </div>
    </div>
  );
}

export const rememberMySheetScrollY = rememberSheetBackdropScrollY;
export const MySheetBackdropFrame = SheetBackdropFrame;
