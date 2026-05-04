"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import {
  CREDIT_PACKAGES,
  chatWholeCountFromCredits,
  firstChargeTotalCredits,
  packageBonusPercentRounded,
  packageIntrinsicBonusCredits,
  voiceWholeMinutesFromCredits,
} from "@/lib/credit-policy";
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
  const searchParams = useSearchParams();
  const backHref = useMemo(() => {
    const raw = searchParams.get("back");
    if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
    return "/my";
  }, [searchParams]);

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
    const vm = voiceWholeMinutesFromCredits(grant);
    const cn = chatWholeCountFromCredits(grant);

    const line1 =
      key === "popular"
        ? `음성 ${vm}분 · 채팅 ${cn}건 · 가장 인기`
        : key === "premium"
          ? `음성 ${vm}분 · 채팅 ${cn}건 · 최대 절약`
          : `음성 ${vm}분 · 채팅 ${cn}건`;

    const bonusPct = packageBonusPercentRounded(key);
    const intrinsicBonus = packageIntrinsicBonusCredits(key);

    const line2 =
      key === "basic"
        ? `= ${p.priceKrw.toLocaleString("ko-KR")}원 그대로`
        : `${p.priceKrw.toLocaleString("ko-KR")}원으로 ${intrinsicBonus.toLocaleString("ko-KR")} 크레딧 추가 지급`;

    return (
      <Link href={paymentHref(key)} className={`y-credit-package${best ? " best" : ""}`} scroll={false}>
        <div className="y-credit-package-icon">{best ? "🔥" : key === "premium" ? "💎" : "✨"}</div>
        <div className="y-credit-package-info">
          <div className="y-credit-package-title-row">
            <span className="y-credit-package-name">{grant.toLocaleString("ko-KR")} 크레딧</span>
            {bonusPct != null ? (
              <span className="y-credit-package-pill">+{bonusPct}% 보너스</span>
            ) : null}
          </div>
          <div className="y-credit-package-desc">{line1}</div>
          <div className="y-credit-package-value-line">{line2}</div>
        </div>
        <div className="y-credit-package-price-wrap">
          <div className="y-credit-package-price">{p.priceKrw.toLocaleString("ko-KR")}원</div>
          {best ? <div className="y-credit-package-badge">BEST</div> : null}
          {key === "premium" ? <div className="y-credit-package-badge">MAX</div> : null}
        </div>
      </Link>
    );
  };

  return (
    <MySubpageSheet title="크레딧 충전" ariaLabel="크레딧 충전" backHref={backHref}>
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
    </MySubpageSheet>
  );
}
