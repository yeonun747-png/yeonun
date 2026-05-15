"use client";

import { SocialProviderIcon } from "@/components/auth/SocialProviderIcons";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import type { SocialProvider } from "@/lib/auth/types";

export function MyMemberProfileHeader() {
  const { user } = useYeonunAuth();
  if (!user) return null;

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const providerRaw = meta?.provider != null ? String(meta.provider) : "";
  const provider: SocialProvider | null =
    providerRaw === "google" || providerRaw === "kakao" || providerRaw === "naver" ? providerRaw : null;

  const displayName =
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    user.email?.split("@")[0] ||
    "회원";

  return (
    <section className="y-my-profile-head" aria-label="프로필">
      <div className="y-my-profile-row">
        <div className="y-my-profile-provider" aria-hidden="true">
          {provider ? (
            <SocialProviderIcon provider={provider} />
          ) : (
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21 a8 8 0 0 1 16 0" />
            </svg>
          )}
        </div>
        <div className="y-my-profile-text">
          <div className="y-my-profile-name">{displayName}</div>
          <div className="y-my-profile-email">{user.email ?? ""}</div>
        </div>
      </div>
    </section>
  );
}
