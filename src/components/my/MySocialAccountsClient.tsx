"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { SocialProviderIcon } from "@/components/auth/SocialProviderIcons";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { socialLinkErrorMessage, socialLinkSuccessMessage } from "@/lib/auth/auth-error-messages";
import { syncCreditsFromServer } from "@/lib/credit-client";
import type { SocialProvider } from "@/lib/auth/types";

const ALL_PROVIDERS: SocialProvider[] = ["google", "kakao", "naver"];

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

type LinkedAccount = {
  provider: SocialProvider;
  provider_id: string;
  name: string;
  email: string | null;
  last_login_at: string;
};

function MySocialAccountsInner() {
  const { session } = useYeonunAuth();
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<SocialProvider | null>(null);

  const linkOk = sp.get("social_linked");
  const linkErr = sp.get("social_link_error");
  const bannerOk = socialLinkSuccessMessage(linkOk);
  const bannerErr = socialLinkErrorMessage(linkErr);

  const returnTo = useMemo(() => {
    const next = new URLSearchParams(sp.toString());
    next.delete("social_linked");
    next.delete("social_link_error");
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, sp]);

  const linkedSet = useMemo(() => new Set(accounts.map((a) => a.provider)), [accounts]);
  const unlinked = ALL_PROVIDERS.filter((p) => !linkedSet.has(p));

  const loadAccounts = useCallback(async () => {
    const token = session?.access_token;
    if (!token) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/me/social/accounts", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = (await res.json()) as { ok?: boolean; accounts?: LinkedAccount[] };
      setAccounts(data.ok && Array.isArray(data.accounts) ? data.accounts : []);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (linkOk) void syncCreditsFromServer();
  }, [linkOk]);

  useEffect(() => {
    if (!linkOk && !linkErr) return;
    const t = window.setTimeout(() => {
      router.replace(returnTo, { scroll: false });
    }, 4000);
    return () => window.clearTimeout(t);
  }, [linkOk, linkErr, returnTo, router]);

  const startLink = async (provider: SocialProvider) => {
    const token = session?.access_token;
    if (!token || linking) return;
    setLinking(provider);
    try {
      const res = await fetch("/api/me/social/link/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider, returnTo }),
      });
      const data = (await res.json()) as { ok?: boolean; url?: string };
      if (data.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      alert("연동을 시작할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      alert("연동을 시작할 수 없습니다. 네트워크를 확인해 주세요.");
    } finally {
      setLinking(null);
    }
  };

  if (!session?.access_token) return null;

  return (
    <div className="y-my-social-block">
      {bannerOk ? (
        <p className="y-my-social-banner y-my-social-banner--ok" role="status">
          {bannerOk}
        </p>
      ) : null}
      {bannerErr ? (
        <p className="y-my-social-banner y-my-social-banner--err" role="alert">
          {bannerErr}
        </p>
      ) : null}

      <p className="y-my-social-desc">
        Google·카카오·네이버를 같은 계정에 연결하면 크레딧과 사주 정보가 하나로 합쳐집니다.
      </p>

      {loading ? (
        <p className="y-my-social-muted">연결된 로그인 불러오는 중…</p>
      ) : (
        <>
          <ul className="y-my-social-list">
            {accounts.map((a) => (
              <li key={a.provider} className="y-my-social-item y-my-social-item--linked">
                <span className="y-my-social-icon" aria-hidden="true">
                  <SocialProviderIcon provider={a.provider} />
                </span>
                <span className="y-my-social-meta">
                  <span className="y-my-social-name">{PROVIDER_LABEL[a.provider]}</span>
                  <span className="y-my-social-sub">{a.email || a.name || "연결됨"}</span>
                </span>
                <span className="y-my-social-badge">연결됨</span>
              </li>
            ))}
          </ul>

          {unlinked.length > 0 ? (
            <div className="y-my-social-actions">
              <p className="y-my-social-actions-label">추가 연동</p>
              {unlinked.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`y-my-social-link-btn y-my-social-link-btn--${p}`}
                  disabled={linking !== null}
                  onClick={() => void startLink(p)}
                >
                  <span className="y-my-social-icon" aria-hidden="true">
                    <SocialProviderIcon provider={p} />
                  </span>
                  {linking === p ? "이동 중…" : `${PROVIDER_LABEL[p]} 연동하기`}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MySocialAccountsClient() {
  return (
    <Suspense fallback={<p className="y-my-social-muted">연결된 로그인 불러오는 중…</p>}>
      <MySocialAccountsInner />
    </Suspense>
  );
}
