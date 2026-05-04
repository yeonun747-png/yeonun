"use client";

import Link from "next/link";

import { MySheetLink } from "@/components/my/MySheetLink";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";

const SUP_Q = `back=${encodeURIComponent("/support")}`;

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
          <MySheetLink href={`/legal/terms?${SUP_Q}`} className="y-support-faq-item">
            결제는 어떻게 진행되나요?
            <span>›</span>
          </MySheetLink>
          <MySheetLink href={`/legal/refund?${SUP_Q}`} className="y-support-faq-item">
            환불 정책은 어떻게 되나요?
            <span>›</span>
          </MySheetLink>
          <MySheetLink href={`/checkout/credit?${SUP_Q}`} className="y-support-faq-item">
            음성 크레딧은 어떻게 사용하나요?
            <span>›</span>
          </MySheetLink>
          <Link href="/my?modal=saju" className="y-support-faq-item">
            사주 정보를 어떻게 수정하나요?
            <span>›</span>
          </Link>
          <MySheetLink href={`/library?${SUP_Q}`} className="y-support-faq-item">
            보관함 만료 전 연장이 가능한가요?
            <span>›</span>
          </MySheetLink>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
