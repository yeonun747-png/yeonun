"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { MySubpageSheet } from "@/components/my/MySubpageSheet";
import { YEONUN_AUTH_SESSION_CHANGED } from "@/lib/auth-session-events";
import { formatKstDateKey, formatKstDateTimeKo } from "@/lib/datetime/kst";
import { formatCreditUsageAmount, type MyCreditUsageRow } from "@/lib/my-credit-usage";

function monthKeyFromIso(iso: string | null): string {
  if (!iso) return "0";
  return formatKstDateKey(new Date(iso)).slice(0, 7);
}

function monthLabelFromKey(key: string): string {
  const parts = key.split("-");
  const y = Number(parts[0]);
  const monthIndex = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(monthIndex)) return key;
  return `${y}년 ${monthIndex + 1}월`;
}

function usageIcon(row: MyCreditUsageRow): string {
  if (row.kindLabel === "출석 보상") return "🌸";
  if (row.kindLabel === "크레딧 충전") return "🎙️";
  if (row.amountCredits > 0) return "✨";
  if (row.kindLabel === "CS 조정") return "🛠️";
  return "💳";
}

function usageDateLine(iso: string, kindLabel: string): string {
  const when = formatKstDateTimeKo(iso);
  return when ? `${when} · ${kindLabel}` : kindLabel;
}

async function fetchCreditUsage(accessToken: string): Promise<{ rows: MyCreditUsageRow[]; ok: boolean }> {
  const res = await fetch("/api/my/credit-usage", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const j = (await res.json()) as { ok?: boolean; rows?: MyCreditUsageRow[] };
  if (!res.ok || !j.ok || !Array.isArray(j.rows)) return { rows: [], ok: false };
  return { rows: j.rows, ok: true };
}

export function MyCreditUsagePageClient() {
  const { session } = useYeonunAuth();
  const userId = session?.user?.id ?? null;

  const [usageRows, setUsageRows] = useState<MyCreditUsageRow[]>([]);
  const [error, setError] = useState<string | null>(() => (!userId ? "auth" : null));
  const [hydrated, setHydrated] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !session?.access_token) {
      setError("auth");
      setUsageRows([]);
      setHydrated(true);
      return;
    }

    setError(null);
    const usageRes = await fetchCreditUsage(session.access_token);
    setUsageRows(usageRes.rows);
    if (!usageRes.ok) setError("load_failed");
    setHydrated(true);
  }, [session?.access_token, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener(YEONUN_AUTH_SESSION_CHANGED, onRefresh);
    return () => window.removeEventListener(YEONUN_AUTH_SESSION_CHANGED, onRefresh);
  }, [load]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, MyCreditUsageRow[]>();
    for (const r of usageRows) {
      const k = monthKeyFromIso(r.createdAt);
      if (!map.has(k)) {
        map.set(k, []);
        order.push(k);
      }
      map.get(k)!.push(r);
    }
    return order.map((k) => ({
      key: k,
      label: monthLabelFromKey(k),
      items: map.get(k) ?? [],
    }));
  }, [usageRows]);

  const showAuth = !session;

  return (
    <MySubpageSheet title="이용 내역" ariaLabel="이용 내역">
      <div className="y-sub-scroll-page">
        {showAuth ? (
          <div className="y-pay-history-empty" style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--y-mute)" }}>
              로그인 후 크레딧 이용 내역을 확인할 수 있어요.
            </p>
            <Link href="/my?modal=auth" className="y-my-credit-login-btn" style={{ display: "inline-flex" }}>
              로그인
            </Link>
          </div>
        ) : null}

        {error === "load_failed" && hydrated ? (
          <p className="y-pay-history-foot" style={{ color: "#c62828", paddingTop: 16 }}>
            이용 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        ) : null}

        {!showAuth && error !== "load_failed" ? (
          <>
            {grouped.length === 0 && hydrated ? (
              <p className="y-pay-history-foot" style={{ paddingTop: 16 }}>
                최근 12개월 동안 크레딧 이용 내역이 없습니다.
              </p>
            ) : null}

            {grouped.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <div className="y-pay-history-month">{g.label}</div>
                {g.items.map((row) => (
                  <div key={row.id} className="y-pay-history-item">
                    <div className="y-pay-history-icon">{usageIcon(row)}</div>
                    <div className="y-pay-history-info">
                      <div className="y-pay-history-name">{row.title}</div>
                      <div className="y-pay-history-date">{usageDateLine(row.createdAt, row.kindLabel)}</div>
                    </div>
                    <div
                      className={`y-pay-history-amount credit-usage${
                        row.amountCredits > 0 ? " plus" : row.amountCredits < 0 ? " minus" : ""
                      }`}
                    >
                      {formatCreditUsageAmount(row.amountCredits)}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            <p className="y-pay-history-foot">
              크레딧 적립·사용·미션·출석·CS·운영자 조정 내역 · 최근 12개월
            </p>
          </>
        ) : null}

        <div style={{ height: 40 }} />
      </div>
    </MySubpageSheet>
  );
}
