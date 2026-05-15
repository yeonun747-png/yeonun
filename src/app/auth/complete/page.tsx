"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

function AuthCompleteInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("로그인 처리 중…");

  useEffect(() => {
    const token = sp.get("token");
    const returnTo = sp.get("returnTo") || "/";
    const onboard = sp.get("onboard") === "1";

    if (!token) {
      setMessage("로그인 정보가 없습니다.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          access_token?: string;
          refresh_token?: string;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.access_token || !data.refresh_token) {
          throw new Error(data.error || "session_failed");
        }

        const sb = supabaseBrowser();
        if (!sb) throw new Error("supabase_not_configured");

        const { error } = await sb.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (error) throw error;

        if (cancelled) return;

        const dest = new URL(returnTo, window.location.origin);
        if (onboard) {
          dest.searchParams.set("modal", "auth");
          dest.searchParams.set("onboard", "1");
        }
        router.replace(`${dest.pathname}${dest.search}`);
      } catch {
        if (cancelled) return;
        setMessage("로그인에 실패했습니다. 다시 시도해 주세요.");
        const dest = new URL(returnTo, window.location.origin);
        dest.searchParams.set("modal", "auth");
        dest.searchParams.set("auth_error", "token_failed");
        setTimeout(() => router.replace(`${dest.pathname}${dest.search}`), 1500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sp, router]);

  return (
    <div className="yeonunPage">
      <main style={{ padding: 48, textAlign: "center", color: "var(--y-ink-2)" }}>{message}</main>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="yeonunPage">
          <main style={{ padding: 48, textAlign: "center" }}>로그인 처리 중…</main>
        </div>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  );
}
