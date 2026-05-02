"use client";

import Link from "next/link";

import { TopNav } from "@/components/TopNav";

export function SupportMockClient() {
  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/my" className="y-page-sub-back" aria-label="마이로">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">고객센터</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        <div className="y-support-hero">
          <div className="y-support-hero-han">問</div>
          <div className="y-support-hero-title">무엇이든 물어보세요</div>
          <div className="y-support-hero-sub">
            평일 오전 10시 ~ 오후 6시
            <br />
            주말·공휴일 제외
          </div>
        </div>
        <div className="y-support-channels">
          <a className="y-support-channel" href="https://pf.kakao.com" target="_blank" rel="noopener noreferrer">
            <div className="y-support-ch-icon kakao">💬</div>
            <div className="y-support-ch-info">
              <div className="y-support-ch-name">카카오톡 채널</div>
              <div className="y-support-ch-desc">@연운 · 평균 응답 30분 이내</div>
            </div>
            <span className="y-support-ch-chev">›</span>
          </a>
          <a className="y-support-channel" href="mailto:help@yeonun.ai">
            <div className="y-support-ch-icon email">📧</div>
            <div className="y-support-ch-info">
              <div className="y-support-ch-name">이메일 문의</div>
              <div className="y-support-ch-desc">help@yeonun.ai · 1영업일 이내</div>
            </div>
            <span className="y-support-ch-chev">›</span>
          </a>
        </div>
        <div className="y-support-faq">
          <div className="y-support-faq-title">자주 묻는 질문</div>
          <Link href="/legal/terms" className="y-support-faq-item">
            결제는 어떻게 진행되나요?
            <span>›</span>
          </Link>
          <Link href="/legal/refund" className="y-support-faq-item">
            환불 정책은 어떻게 되나요?
            <span>›</span>
          </Link>
          <Link href="/checkout/credit" className="y-support-faq-item">
            음성 크레딧은 어떻게 사용하나요?
            <span>›</span>
          </Link>
          <Link href="/my?modal=saju" className="y-support-faq-item">
            사주 정보를 어떻게 수정하나요?
            <span>›</span>
          </Link>
          <Link href="/library" className="y-support-faq-item">
            보관함 만료 전 연장이 가능한가요?
            <span>›</span>
          </Link>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
