"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminMemberFileModal } from "@/components/admin/AdminMemberFileModal";
import { navigateAdminPanel, readAdminPanelHashParams } from "@/lib/admin-panel-nav";
import type {
  AdminVisitorDailyPoint,
  AdminVisitorsPeriod,
  AdminVisitorsTab,
} from "@/lib/admin-visitors";

const PERIODS: { id: AdminVisitorsPeriod; label: string }[] = [
  { id: "today", label: "오늘" },
  { id: "yesterday", label: "어제" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
];

const TABS: { id: AdminVisitorsTab; label: string }[] = [
  { id: "views", label: "횟수집계" },
  { id: "unique", label: "중복제거" },
];

type Payload = {
  period: AdminVisitorsPeriod;
  tab: AdminVisitorsTab;
  count: number;
  page: number;
  pageSize: number;
  kpis: {
    pageViews: number;
    uniqueVisitors: number;
    avgPageViewsPerVisitor: number;
    memberEvents: number;
    guestEvents: number;
    memberUnique: number;
    guestUnique: number;
  };
  dailyChart: AdminVisitorDailyPoint[];
  pathRank: { path: string; pathLabel: string; count: number; pct: number }[];
  uniqueRows: {
    displayName: string;
    subLabel: string;
    visitorType: "member" | "guest";
    userId: string | null;
    pageViews: number;
    firstAtLabel: string;
    lastAtLabel: string;
    pathsSummary: string;
    pathDetails: { path: string; pathLabel: string; count: number }[];
  }[];
  rows: {
    id: string;
    atIso: string;
    atLabel: string;
    path: string;
    pathLabel: string;
    visitorLabel: string;
    visitorSubLabel: string;
    visitorType: "member" | "guest";
    userId: string | null;
  }[];
};

function VisitPathCell({ path, pathLabel }: { path: string; pathLabel: string }) {
  return (
    <div className="y-admin-visitors-path-cell">
      <div className="y-admin-visitors-path-label">{pathLabel}</div>
      {pathLabel !== path ? <div className="y-admin-visitors-path-raw">{path}</div> : null}
    </div>
  );
}

function VisitorBarChart({ points, tab }: { points: AdminVisitorDailyPoint[]; tab: AdminVisitorsTab }) {
  const chart = useMemo(() => {
    const w = 520;
    const h = 140;
    const padT = 12;
    const padB = 4;
    const innerH = h - padT - padB;
    const n = Math.max(points.length, 1);
    const slotW = w / n;
    const max = Math.max(...points.map((p) => (tab === "unique" ? p.uniqueVisitors : p.pageViews)), 1);
    const color = tab === "unique" ? "#5B7C99" : "#8C2A40";
    const bars = points.map((p, i) => {
      const val = tab === "unique" ? p.uniqueVisitors : p.pageViews;
      const cx = (i + 0.5) * slotW;
      const bw = Math.max(3, Math.min(slotW * 0.72, 16));
      const barH = (val / max) * innerH;
      return {
        label: p.label,
        x: cx - bw / 2,
        y: padT + innerH - barH,
        w: bw,
        h: barH,
        color,
      };
    });
    return { w, h, bars };
  }, [points, tab]);

  if (points.length === 0) {
    return <p className="y-admin-v2-empty-hint">해당 기간 방문 데이터가 없습니다.</p>;
  }

  return (
    <div className={`y-admin-v2-chart-wrap${points.length > 14 ? " y-admin-signup-chart-wrap--month" : ""}`}>
      <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="y-admin-signup-chart" aria-hidden>
        {chart.bars.map((b, i) =>
          b.h > 0 ? <rect key={`${b.label}-${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={b.color} rx="1" /> : null,
        )}
      </svg>
      <div
        className={`y-admin-signup-x-labels${points.length > 14 ? " y-admin-signup-x-labels--month" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
          ...(points.length > 14 ? { ["--signup-cols" as string]: String(points.length) } : {}),
        }}
      >
        {points.map((p, i) => (
          <span key={`${p.label}-${i}`}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

export function AdminVisitorsPanel() {
  const [period, setPeriod] = useState<AdminVisitorsPeriod>("today");
  const [tab, setTab] = useState<AdminVisitorsTab>("views");
  const [page, setPage] = useState(1);
  const [pathQ, setPathQ] = useState("");
  const [pathInput, setPathInput] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csUserId, setCsUserId] = useState<string | null>(null);

  useEffect(() => {
    const syncFromHash = () => {
      const params = readAdminPanelHashParams();
      const p = params.get("period");
      if (p === "today" || p === "yesterday" || p === "7d" || p === "30d") setPeriod(p);
      const t = params.get("tab");
      if (t === "views" || t === "unique") setTab(t);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const syncHash = useCallback((nextPeriod: AdminVisitorsPeriod, nextTab: AdminVisitorsTab) => {
    navigateAdminPanel("visitors", { period: nextPeriod, tab: nextTab });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ period, tab, page: String(page) });
      if (pathQ) sp.set("path", pathQ);
      const res = await fetch(`/api/admin/visitors?${sp}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");
      setPayload(data as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 오류");
    } finally {
      setLoading(false);
    }
  }, [period, tab, page, pathQ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    setPage(1);
  }, [period, tab, pathQ]);

  const totalPages = payload ? Math.max(1, Math.ceil(payload.count / payload.pageSize)) : 1;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, path: pathQ }),
      });
      if (!res.ok) throw new Error("export_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yeonun-visitors-${period}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("CSV보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setPathQ(pathInput.trim());
  };

  const onPeriodChange = (next: AdminVisitorsPeriod) => {
    setPeriod(next);
    setPage(1);
    syncHash(next, tab);
  };

  const onTabChange = (next: AdminVisitorsTab) => {
    setTab(next);
    syncHash(period, next);
  };

  return (
    <section className="y-admin-section y-admin-visitors-panel">
      <div className="y-admin-inq-panel-head">
        <div>
          <span className="y-admin-eyebrow">SITE TRAFFIC</span>
          <h2>방문자 현황</h2>
          <p className="y-admin-inq-panel-desc">페이지뷰·유니크 방문자·경로별 조회와 이벤트 로그를 확인합니다.</p>
        </div>
        <div className="y-admin-signups-head-actions">
          <button type="button" className="y-admin-inq-refresh-btn" disabled={loading} onClick={() => void reload()}>
            {loading ? "불러오는 중…" : "새로고침"}
          </button>
          <button type="button" className="y-admin-inq-refresh-btn" disabled={exporting || loading} onClick={() => void exportCsv()}>
            {exporting ? "보내는 중…" : "CSV보내기"}
          </button>
        </div>
      </div>

      <div className="y-admin-v2-period y-admin-signups-period" role="tablist" aria-label="집계 기간">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={period === p.id}
            className={period === p.id ? "on" : ""}
            onClick={() => onPeriodChange(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="y-admin-visitors-metric-tabs" role="tablist" aria-label="집계 방식">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "on" : ""}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="y-admin-inq-search y-admin-signups-search" onSubmit={onSearch}>
        <input value={pathInput} onChange={(e) => setPathInput(e.target.value)} placeholder="경로·페이지명 검색 (예: 마이탭, /fortune)" />
        <button type="submit">검색</button>
      </form>

      {error ? (
        <p className="y-admin-inq-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="y-admin-v2-kpi y-admin-signups-kpi">
        <div className={`y-admin-v2-kc${tab === "views" ? " y-admin-visitors-kpi--active" : ""}`}>
          <div className="y-admin-v2-kc-label">방문자 수 (횟수집계)</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.pageViews ?? "—"}
            <span className="unit">회</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">페이지뷰 합계</span>
        </div>
        <div className={`y-admin-v2-kc${tab === "unique" ? " y-admin-visitors-kpi--active" : ""}`}>
          <div className="y-admin-v2-kc-label">방문자 수 (중복제거)</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.uniqueVisitors ?? "—"}
            <span className="unit">명</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">visitor_ref 기준</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">방문당 평균 PV</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.avgPageViewsPerVisitor ?? "—"}
            <span className="unit">회</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">횟수 ÷ 유니크</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">회원 / 비회원 (유니크)</div>
          <strong className="y-admin-v2-kc-val y-admin-visitors-split-val">
            {payload ? `${payload.kpis.memberUnique} / ${payload.kpis.guestUnique}` : "—"}
            <span className="unit">명</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">
            이벤트 {payload ? `${payload.kpis.memberEvents} / ${payload.kpis.guestEvents}` : "—"}회
          </span>
        </div>
      </div>

      <div className="y-admin-v2-row y-admin-v2-row-60-40 y-admin-visitors-charts-row">
        <div className="y-admin-v2-card y-admin-signups-chart-card">
          <div className="y-admin-v2-card-title">{tab === "unique" ? "일별 유니크 방문자" : "일별 페이지뷰"}</div>
          <div className="y-admin-v2-card-sub">{tab === "unique" ? "중복 제거 방문자 수" : "페이지 조회 횟수 합계"}</div>
          {loading && !payload ? (
            <p className="y-admin-v2-empty-hint">불러오는 중…</p>
          ) : (
            <VisitorBarChart points={payload?.dailyChart ?? []} tab={tab} />
          )}
        </div>

        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">경로별 조회 Top 10</div>
          <div className="y-admin-v2-card-sub">한글 페이지명 · 기간·필터 반영</div>
          <div className="y-admin-v2-rank-rows">
            {(payload?.pathRank.length ?? 0) === 0 ? (
              <p className="y-admin-v2-empty-hint">해당 기간 조회 데이터가 없습니다.</p>
            ) : (
              payload?.pathRank.map((r, idx) => (
                <div key={r.path} className="y-admin-v2-rr y-admin-visitors-path-row">
                  <div className={"y-admin-v2-rr-n" + (idx < 3 ? " hi" : "")}>{idx + 1}</div>
                  <div className="y-admin-v2-rr-info">
                    <div className="y-admin-v2-rr-title">{r.pathLabel}</div>
                    <div className="y-admin-v2-rr-meta">
                      {r.pct}% · {r.path}
                    </div>
                  </div>
                  <div className="y-admin-v2-rr-cnt">{r.count.toLocaleString("ko-KR")}회</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="y-admin-v2-sl">유니크 방문자 ({payload?.uniqueRows.length ?? 0}명)</div>
      <div className="y-admin-v2-pay-table-wrap">
        <table className="y-admin-v2-pay-table y-admin-visitors-table y-admin-visitors-unique-table">
          <colgroup>
            <col className="y-admin-visitors-col-no" />
            <col className="y-admin-visitors-col-visitor" />
            <col className="y-admin-visitors-col-views" />
            <col className="y-admin-visitors-col-pages" />
            <col className="y-admin-visitors-col-time" />
            <col className="y-admin-visitors-col-time" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>방문자</th>
              <th>조회</th>
              <th>방문 페이지</th>
              <th>첫 방문</th>
              <th>마지막 방문</th>
            </tr>
          </thead>
          <tbody>
            {loading && !payload ? (
              <tr>
                <td colSpan={6} className="y-admin-v2-pay-empty">
                  불러오는 중…
                </td>
              </tr>
            ) : (payload?.uniqueRows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="y-admin-v2-pay-empty">
                  해당 기간 유니크 방문자가 없습니다.
                </td>
              </tr>
            ) : (
              payload?.uniqueRows.map((row, idx) => (
                <tr key={`${row.displayName}-${row.firstAtLabel}-${idx}`}>
                  <td>
                    <span className="y-admin-v2-pay-no">{idx + 1}</span>
                  </td>
                  <td>
                    <div className="y-admin-visitors-visitor-cell">
                      {row.userId ? (
                        <button type="button" className="y-admin-v2-pay-name-btn" onClick={() => setCsUserId(row.userId)}>
                          {row.displayName}
                        </button>
                      ) : (
                        <span className="y-admin-visitors-guest-name">{row.displayName}</span>
                      )}
                      <span className="y-admin-visitors-visitor-sub">{row.subLabel}</span>
                      <span className={`y-admin-visitors-type y-admin-visitors-type--${row.visitorType}`}>
                        {row.visitorType === "member" ? "회원" : "비회원"}
                      </span>
                    </div>
                  </td>
                  <td>{row.pageViews}회</td>
                  <td>
                    <div className="y-admin-visitors-paths-cell">
                      <div className="y-admin-visitors-paths-summary">{row.pathsSummary || "—"}</div>
                      <div className="y-admin-visitors-paths-detail">
                        {row.pathDetails.map((p) => (
                          <span key={`${p.path}-${p.count}`} className="y-admin-visitors-path-chip">
                            {p.pathLabel} {p.count}회
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>{row.firstAtLabel}</td>
                  <td>{row.lastAtLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="y-admin-v2-sl">방문 이벤트 ({payload?.count ?? 0}건)</div>
      <div className="y-admin-v2-pay-table-wrap">
        <table className="y-admin-v2-pay-table y-admin-visitors-table">
          <thead>
            <tr>
              <th>#</th>
              <th>시각</th>
              <th>방문자</th>
              <th>페이지</th>
              <th>유형</th>
            </tr>
          </thead>
          <tbody>
            {loading && !payload ? (
              <tr>
                <td colSpan={5} className="y-admin-v2-pay-empty">
                  불러오는 중…
                </td>
              </tr>
            ) : (payload?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={5} className="y-admin-v2-pay-empty">
                  해당 조건의 방문 이벤트가 없습니다.
                </td>
              </tr>
            ) : (
              payload?.rows.map((row, idx) => (
                <tr key={row.id}>
                  <td>
                    <span className="y-admin-v2-pay-no">{(payload.page - 1) * payload.pageSize + idx + 1}</span>
                  </td>
                  <td>{row.atLabel}</td>
                  <td>
                    <div className="y-admin-visitors-visitor-cell">
                      {row.userId ? (
                        <button type="button" className="y-admin-v2-pay-name-btn" onClick={() => setCsUserId(row.userId)}>
                          {row.visitorLabel}
                        </button>
                      ) : (
                        <span className="y-admin-visitors-guest-name">{row.visitorLabel}</span>
                      )}
                      <span className="y-admin-visitors-visitor-sub">{row.visitorSubLabel}</span>
                    </div>
                  </td>
                  <td>
                    <VisitPathCell path={row.path} pathLabel={row.pathLabel} />
                  </td>
                  <td>
                    <span className={`y-admin-visitors-type y-admin-visitors-type--${row.visitorType}`}>
                      {row.visitorType === "member" ? "회원" : "비회원"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="y-admin-visitors-pager">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            이전
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
            다음
          </button>
        </div>
      ) : null}

      <AdminMemberFileModal userId={csUserId} onClose={() => setCsUserId(null)} enableCreditAdjust />
    </section>
  );
}
