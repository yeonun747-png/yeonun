"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminMemberFileModal } from "@/components/admin/AdminMemberFileModal";
import type { AdminPaymentUserRow, AdminPaymentUsersPeriod, AdminPaymentUsersSummary } from "@/lib/admin-payment-users";

const PERIODS: { id: AdminPaymentUsersPeriod; label: string }[] = [
  { id: "today", label: "오늘" },
  { id: "yesterday", label: "어제" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
];

function fmtCredits(n: number) {
  return `${n.toLocaleString("ko-KR")}C`;
}

const EMPTY_SUMMARY: AdminPaymentUsersSummary = {
  card: { krw: 0, count: 0 },
  phone: { krw: 0, count: 0 },
  total: { krw: 0, count: 0 },
  credit: { credits: 0, count: 0 },
};

function SummaryColumn({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "rose" | "credit";
}) {
  return (
    <div className="y-admin-v2-pay-sum-item">
      <div className="y-admin-v2-pay-sum-label">{label}</div>
      <div
        className={`y-admin-v2-pay-sum-val${tone === "rose" ? " rose" : ""}${tone === "credit" ? " credit" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function PaymentSummaryBar({ summary, loading }: { summary: AdminPaymentUsersSummary; loading: boolean }) {
  if (loading) {
    return <div className="y-admin-v2-pay-summary-bar">불러오는 중…</div>;
  }
  const { card, phone, total, credit } = summary;
  return (
    <div className="y-admin-v2-pay-summary-bar" aria-label="결제 수단별 집계">
      <SummaryColumn label="카드" value={`${fmtKrw(card.krw)} (${card.count}건)`} />
      <div className="y-admin-v2-pay-sum-div" aria-hidden />
      <SummaryColumn label="휴대폰" value={`${fmtKrw(phone.krw)} (${phone.count}건)`} />
      <div className="y-admin-v2-pay-sum-div" aria-hidden />
      <SummaryColumn label="총" value={`${fmtKrw(total.krw)} (${total.count}건)`} tone="rose" />
      <div className="y-admin-v2-pay-sum-div" aria-hidden />
      <SummaryColumn
        label="크레딧"
        value={`${fmtCredits(credit.credits)} 소진 (${credit.count}건)`}
        tone="credit"
      />
    </div>
  );
}

function fmtKrw(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function fmtAmountCell(row: AdminPaymentUserRow) {
  if (row.method === "credit") {
    return (
      <span className="y-admin-v2-pay-amt credit">
        <span className="y-admin-v2-pay-amt-main">{row.amountKrw.toLocaleString("ko-KR")}C</span>
        <span className="y-admin-v2-pay-amt-sub">소진</span>
      </span>
    );
  }
  return <span className="y-admin-v2-pay-amt">{fmtKrw(row.amountKrw)}</span>;
}

function StatusBadge({ status }: { status: AdminPaymentUserRow["status"] }) {
  if (status === "refund") {
    return <span className="y-admin-v2-pay-status refund">↩ 환불</span>;
  }
  if (status === "pending") {
    return <span className="y-admin-v2-pay-status pending">◐ 대기</span>;
  }
  return <span className="y-admin-v2-pay-status ok">● 완료</span>;
}

function SajuCell({ row }: { row: AdminPaymentUserRow }) {
  if (!row.sajuSelf) {
    return <span className="y-admin-v2-pay-muted">—</span>;
  }
  return (
    <div className="y-admin-v2-pay-saju-cell">
      <div className="y-admin-v2-pay-saju-row">
        {row.isPairProduct ? <span className="y-admin-v2-pay-saju-tag me">본인</span> : null}
        <span className="y-admin-v2-pay-saju-info">
          {row.sajuSelf.birth} · {row.sajuSelf.hour} · {row.sajuSelf.gender}
        </span>
      </div>
      {row.isPairProduct && row.sajuPartner ? (
        <div className="y-admin-v2-pay-saju-row">
          <span className="y-admin-v2-pay-saju-tag pt">상대</span>
          <span className="y-admin-v2-pay-saju-info">
            {row.sajuPartner.birth} · {row.sajuPartner.hour} · {row.sajuPartner.gender}
          </span>
        </div>
      ) : row.isPairProduct ? (
        <div className="y-admin-v2-pay-saju-row">
          <span className="y-admin-v2-pay-saju-tag pt">상대</span>
          <span className="y-admin-v2-pay-saju-muted">—</span>
        </div>
      ) : null}
    </div>
  );
}

export function AdminPaymentUsersPanel() {
  const [period, setPeriod] = useState<AdminPaymentUsersPeriod>("today");
  const [summary, setSummary] = useState<AdminPaymentUsersSummary>(EMPTY_SUMMARY);
  const [rows, setRows] = useState<AdminPaymentUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csUserId, setCsUserId] = useState<string | null>(null);

  const load = useCallback(async (p: AdminPaymentUsersPeriod) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payment-users?period=${encodeURIComponent(p)}`, {
        cache: "no-store",
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        count?: number;
        totalKrw?: number;
        summary?: AdminPaymentUsersSummary;
        rows?: AdminPaymentUserRow[];
      };
      if (!res.ok || !j.ok) {
        throw new Error(j.error || "목록을 불러오지 못했습니다.");
      }
      setSummary(j.summary ?? EMPTY_SUMMARY);
      setRows(Array.isArray(j.rows) ? j.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [load, period]);

  return (
    <div className="y-admin-v2-pay-card">
      <div className="y-admin-v2-pay-head">
        <PaymentSummaryBar summary={summary} loading={loading} />
        <div className="y-admin-v2-pay-toggle" role="tablist" aria-label="결제 유저 기간">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={period === p.id}
              className={period === p.id ? "on" : undefined}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="y-admin-v2-pay-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="y-admin-v2-pay-table-wrap">
        <table className="y-admin-v2-pay-table">
          <colgroup>
            <col className="y-admin-v2-pay-col-no" />
            <col className="y-admin-v2-pay-col-dt" />
            <col className="y-admin-v2-pay-col-user" />
            <col className="y-admin-v2-pay-col-saju" />
            <col className="y-admin-v2-pay-col-char" />
            <col className="y-admin-v2-pay-col-prod" />
            <col className="y-admin-v2-pay-col-amt" />
            <col className="y-admin-v2-pay-col-method" />
            <col className="y-admin-v2-pay-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>결제일시</th>
              <th>사용자</th>
              <th>사주 정보</th>
              <th>캐릭터</th>
              <th>상품명</th>
              <th className="r">결제금액</th>
              <th>결제수단</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="y-admin-v2-pay-empty">
                  불러오는 중…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="y-admin-v2-pay-empty">
                  해당 기간 결제 내역이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.paymentId}>
                  <td>
                    <span className="y-admin-v2-pay-no">{idx + 1}</span>
                  </td>
                  <td>
                    <div className="y-admin-v2-pay-datetime">
                      <div>{row.paidAtDate}</div>
                      <div className="y-admin-v2-pay-datetime-sub">{row.paidAtTime}</div>
                    </div>
                  </td>
                  <td>
                    <div className="y-admin-v2-pay-user-cell">
                      {row.userId ? (
                        <button
                          type="button"
                          className="y-admin-v2-pay-name-btn"
                          title="회원 CS 파일 열기"
                          onClick={() => setCsUserId(row.userId)}
                        >
                          {row.userName}
                        </button>
                      ) : (
                        <span className="y-admin-v2-pay-name">{row.userName}</span>
                      )}
                      <span className="y-admin-v2-pay-email">{row.userEmail}</span>
                    </div>
                  </td>
                  <td>
                    <SajuCell row={row} />
                  </td>
                  <td>
                    <div className="y-admin-v2-pay-char">
                      <div
                        className="y-admin-v2-pay-char-dot"
                        style={{ background: row.characterBg, color: row.characterColor }}
                      >
                        {row.characterHan}
                      </div>
                      <span className="y-admin-v2-pay-char-name">{row.characterName}</span>
                    </div>
                  </td>
                  <td>
                    <div className="y-admin-v2-pay-prod-cell">{row.productTitle}</div>
                    <div className="y-admin-v2-pay-prod-cat">{row.categoryLabel}</div>
                  </td>
                  <td className="r y-admin-v2-pay-amt-cell">
                    {fmtAmountCell(row)}
                  </td>
                  <td>
                    <span className="y-admin-v2-pay-method">{row.methodLabel}</span>
                  </td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminMemberFileModal userId={csUserId} onClose={() => setCsUserId(null)} enableCreditAdjust />
    </div>
  );
}
