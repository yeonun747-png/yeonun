"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { authErrorMessage } from "@/lib/auth/auth-error-messages";

function SocialLoginWithErrors() {
  const sp = useSearchParams();
  const err = authErrorMessage(sp.get("auth_error"), sp.get("auth_error_provider"));

  return (
    <>
      {err ? (
        <p className="y-auth-error" role="alert" style={{ margin: "0 0 12px", fontSize: 13, color: "var(--y-rose)" }}>
          {err}
        </p>
      ) : null}
      <SocialLoginButtons />
    </>
  );
}

export function SocialLoginSection() {
  return (
    <Suspense fallback={<SocialLoginButtons />}>
      <SocialLoginWithErrors />
    </Suspense>
  );
}
