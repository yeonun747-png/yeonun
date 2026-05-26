"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MySheetLink } from "@/components/my/MySheetLink";
import { YEONUN_AUTH_SESSION_CHANGED } from "@/lib/auth-session-events";
import { readWallet, spendableTotalCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";
import { fetchServerCredits } from "@/lib/credit-client";
import { supabaseBrowser } from "@/lib/supabase/client";

const MY_CREDIT_SHEET_HREF = "/my?credit=1";

export function MyCreditOverviewSection() {
  const [guest, setGuest] = useState(true);
  const [balanceTick, setBalanceTick] = useState(0);
  const [serverBalance, setServerBalance] = useState<number | null>(null);
  const [firstPurchaseDone, setFirstPurchaseDone] = useState(true);

  const refreshCredits = useCallback(async () => {
    const server = await fetchServerCredits();
    if (server) {
      setServerBalance(Math.max(0, server.total));
      setFirstPurchaseDone(Boolean(server.first_purchase_done));
    } else {
      setServerBalance(null);
      setFirstPurchaseDone(readWallet().firstPurchaseDone);
    }
    setBalanceTick((t) => t + 1);
  }, []);

  const refreshGuest = useCallback(async () => {
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    setGuest(!session?.access_token);
  }, []);

  useEffect(() => {
    void refreshGuest();
  }, [refreshGuest]);

  useEffect(() => {
    if (!guest) void refreshCredits();
  }, [guest, refreshCredits]);

  useEffect(() => {
    const onAuth = () => void refreshGuest();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshGuest();
    };
    window.addEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", refreshGuest);
    const onCredit = () => refreshCredits();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
    return () => {
      window.removeEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", refreshGuest);
      window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
    };
  }, [refreshGuest, refreshCredits]);

  const totalCredits = useMemo(() => {
    void balanceTick;
    if (serverBalance != null) return serverBalance;
    return spendableTotalCredits();
  }, [balanceTick, serverBalance]);

  const showFirstChargeHint = !firstPurchaseDone;

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
        <MySheetLink
          className="y-vip-card y-vip-card--link"
          href={MY_CREDIT_SHEET_HREF}
          scroll={false}
          aria-label="크레딧 충전 열기"
        >
          <div className="y-vip-eyebrow">CREDIT · 상담 잔액</div>
          <div className="y-vip-title">잔여 크레딧 {totalCredits.toLocaleString("ko-KR")}</div>
          <div className="y-vip-desc">
            {showFirstChargeHint
              ? "첫 충전 시 10% 추가 적립. 충전 후 365일 유효."
              : "3,900원 충전 시 3,900 크레딧. 충전 후 365일 유효."}
          </div>
          <span className="y-vip-arrow" aria-hidden>
            ›
          </span>
          {showFirstChargeHint ? (
            <span className="y-my-credit-first-badge" aria-label="첫 충전 혜택">
              첫 충전 10% 추가
            </span>
          ) : null}
        </MySheetLink>
        {showFirstChargeHint ? (
          <div className="y-my-credit-charge-row">
            <MySheetLink
              href={MY_CREDIT_SHEET_HREF}
              scroll={false}
              className="y-my-credit-charge-fullbtn"
              aria-label="첫 충전 한정 보너스, 크레딧 충전하기"
            >
              <span className="y-my-credit-fullbtn-text">첫 충전 한정 · 10% 더 적립</span>
              <span className="y-my-credit-fullbtn-sep" aria-hidden>
                |
              </span>
              <span className="y-my-credit-fullbtn-cta">크레딧 충전하기</span>
            </MySheetLink>
          </div>
        ) : null}
      </section>
    </>
  );
}
