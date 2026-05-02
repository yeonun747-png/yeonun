"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { TopNav } from "@/components/TopNav";

type PayDetail = {
  product: string;
  paidAt: string;
  method: string;
  amount: string;
  statusText: string;
  statusDone: boolean;
  libraryBtn: string;
  refundHtml: string;
};

type PayRow = {
  id: string;
  icon: string;
  name: string;
  dateLine: string;
  amount: string;
  refund?: boolean;
  detail: PayDetail;
};

const MOCK_ROWS: PayRow[] = [
  {
    id: "p1",
    icon: "🌸",
    name: "재회비책 풀이",
    dateLine: "04.28 · 신용카드",
    amount: "14,900원",
    detail: {
      product: "재회비책 풀이",
      paidAt: "2026.04.28 오후 11:24",
      method: "신용카드 (KB ****1234)",
      amount: "14,900원",
      statusText: "결제 완료",
      statusDone: true,
      libraryBtn: "보관함에서 이 풀이 열기 · 만료 D-32",
      refundHtml: "<strong>환불 정책</strong><br />열람 후에는 환불이 불가합니다.<br />현재 상태: 열람 완료 · 환불 불가",
    },
  },
  {
    id: "p2",
    icon: "🎙️",
    name: "음성 크레딧 10분",
    dateLine: "04.21 · 신용카드",
    amount: "3,900원",
    detail: {
      product: "음성 크레딧 10분",
      paidAt: "2026.04.21 오후 3:12",
      method: "신용카드",
      amount: "3,900원",
      statusText: "결제 완료",
      statusDone: true,
      libraryBtn: "음성 상담으로 이동",
      refundHtml: "<strong>환불 정책</strong><br />디지털 충전 상품은 사용 시작 후 환불이 제한될 수 있습니다.",
    },
  },
  {
    id: "p3",
    icon: "📖",
    name: "정통사주 풀이",
    dateLine: "04.15 · 휴대폰 결제",
    amount: "19,900원",
    detail: {
      product: "정통사주 풀이",
      paidAt: "2026.04.15 오전 10:02",
      method: "휴대폰 결제",
      amount: "19,900원",
      statusText: "결제 완료",
      statusDone: true,
      libraryBtn: "보관함에서 이 풀이 열기 · 만료 D-45",
      refundHtml: "<strong>환불 정책</strong><br />열람 후에는 환불이 불가합니다.",
    },
  },
  {
    id: "p4",
    icon: "⭐",
    name: "신년운세 풀이",
    dateLine: "01.03 · 코인 결제",
    amount: "9,900원",
    detail: {
      product: "신년운세 풀이",
      paidAt: "2026.01.03 오후 8:44",
      method: "코인 결제 (Fortune82)",
      amount: "9,900원",
      statusText: "결제 완료",
      statusDone: true,
      libraryBtn: "보관함에서 이 풀이 열기",
      refundHtml: "<strong>환불 정책</strong><br />열람 후에는 환불이 불가합니다.",
    },
  },
  {
    id: "p5",
    icon: "↩️",
    name: "꿈해몽 환불",
    dateLine: "01.02 · 환불",
    amount: "-4,900원",
    refund: true,
    detail: {
      product: "꿈해몽 환불",
      paidAt: "2026.01.02 오후 2:10",
      method: "원결제 수단 환급",
      amount: "-4,900원",
      statusText: "환불 완료",
      statusDone: false,
      libraryBtn: "결제 내역으로",
      refundHtml: "<strong>환불 안내</strong><br />접수 후 영업일 기준 처리되었습니다.",
    },
  },
];

export function MyPaymentsPageClient() {
  const [sel, setSel] = useState<PayRow | null>(null);

  const detail = useMemo(() => sel?.detail ?? null, [sel]);

  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <Link href="/my" className="y-page-sub-back" aria-label="마이로">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Link>
        <h1 className="y-page-sub-title">{detail ? "결제 상세" : "결제 내역"}</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <div className="y-sub-scroll-page">
        {!detail ? (
          <>
            <div className="y-pay-history-total">
              <div>
                <div className="y-pay-history-total-label">2026년 누적 결제</div>
                <div className="y-pay-history-total-val">57,800원</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="y-pay-history-total-label">이번 달</div>
                <div className="y-pay-history-total-val">24,900원</div>
              </div>
            </div>
            <div className="y-pay-history-month">2026년 4월</div>
            {MOCK_ROWS.slice(0, 3).map((row) => (
              <button
                key={row.id}
                type="button"
                className="y-pay-history-item y-pay-history-item--btn"
                onClick={() => setSel(row)}
              >
                <div className="y-pay-history-icon">{row.icon}</div>
                <div className="y-pay-history-info">
                  <div className="y-pay-history-name">{row.name}</div>
                  <div className="y-pay-history-date">{row.dateLine}</div>
                </div>
                <div className={`y-pay-history-amount${row.refund ? " refund" : ""}`}>{row.amount}</div>
              </button>
            ))}
            <div className="y-pay-history-month">2026년 1월</div>
            {MOCK_ROWS.slice(3).map((row) => (
              <button
                key={row.id}
                type="button"
                className="y-pay-history-item y-pay-history-item--btn"
                onClick={() => setSel(row)}
              >
                <div className="y-pay-history-icon">{row.icon}</div>
                <div className="y-pay-history-info">
                  <div className="y-pay-history-name">{row.name}</div>
                  <div className="y-pay-history-date">{row.dateLine}</div>
                </div>
                <div className={`y-pay-history-amount${row.refund ? " refund" : ""}`}>{row.amount}</div>
              </button>
            ))}
            <p className="y-pay-history-foot">PG·DB 연동 시 실제 내역으로 대체됩니다 · 최근 12개월</p>
            <div style={{ height: 40 }} />
          </>
        ) : (
          <>
            <button type="button" className="y-pay-detail-back" onClick={() => setSel(null)}>
              ← 목록
            </button>
            <div className="y-pay-detail-card">
              <div className="y-pay-detail-row">
                <span className="y-pay-detail-label">상품명</span>
                <span className="y-pay-detail-value">{detail.product}</span>
              </div>
              <div className="y-pay-detail-row">
                <span className="y-pay-detail-label">결제일시</span>
                <span className="y-pay-detail-value">{detail.paidAt}</span>
              </div>
              <div className="y-pay-detail-row">
                <span className="y-pay-detail-label">결제수단</span>
                <span className="y-pay-detail-value">{detail.method}</span>
              </div>
              <div className="y-pay-detail-row">
                <span className="y-pay-detail-label">결제금액</span>
                <span className={`y-pay-detail-value amount${detail.amount.startsWith("-") ? " refund" : ""}`}>
                  {detail.amount}
                </span>
              </div>
              <div className="y-pay-detail-row">
                <span className="y-pay-detail-label">상태</span>
                <span className={`y-pay-detail-value${detail.statusDone ? " done" : " muted"}`}>{detail.statusText}</span>
              </div>
            </div>
            <Link href="/library" className="y-pay-detail-open-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {detail.libraryBtn}
            </Link>
            <div className="y-pay-refund-box" dangerouslySetInnerHTML={{ __html: detail.refundHtml }} />
            <Link href="/support" className="y-pay-contact-btn">
              결제 관련 문의하기 →
            </Link>
            <div style={{ height: 32 }} />
          </>
        )}
      </div>
    </div>
  );
}
