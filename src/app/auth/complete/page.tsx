"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { authErrorMessage } from "@/lib/auth/auth-error-messages";
import { mapSessionApiError, sanitizeAuthErrorHint } from "@/lib/auth/auth-error-hint";
import type { AuthErrorCode } from "@/lib/auth/redirect-errors";
import { clearPendingReferral, readPendingReferral } from "@/lib/referral-pending";
import { dispatchMissionCompleteToastOnce } from "@/lib/mission-rewards";
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
    const provider = sp.get("provider");

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
          is_new_user?: boolean;
          error?: string;
          hint?: string;
        };
        if (!res.ok || !data.ok || !data.access_token || !data.refresh_token) {
          const errCode = mapSessionApiError(String(data.error ?? "session_failed"));
          const hint = sanitizeAuthErrorHint(String(data.hint ?? data.error ?? "session_failed"));
          const msg = authErrorMessage(errCode, provider, hint);
          throw Object.assign(new Error(data.error || "session_failed"), { errCode, hint, msg });
        }

        const sb = supabaseBrowser();
        if (!sb) throw new Error("supabase_not_configured");

        const { error } = await sb.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (error) throw error;

        if (data.is_new_user) {
          const pending = readPendingReferral();
          if (pending) {
            try {
              const claimRes = await fetch("/api/referral/claim", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${data.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(pending),
              });
              const claimData = (await claimRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
              if (claimRes.ok && (claimData.ok || claimData.error === "already_referred")) {
                dispatchMissionCompleteToastOnce("M08", "referee:M08");
              }
            } catch {
              /* callback에서 처리됐을 수 있음 */
            }
            clearPendingReferral();
          }
        }

        if (cancelled) return;

        const dest = new URL(returnTo, window.location.origin);
        if (onboard) {
          dest.searchParams.set("modal", "auth");
          dest.searchParams.set("onboard", "1");
        }

        const label = socialLoginToastLabel(provider);
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
      } catch (e) {
        if (cancelled) return;
        const err = e as { errCode?: AuthErrorCode; hint?: string; msg?: string; message?: string };
        const errCode: AuthErrorCode =
          err.errCode ??
          (String(err.message).includes("supabase_not_configured") ? "oauth_not_configured" : "session_failed");
        const hint = sanitizeAuthErrorHint(err.hint ?? err.message ?? "");
        const msg = err.msg ?? authErrorMessage(errCode, provider, hint) ?? "로그인에 실패했습니다.";
        setErrorDetail(msg);
        setPhase("error");
        const dest = new URL(returnTo, window.location.origin);
        dest.searchParams.set("modal", "auth");
        dest.searchParams.set("auth_error", errCode);
        if (provider) dest.searchParams.set("auth_error_provider", provider);
        if (hint) dest.searchParams.set("auth_error_hint", hint);
        setTimeout(() => router.replace(`${dest.pathname}${dest.search}`), 2200);
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
      <main className="y-auth-complete-msg" style={{ whiteSpace: "pre-line", padding: "0 20px", textAlign: "center" }}>
        {errorDetail}
      </main>
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
