"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminDashboardPeriod } from "@/lib/admin-dashboard-data";
import type { AdminVisitorStats } from "@/lib/admin-visitor-stats";

type Props = {
  period: AdminDashboardPeriod;
  initial: AdminVisitorStats;
  periodLabel: string;
};

const FETCH_TIMEOUT_MS = 20_000;

export function AdminDashboardVisitorCard({ period, initial, periodLabel }: Props) {
  const [stats, setStats] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    setStats({ pageViews: initial.pageViews, uniqueVisitors: initial.uniqueVisitors });
    setError(null);
  }, [period, initial.pageViews, initial.uniqueVisitors]);

  const refresh = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/admin/visitors?period=${encodeURIComponent(period)}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: ctrl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        pageViews?: number;
        uniqueVisitors?: number;
      };

      if (reqId !== reqIdRef.current) return;
      if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");

      setStats({
        pageViews: Number(data.pageViews ?? 0),
        uniqueVisitors: Number(data.uniqueVisitors ?? 0),
      });
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError(e instanceof Error ? e.message : "조회 오류");
      }
    } finally {
      window.clearTimeout(timer);
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [period]);

  return (
    <div className="y-admin-v2-card y-admin-v2-visitor-card">
      <div className="y-admin-v2-visitor-head">
        <button type="button" className="y-admin-inq-refresh-btn" disabled={loading} onClick={() => void refresh()}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>
      {error ? (
        <p className="y-admin-inq-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="y-admin-v2-mini-row y-admin-v2-visitor-row">
        {[
          ["방문자 수 (횟수집계)", stats.pageViews, "회"],
          ["방문자 수 (중복제거)", stats.uniqueVisitors, "명"],
        ].map(([lbl, val, unit]) => (
          <div key={String(lbl)} className="y-admin-v2-mini-item">
            <div className="y-admin-v2-mini-lbl">{lbl}</div>
            <div className="y-admin-v2-mini-val">
              {Number(val).toLocaleString("ko-KR")}
              <span className="unit">{unit}</span>
            </div>
            <div className="y-admin-v2-mini-sub">{periodLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
