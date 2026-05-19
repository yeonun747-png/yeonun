"use client";

import { useCallback, useEffect, useState } from "react";

import { YEONUN_AUTH_SESSION_CHANGED } from "@/lib/auth-session-events";
import { supabaseBrowser } from "@/lib/supabase/client";

type CouponRow = {
  kind: "percent" | "fixed" | "dream_free";
  label: string;
  expires_at: string;
};

function formatExp(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      timeZone: "Asia/Seoul",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function MyCouponsMenuItem() {
  const [summary, setSummary] = useState<string>("불러오는 중…");

  const refresh = useCallback(async () => {
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    if (!session?.access_token) {
      setSummary("로그인 후 확인");
      return;
    }
    try {
      const res = await fetch("/api/my/coupons", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; coupons?: CouponRow[] };
      if (!res.ok || !data.ok) {
        setSummary("조회 실패");
        return;
      }
      const list = data.coupons ?? [];
      if (list.length === 0) {
        setSummary("보유 쿠폰 없음");
        return;
      }
      const first = list[0];
      const extra = list.length > 1 ? ` 외 ${list.length - 1}장` : "";
      setSummary(`${first.label} · ${formatExp(first.expires_at)}까지${extra}`);
    } catch {
      setSummary("조회 실패");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onAuth = () => void refresh();
    const onCoupons = () => void refresh();
    window.addEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
    window.addEventListener("yeonun:coupons-updated", onCoupons);
    return () => {
      window.removeEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
      window.removeEventListener("yeonun:coupons-updated", onCoupons);
    };
  }, [refresh]);

  return <>{summary}</>;
}
