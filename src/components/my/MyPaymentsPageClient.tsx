"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MyPaymentApiRow, MyPaymentsPayload } from "@/app/api/my/payments/route";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import {
  readStubPaymentHistory,
  YEONUN_STUB_PAYMENTS_EVENT,
  type StubPaymentRow,
} from "@/lib/payments-history-stub";
import { supabaseBrowser } from "@/lib/supabase/client";

type PayDetail = {
  product: string;
  paidAt: string;
  method: string;
  amount: string;
  statusText: string;
  statusDone: boolean;
  libraryBtn: string;
  libraryHref: string;
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

function methodLabel(method: string): string {
  switch (method) {
    case "card":
      return "신용·체크카드";
    case "phone":
      return "휴대폰 결제";
    case "credit":
      return "크레딧 결제";
    default:
      return method || "결제";
  }
}

function productIcon(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("credit") || s.includes("voice")) return "🎙️";
  if (s.includes("newyear") || s.includes("2026")) return "⭐";
  return "📖";
}

function libraryAction(slug: string): { href: string; label: string } {
  const s = slug.toLowerCase();
  if (s.includes("credit")) return { href: "/checkout/credit", label: "크레딧 충전 화면으로" };
  return { href: "/library", label: "점사 보관함에서 이 풀이 열기" };
}

