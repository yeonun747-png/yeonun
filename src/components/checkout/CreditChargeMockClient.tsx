"use client";

import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export function CreditChargeMockClient() {
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
          <div className="y-credit-balance-amount">0분 0초</div>
          <div className="y-credit-balance-sub">분당 390원 · 충전 후 365일 유효</div>
          <div className="y-credit-balance-han">分</div>
        </div>
        <div className="y-credit-packages">
          <Link href="/checkout/credit/payment" className="y-credit-package best">
            <div className="y-credit-package-icon">🔥</div>
            <div className="y-credit-package-info">
              <div className="y-credit-package-name">30분 패키지</div>
              <div className="y-credit-package-desc">가장 인기 · 분당 390원</div>
            </div>
            <div className="y-credit-package-price-wrap">
              <div className="y-credit-package-price">9,900원</div>
              <div className="y-credit-package-badge">BEST</div>
            </div>
          </Link>
          <Link href="/checkout/credit/payment" className="y-credit-package">
            <div className="y-credit-package-icon">✨</div>
            <div className="y-credit-package-info">
              <div className="y-credit-package-name">10분 패키지</div>
              <div className="y-credit-package-desc">가볍게 시작 · 분당 390원</div>
            </div>
            <div className="y-credit-package-price-wrap">
              <div className="y-credit-package-price">3,900원</div>
            </div>
          </Link>
          <Link href="/checkout/credit/payment" className="y-credit-package">
            <div className="y-credit-package-icon">💎</div>
            <div className="y-credit-package-info">
              <div className="y-credit-package-name">60분 패키지</div>
              <div className="y-credit-package-desc">넉넉하게 · 분당 298원</div>
            </div>
            <div className="y-credit-package-price-wrap">
              <div className="y-credit-package-price">17,900원</div>
              <div className="y-credit-package-badge">24%↓</div>
            </div>
          </Link>
        </div>
        <div className="y-credit-expire">충전 크레딧은 365일 동안 유효합니다</div>
        <p className="y-credit-foot">미션 보상·출석 보상 음성 분은 정책에 따라 별도 적립됩니다.</p>
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}
