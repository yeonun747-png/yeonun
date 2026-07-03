"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AdminMemberFileModal } from "@/components/admin/AdminMemberFileModal";
import { readAdminPanelHashParams } from "@/lib/admin-panel-nav";
import type { AdminSignupDailyPoint, AdminSignupProviderFilter, AdminSignupRow, AdminSignupsPeriod } from "@/lib/admin-signups";

const PERIODS: { id: AdminSignupsPeriod; label: string }[] = [
  { id: "today", label: "오늘" },
  { id: "yesterday", label: "어제" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
];

const PROVIDERS: { id: AdminSignupProviderFilter; label: string; color: string }[] = [
  { id: "all", label: "전체", color: "#8C2A40" },
  { id: "google", label: "구글", color: "#4285F4" },
  { id: "kakao", label: "카카오", color: "#FEE500" },
  { id: "naver", label: "네이버", color: "#03C75A" },
];

type Payload = {
  period: AdminSignupsPeriod;
  provider: AdminSignupProviderFilter;
  count: number;
  kpis: {
    periodSignups: number;
    periodSignupsPrev: number;
    cumulativeTotal: number;
    onboardingRate: number;
    byProvider: { google: number; kakao: number; naver: number };
    referralSignups: number;
  };
  dailyChart: AdminSignupDailyPoint[];
  rows: AdminSignupRow[];
};

function deltaLabel(current: number, prev: number) {
  if (prev <= 0) return { text: "— 전기간 데이터 없음", cls: "nt" };
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return { text: `▲ ${pct}% 전기간 대비`, cls: "up" };
  if (pct < 0) return { text: `▼ ${Math.abs(pct)}% 전기간 대비`, cls: "dn" };
  return { text: "— 전기간과 동일", cls: "nt" };
}

function SignupStackChart({ points }: { points: AdminSignupDailyPoint[] }) {
  const chart = useMemo(() => {
    const w = 520;
    const h = 140;
    const padT = 12;
    const padB = 4;
    const innerH = h - padT - padB;
    const n = Math.max(points.length, 1);
    const slotW = w / n;
    const max = Math.max(...points.map((p) => p.total), 1);
    const bars = points.map((p, i) => {
      const cx = (i + 0.5) * slotW;
      const bw = Math.max(3, Math.min(slotW * 0.72, 16));
      const x = cx - bw / 2;
      let y = padT + innerH;
      const segs = [
        { key: "google", val: p.google, color: "#4285F4" },
        { key: "kakao", val: p.kakao, color: "#FEE500" },
        { key: "naver", val: p.naver, color: "#03C75A" },
      ];
      const rects = segs.map((s) => {
        const hSeg = (s.val / max) * innerH;
        y -= hSeg;
        return { ...s, x, y, w: bw, h: hSeg };
      });
      return { label: p.label, cx, rects, total: p.total };
    });
    return { w, h, bars, max };
  }, [points]);

  if (points.length === 0) {
    return <p className="y-admin-v2-empty-hint">해당 기간 가입 데이터가 없습니다.</p>;
  }

  return (
    <div className={`y-admin-v2-chart-wrap${points.length > 14 ? " y-admin-signup-chart-wrap--month" : ""}`}>
      <svg viewBox={`0 0 ${chart.w} ${chart.h}`} className="y-admin-signup-chart" aria-hidden>
        {chart.bars.map((b, i) => (
          <g key={`${b.label}-${i}`}>
            {b.rects.map((r) =>
              r.h > 0 ? <rect key={r.key} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.color} rx="1" /> : null,
            )}
          </g>
        ))}
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

export function AdminSignupsPanel() {
  const [period, setPeriod] = useState<AdminSignupsPeriod>("today");
  const [provider, setProvider] = useState<AdminSignupProviderFilter>("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csUserId, setCsUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ period, provider });
      if (q) sp.set("q", q);
      const res = await fetch(`/api/admin/signups?${sp}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");
      setPayload(data as Payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 오류");
    } finally {
      setLoading(false);
    }
  }, [period, provider, q]);

  useEffect(() => {
    const params = readAdminPanelHashParams();
    const p = params.get("period");
    if (p === "today" || p === "yesterday" || p === "7d" || p === "30d") setPeriod(p);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const signupDelta = payload ? deltaLabel(payload.kpis.periodSignups, payload.kpis.periodSignupsPrev) : { text: "", cls: "nt" };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/signups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, provider, q }),
      });
      if (!res.ok) throw new Error("export_failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yeonun-signups-${period}.csv`;
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
    setQ(searchInput.trim());
  };

  return (
    <section className="y-admin-section y-admin-signups-panel">
      <div className="y-admin-inq-panel-head">
        <div>
          <span className="y-admin-eyebrow">MEMBER GROWTH</span>
          <h2>회원 가입 현황</h2>
          <p className="y-admin-inq-panel-desc">소셜 가입 현황·프로바이더별 추이·초대 가입을 확인합니다.</p>
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
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="y-admin-signups-provider-chips">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={provider === p.id ? "on" : ""}
            onClick={() => setProvider(p.id)}
          >
            {p.id !== "all" ? <span className="y-admin-signups-chip-dot" style={{ background: p.color }} /> : null}
            {p.label}
          </button>
        ))}
      </div>

      <form className="y-admin-inq-search y-admin-signups-search" onSubmit={onSearch}>
        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="이름·이메일 검색" />
        <button type="submit">검색</button>
      </form>

      {error ? (
        <p className="y-admin-inq-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="y-admin-v2-kpi y-admin-signups-kpi">
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">기간 가입</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.periodSignups ?? "—"}
            <span className="unit">명</span>
          </strong>
          <span className={`y-admin-v2-kc-delta ${signupDelta.cls}`}>{signupDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">누적 소셜 계정</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.cumulativeTotal ?? "—"}
            <span className="unit">명</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">탈퇴 제외</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">온보딩 완료율</div>
          <strong className="y-admin-v2-kc-val">
            {payload ? payload.kpis.onboardingRate : "—"}
            <span className="unit">%</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">기간 가입자 기준</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">초대 가입</div>
          <strong className="y-admin-v2-kc-val">
            {payload?.kpis.referralSignups ?? "—"}
            <span className="unit">명</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">referral_signups</span>
        </div>
      </div>

      {payload ? (
        <div className="y-admin-signups-provider-row" aria-label="프로바이더별 기간 가입">
          {[
            { key: "google", label: "구글", color: "#4285F4", count: payload.kpis.byProvider.google },
            { key: "kakao", label: "카카오", color: "#FEE500", count: payload.kpis.byProvider.kakao },
            { key: "naver", label: "네이버", color: "#03C75A", count: payload.kpis.byProvider.naver },
          ].map((item) => (
            <div key={item.key} className="y-admin-signups-provider-item">
              <span className="y-admin-signups-provider-item-dot" style={{ background: item.color }} />
              <span
                className="y-admin-signups-provider-item-name"
                style={{ color: item.color === "#FEE500" ? "#6B5B00" : item.color }}
              >
                {item.label}
              </span>
              <strong className="y-admin-signups-provider-item-val">{item.count}명</strong>
            </div>
          ))}
        </div>
      ) : null}

      <div className="y-admin-v2-card y-admin-signups-chart-card">
        <div className="y-admin-v2-card-title">일별 가입 추이</div>
        <div className="y-admin-v2-card-sub">구글·카카오·네이버 스택 (기간·필터 반영)</div>
        {loading && !payload ? (
          <p className="y-admin-v2-empty-hint">불러오는 중…</p>
        ) : (
          <SignupStackChart points={payload?.dailyChart ?? []} />
        )}
        <div className="y-admin-signups-chart-legend">
          <span><i style={{ background: "#4285F4" }} /> 구글</span>
          <span><i style={{ background: "#FEE500" }} /> 카카오</span>
          <span><i style={{ background: "#03C75A" }} /> 네이버</span>
        </div>
      </div>

      <div className="y-admin-v2-sl">가입자 목록 ({payload?.count ?? 0}명)</div>
      <div className="y-admin-v2-pay-table-wrap">
        <table className="y-admin-v2-pay-table y-admin-signups-table">
          <thead>
            <tr>
              <th>#</th>
              <th>가입일시</th>
              <th>프로바이더</th>
              <th>이름</th>
              <th>이메일</th>
              <th>최근 로그인</th>
              <th>온보딩</th>
              <th>초대</th>
            </tr>
          </thead>
          <tbody>
            {loading && !payload ? (
              <tr>
                <td colSpan={8} className="y-admin-v2-pay-empty">
                  불러오는 중…
                </td>
              </tr>
            ) : (payload?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={8} className="y-admin-v2-pay-empty">
                  해당 조건의 가입자가 없습니다.
                </td>
              </tr>
            ) : (
              payload?.rows.map((row, idx) => (
                <tr key={`${row.userId}-${row.joinedAtIso}`}>
                  <td>
                    <span className="y-admin-v2-pay-no">{idx + 1}</span>
                  </td>
                  <td>{row.joinedAtLabel}</td>
                  <td>
                    <span className={`y-admin-signups-provider y-admin-signups-provider--${row.provider}`}>{row.providerLabel}</span>
                  </td>
                  <td>
                    <button type="button" className="y-admin-v2-pay-name-btn" onClick={() => setCsUserId(row.userId)}>
                      {row.name}
                    </button>
                  </td>
                  <td>
                    <span className="y-admin-v2-pay-email">{row.email}</span>
                  </td>
                  <td>{row.lastLoginAtLabel}</td>
                  <td>{row.onboardingCompleted ? "완료" : "미완료"}</td>
                  <td>{row.referralSignup ? "Y" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminMemberFileModal userId={csUserId} onClose={() => setCsUserId(null)} enableCreditAdjust />
    </section>
  );
}
