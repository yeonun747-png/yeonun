"use client";

import { NaverIcon, SocialProviderIcon } from "@/components/auth/SocialProviderIcons";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import type { SocialProvider } from "@/lib/auth/types";

function socialAvatarUrl(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.avatar_url ?? meta?.picture;
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return url.length > 0 ? url : null;
}

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

  const avatarUrl = socialAvatarUrl(meta);
  const naverAvatar = provider === "naver" && avatarUrl;

  return (
    <section className="y-my-profile-head" aria-label="프로필">
      <div className="y-my-profile-row">
        <div
          className={
            naverAvatar ? "y-my-profile-provider y-my-profile-provider--naver-avatar" : "y-my-profile-provider"
          }
          aria-hidden="true"
        >
          {naverAvatar ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="y-my-profile-avatar"
                src={avatarUrl}
                alt=""
                width={48}
                height={48}
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <span className="y-my-profile-provider-logo">
                <NaverIcon className="y-my-profile-provider-logo-icon" />
              </span>
            </>
          ) : provider ? (
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