function formatPaidAtFull(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function monthKeyFromIso(iso: string | null): string {
  if (!iso) return "0";
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function monthLabelFromKey(key: string): string {
  const parts = key.split("-");
  const y = Number(parts[0]);
  const monthIndex = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(monthIndex)) return key;
  return `${y}년 ${monthIndex + 1}월`;
}

function stubRowsToApi(rows: StubPaymentRow[]): MyPaymentApiRow[] {
  return rows.map((s) => ({
    kind: "payment",
    id: s.id,
    orderId: `stub-${s.id}`,
    orderNo: "체험",
    productSlug: s.productSlug,
    title: s.title,
    paidAt: s.paidAt,
    method: s.method,
    amountKrw: s.amountKrw,
    paymentStatus: "paid",
  }));
}

function computeTotalsFromPaymentRows(rows: MyPaymentApiRow[]) {
  const now = new Date();
  const y0 = now.getFullYear();
  const m0 = now.getMonth();
  let yearTotalKrw = 0;
  let monthTotalKrw = 0;
  for (const r of rows) {
    if (r.kind !== "payment") continue;
    const d = new Date(r.paidAt ?? 0);
    if (!Number.isFinite(d.getTime())) continue;
    const amt = r.amountKrw;
    if (amt < 0) continue;
    if (d.getFullYear() === y0) yearTotalKrw += amt;
    if (d.getFullYear() === y0 && d.getMonth() === m0) monthTotalKrw += amt;
  }
  return { yearTotalKrw, monthTotalKrw };
}

function apiRowToPayRow(r: MyPaymentApiRow): PayRow {
  const refund = r.kind === "refund" || r.amountKrw < 0;
  const iso = r.paidAt ?? "";
  const d = iso ? new Date(iso) : new Date();
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const dateLine = `${md} · ${methodLabel(r.method)}`;
  const absAmt = Math.abs(r.amountKrw);
  const amountStr = `${refund ? "-" : ""}${absAmt.toLocaleString("ko-KR")}원`;
  const act = libraryAction(r.productSlug);
  const statusText =
    r.kind === "refund"
      ? r.refundStatus === "requested"
        ? "환불 접수"
        : "환불 완료"
      : "결제 완료";
  const statusDone =
    r.kind === "payment" ||
    r.refundStatus === "processed" ||
    r.refundStatus === "completed" ||
    r.refundStatus === "done";

  return {
    id: r.id,
    icon: refund ? "↩️" : productIcon(r.productSlug),
    name: r.title,
    dateLine,
    amount: amountStr,
    refund,
    detail: {
      product: r.title,
      paidAt: formatPaidAtFull(r.paidAt),
      method: methodLabel(r.method),
      amount: amountStr,
      statusText,
      statusDone,
      libraryBtn: act.label,
      libraryHref: act.href,
      refundHtml: refund
        ? "<strong>환불 안내</strong><br />처리 일정은 카드사·결제사 정책에 따라 달라질 수 있습니다."
        : "<strong>환불 정책</strong><br />디지털 콘텐츠·충전 상품은 이용 시작 후 환불이 제한될 수 있습니다.",
    },
  };
}

export function MyPaymentsPageClient() {
  const [sel, setSel] = useState<PayRow | null>(null);
  const [apiRows, setApiRows] = useState<MyPaymentApiRow[]>([]);
  const [yearTotal, setYearTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromStub, setFromStub] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;

    if (!session?.access_token && readAuthStubLoggedIn()) {
      const raw = readStubPaymentHistory();
      const mapped = stubRowsToApi(raw);
      const totals = computeTotalsFromPaymentRows(mapped);
      setFromStub(true);
      setApiRows(mapped);
      setYearTotal(totals.yearTotalKrw);
      setMonthTotal(totals.monthTotalKrw);
      setLoading(false);
      return;
    }

    setFromStub(false);

    if (!session?.access_token) {
      setLoading(false);
      setError("auth");
      setApiRows([]);
      setYearTotal(0);
      setMonthTotal(0);
      return;
    }
    try {
      const res = await fetch("/api/my/payments", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = (await res.json()) as MyPaymentsPayload | { ok: false; error?: string };
      if (!res.ok || !("ok" in data) || data.ok !== true) {
        setError(typeof data === "object" && data && "error" in data ? String(data.error) : "load_failed");
        setApiRows([]);
        setYearTotal(0);
        setMonthTotal(0);
        return;
      }
      setApiRows(data.rows);
      setYearTotal(data.yearTotalKrw);
      setMonthTotal(data.monthTotalKrw);
    } catch {
      setError("load_failed");
      setApiRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, onRefresh);
    window.addEventListener(YEONUN_STUB_PAYMENTS_EVENT, onRefresh);
    return () => {
      window.removeEventListener(YEONUN_AUTH_STUB_EVENT, onRefresh);
      window.removeEventListener(YEONUN_STUB_PAYMENTS_EVENT, onRefresh);
    };
  }, [load]);

  const detail = useMemo(() => sel?.detail ?? null, [sel]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MyPaymentApiRow[]>();
    for (const r of apiRows) {
      const k = monthKeyFromIso(r.paidAt);
      if (!map.has(k)) {
        map.set(k, []);
        order.push(k);
      }
      map.get(k)!.push(r);
    }
    return order.map((k) => ({
      key: k,
      label: monthLabelFromKey(k),
      items: (map.get(k) ?? []).map(apiRowToPayRow),
    }));
  }, [apiRows]);

  const yLabel = new Date().getFullYear();
  const sheetTitle = detail ? "결제 상세" : "결제 내역";

  return (
    <MySubpageSheet title={sheetTitle} ariaLabel={sheetTitle}>
      <div className="y-sub-scroll-page">
        {!detail ? (
          <>
            {error === "auth" ? (
              <div className="y-pay-history-empty" style={{ padding: "24px 16px", textAlign: "center" }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--y-mute)" }}>
                  로그인 후 결제 내역을 확인할 수 있어요.
                </p>
                <Link href="/my?modal=auth" className="y-my-credit-login-btn" style={{ display: "inline-flex" }}>
                  로그인
                </Link>
              </div>
            ) : null}

            {error && error !== "auth" ? (
              <p className="y-pay-history-foot" style={{ color: "#c62828" }}>
                내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
              </p>
            ) : null}

            {loading && !error ? (
              <p className="y-pay-history-foot">불러오는 중…</p>
            ) : null}

            {!loading && !error ? (
              <>
                <div className="y-pay-history-total">
                  <div>
                    <div className="y-pay-history-total-label">{yLabel}년 누적 결제</div>
                    <div className="y-pay-history-total-val">{yearTotal.toLocaleString("ko-KR")}원</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="y-pay-history-total-label">이번 달</div>
                    <div className="y-pay-history-total-val">{monthTotal.toLocaleString("ko-KR")}원</div>
                  </div>
                </div>

                {grouped.length === 0 ? (
                  <p className="y-pay-history-foot">최근 12개월 동안 결제 내역이 없습니다.</p>
                ) : null}

                {grouped.map((g) => (
                  <section key={g.key} aria-label={g.label}>
                    <div className="y-pay-history-month">{g.label}</div>
                    {g.items.map((row) => (
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
                  </section>
                ))}
                <p className="y-pay-history-foot">
                  {fromStub
                    ? "체험 로그인: 내역은 이 기기(브라우저)에만 저장됩니다."
                    : "최근 12개월 기준 · 환불은 별도 표기될 수 있습니다"}
                </p>
              </>
            ) : null}
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
            <Link href={detail.libraryHref} className="y-pay-detail-open-btn">
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
    </MySubpageSheet>
  );
}
