"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { authErrorMessage } from "@/lib/auth/auth-error-messages";

function SocialLoginWithErrors({ oauthDisabled }: { oauthDisabled?: boolean }) {
  const sp = useSearchParams();
  const err = authErrorMessage(sp.get("auth_error"), sp.get("auth_error_provider"), sp.get("auth_error_hint"));

  return (
    <>
      {err ? (
        <p
          className="y-auth-error"
          role="alert"
          style={{ margin: "0 0 12px", fontSize: 13, color: "var(--y-rose)", whiteSpace: "pre-line" }}
        >
          {err}
        </p>
      ) : null}
      <SocialLoginButtons disabled={oauthDisabled} />
    </>
  );
}

export function SocialLoginSection({ oauthDisabled }: { oauthDisabled?: boolean }) {
  return (
    <Suspense fallback={<SocialLoginButtons disabled={oauthDisabled} />}>
      <SocialLoginWithErrors oauthDisabled={oauthDisabled} />
    </Suspense>
  );
}
