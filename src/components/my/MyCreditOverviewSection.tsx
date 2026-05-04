"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import { CREDIT_PACKAGES } from "@/lib/credit-policy";
import { readWallet, spendableTotalCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";
import { supabaseBrowser } from "@/lib/supabase/client";

function creditPaymentHref(pkg: "basic" | "popular" | "premium"): string {
  const p = CREDIT_PACKAGES[pkg];
  const title =
    pkg === "basic"
      ? "크레딧 기본 충전"
      : pkg === "popular"
        ? "크레딧 인기 패키지"
        : "크레딧 프리미엄 패키지";
  const first = !readWallet().firstPurchaseDone;
  let q =
    `modal=payment&product=credit-package-${pkg}&title=` +
    encodeURIComponent(title) +
    `&price=${p.priceKrw}&grant_base=${p.grantCredits}&character_key=yeon&profile=single`;
  if (first) q += "&first_voice_credit_bonus=1";
  return `/my?${q}`;
}

export function MyCreditOverviewSection() {
  const [guest, setGuest] = useState(true);
  const [balanceTick, setBalanceTick] = useState(0);

  const refreshCredits = useCallback(() => setBalanceTick((t) => t + 1), []);

  const refreshGuest = useCallback(async () => {
    const stub = readAuthStubLoggedIn();
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    const loggedIn = Boolean(session?.access_token) || stub;
    setGuest(!loggedIn);
  }, []);

  useEffect(() => {
    void refreshGuest();
  }, [refreshGuest]);

  useEffect(() => {
    const onStub = () => void refreshGuest();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshGuest();
    };
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", refreshGuest);
    const onCredit = () => refreshCredits();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
    return () => {
      window.removeEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", refreshGuest);
      window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
    };
  }, [refreshGuest, refreshCredits]);

  const totalCredits = useMemo(() => {
    void balanceTick;
    return spendableTotalCredits();
  }, [balanceTick]);

  const showFirstChargeHint = !readWallet().firstPurchaseDone;

  if (guest) {
    return (
      <section className="y-my-credit-guest-panel" aria-label="크레딧 안내">
        <div className="y-my-credit-login-card">
          <p className="y-my-credit-login-title">상담 크레딧</p>
          <p className="y-my-credit-login-desc">로그인 후 잔여 크레딧을 확인할 수 있어요.</p>
          <Link className="y-my-credit-login-btn" href="/my?modal=auth">
            로그인
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="y-my-credit-block" aria-label="크레딧 잔액">
        <Link className="y-vip-card y-vip-card--link" href="/checkout/credit" scroll={false} aria-label="크레딧 충전 열기">
          <div className="y-vip-eyebrow">CREDIT · 상담 잔액</div>
          <div className="y-vip-title">잔여 크레딧 {totalCredits.toLocaleString("ko-KR")}</div>
          <div className="y-vip-desc">3,900원 충전 시 3,900 크레딧. 충전 후 365일 유효.</div>
          <span className="y-vip-arrow" aria-hidden>
            ›
          </span>
          {showFirstChargeHint ? (
            <span className="y-my-credit-first-badge" aria-label="첫 충전 혜택">
              첫 충전 10% 추가
            </span>
          ) : null}
        </Link>
        {showFirstChargeHint ? (
          <div className="y-my-credit-charge-row">
            <Link
              href={creditPaymentHref("basic")}
              scroll={false}
              className="y-my-credit-charge-fullbtn"
              aria-label="첫 충전 한정 보너스, 크레딧 충전하기"
            >
              <span className="y-my-credit-fullbtn-text">첫 충전 한정 · 10% 더 적립</span>
              <span className="y-my-credit-fullbtn-sep" aria-hidden>
                |
              </span>
              <span className="y-my-credit-fullbtn-cta">크레딧 충전하기</span>
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
