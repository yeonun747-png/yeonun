"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { jsonAuthHeaders } from "@/lib/fetch-with-auth";
import { getOrCreateSiteVisitorRef } from "@/lib/site-visitor-ref";

const DEDUPE_MS = 3000;

function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api/")) return false;
  return true;
}

/** 페이지 이동마다 방문 이벤트 기록 (어드민·API 경로 제외) */
export function SiteVisitTracker() {
  const pathname = usePathname();
  const { user } = useYeonunAuth();

  useEffect(() => {
    if (!pathname || !shouldTrackPath(pathname)) return;

    const dedupeKey = `yeonun:page-view:${pathname}`;
    try {
      const last = Number(sessionStorage.getItem(dedupeKey) ?? "0");
      if (last && Date.now() - last < DEDUPE_MS) return;
      sessionStorage.setItem(dedupeKey, String(Date.now()));
    } catch {
      /* ignore */
    }

    const visitorRef = getOrCreateSiteVisitorRef();
    if (!visitorRef || visitorRef === "guest") return;

    void (async () => {
      const headers: Record<string, string> = {
        ...((await jsonAuthHeaders()) as Record<string, string>),
      };
      if (!headers.Authorization && visitorRef.startsWith("visitor_")) {
        headers["X-Yeonun-Visitor-Ref"] = visitorRef;
      }

      await fetch("/api/analytics/page-view", {
        method: "POST",
        headers,
        body: JSON.stringify({ path: pathname, visitor_ref: visitorRef }),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    })();
  }, [pathname, user?.id]);

  return null;
}
