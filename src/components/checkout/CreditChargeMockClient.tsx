"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { TopNav } from "@/components/TopNav";
import { CREDIT_PACKAGES, chatMessagesFromCredits, firstChargeTotalCredits, voiceMinutesFromCredits } from "@/lib/credit-policy";
import { readWallet, spendableTotalCredits, YEONUN_CREDIT_UPDATE_EVENT } from "@/lib/credit-balance-local";

function paymentHref(pkg: "basic" | "popular" | "premium"): string {
  const p = CREDIT_PACKAGES[pkg];
  const title =
    pkg === "basic" ? "크레딧 기본 충전" : pkg === "popular" ? "크레딧 인기 패키지" : "크레딧 프리미엄 패키지";
  const first = !readWallet().firstPurchaseDone;
  let q =
    `/my?modal=payment&product=credit-package-${pkg}&title=` +
    encodeURIComponent(title) +
    `&price=${p.priceKrw}&grant_base=${p.grantCredits}&character_key=yeon&profile=single`;
  if (first) q += "&first_voice_credit_bonus=1";
  return q;
}

export function CreditChargeMockClient() {
  const [bal, setBal] = useState(0);
  const [first, setFirst] = useState(true);

  const refresh = useCallback(() => {
    setBal(spendableTotalCredits());
    setFirst(!readWallet().firstPurchaseDone);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, refresh);
  }, [refresh]);

  const bonusBar = "미리 충전할수록 보너스 크레딧이 더 많아져요. 최대 +30% 추가 지급.";

  const pack = (key: "basic" | "popular" | "premium", best?: boolean) => {
    const p = CREDIT_PACKAGES[key];
    const grant = first ? firstChargeTotalCredits(p.grantCredits) : p.grantCredits;
    const voiceLine = voiceMinutesFromCredits(grant);
    const chatLine = chatMessagesFromCredits(grant);
    return (
      <Link href={paymentHref(key)} className={`y-credit-package${best ? " best" : ""}`} scroll={false}>
        <div className="y-credit-package-icon">{best ? "🔥" : key === "premium" ? "💎" : "✨"}</div>
        <div className="y-credit-package-info">
          <div className="y-credit-package-name">{grant.toLocaleString("ko-KR")} 크레딧</div>
          <div className="y-credit-package-desc">
            {voiceLine} · {chatLine}
            {p.bonusLabel ? ` · ${p.bonusLabel}` : ""}
            {first ? " · 첫 충전 +10%" : ""}
          </div>
        </div>
        <div className="y-credit-package-price-wrap">
          <div className="y-credit-package-price">{p.priceKrw.toLocaleString("ko-KR")}원</div>
          {best ? <div className="y-credit-package-badge">BEST</div> : null}
        </div>
      </Link>
    );
  };

  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/my" className="y-page-sub-back" aria-label="마이로">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">크레딧 충전</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        <div className="y-credit-balance">
          <div className="y-credit-balance-eyebrow">CREDIT · 현재 잔액</div>
          <div className="y-credit-balance-amount">{bal.toLocaleString("ko-KR")} 크레딧</div>
          <div className="y-credit-balance-sub">{bonusBar}</div>
          <div className="y-credit-balance-han">緣</div>
        </div>
        <div className="y-credit-packages">
          {pack("popular", true)}
          {pack("basic")}
          {pack("premium")}
        </div>
        <div className="y-credit-expire">충전 크레딧은 충전일로부터 365일 동안 유효합니다. 무료 체험 크레딧은 30일입니다.</div>
        <p className="y-credit-foot">결제 완료 시 크레딧이 즉시 반영됩니다.</p>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
