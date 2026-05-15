"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

function socialLoginToastLabel(provider: string | null): string | null {
  if (provider === "google") return "구글";
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  return null;
}

type CompletePhase = "working" | "no_token" | "error";

function AuthCompleteInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [phase, setPhase] = useState<CompletePhase>("working");
  const [errorDetail, setErrorDetail] = useState("로그인에 실패했습니다. 다시 시도해 주세요.");

  useEffect(() => {
    const token = sp.get("token");
    const returnTo = sp.get("returnTo") || "/";
    const onboard = sp.get("onboard") === "1";

    if (!token) {
      setPhase("no_token");
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

        const label = socialLoginToastLabel(sp.get("provider"));
        if (label) {
          try {
            window.dispatchEvent(
              new CustomEvent("yeonun:toast", { detail: { message: `${label} 로그인 완료 ✓` } }),
            );
          } catch {
            /* ignore */
          }
        }

        window.setTimeout(() => {
          router.replace(`${dest.pathname}${dest.search}`);
        }, 80);
      } catch {
        if (cancelled) return;
        setErrorDetail("로그인에 실패했습니다. 다시 시도해 주세요.");
        setPhase("error");
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

  if (phase === "working") {
    return (
      <div className="yeonunPage y-auth-complete" aria-busy="true" aria-label="로그인 처리 중">
        <div className="y-auth-complete-spinner" />
      </div>
    );
  }

  if (phase === "no_token") {
    return (
      <div className="yeonunPage y-auth-complete">
        <main className="y-auth-complete-msg">로그인 정보가 없습니다.</main>
      </div>
    );
  }

  return (
    <div className="yeonunPage y-auth-complete">
      <main className="y-auth-complete-msg">{errorDetail}</main>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="yeonunPage y-auth-complete" aria-busy="true" aria-label="로그인 처리 중">
          <div className="y-auth-complete-spinner" />
        </div>
      }
    >
      <AuthCompleteInner />
    </Suspense>
  );
}
