"use client";

import { FaqAccordion } from "@/components/support/FaqAccordion";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { SUPPORT_FAQ_EMAIL } from "@/components/support/support-faq-data";

export function SupportMockClient() {
  return (
    <MySubpageSheet title="고객센터" ariaLabel="고객센터">
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
          <a className="y-support-channel" href={`mailto:${SUPPORT_FAQ_EMAIL}`}>
            <div className="y-support-ch-icon email">📧</div>
            <div className="y-support-ch-info">
              <div className="y-support-ch-name">이메일 문의</div>
              <div className="y-support-ch-desc">{SUPPORT_FAQ_EMAIL} · 1영업일 이내</div>
            </div>
            <span className="y-support-ch-chev">›</span>
          </a>
        </div>
        <div className="y-support-faq">
          <div className="y-support-faq-title">자주 묻는 질문</div>
          <FaqAccordion />
        </div>
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
