"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { SocialProviderIcon } from "@/components/auth/SocialProviderIcons";
import type { SocialProvider } from "@/lib/auth/types";

type Props = {
  className?: string;
  disabled?: boolean;
};

function buildReturnTo(pathname: string, searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams.toString());
  next.delete("modal");
  next.delete("auth_error");
  next.delete("auth_error_provider");
  next.delete("auth_error_hint");
  next.delete("onboard");
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function startOAuth(provider: SocialProvider, returnTo: string) {
  const url = `/api/auth/${provider}?returnTo=${encodeURIComponent(returnTo)}&terms=1`;
  window.location.href = url;
}

export function SocialLoginButtons({ className, disabled = false }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const returnTo = buildReturnTo(pathname, new URLSearchParams(sp.toString()));

  return (
    <div className={className ?? "y-auth-social"}>
      <button className="y-social-btn google" type="button" disabled={disabled} onClick={() => startOAuth("google", returnTo)}>
        <span className="icon">
          <SocialProviderIcon provider="google" />
        </span>
        Google로 시작하기
      </button>
      <button className="y-social-btn kakao" type="button" disabled={disabled} onClick={() => startOAuth("kakao", returnTo)}>
        <span className="icon">
          <SocialProviderIcon provider="kakao" />
        </span>
        카카오로 시작하기
      </button>
      <button className="y-social-btn naver" type="button" disabled={disabled} onClick={() => startOAuth("naver", returnTo)}>
        <span className="icon">
          <SocialProviderIcon provider="naver" />
        </span>
        네이버로 시작하기
      </button>
    </div>
  );
}
