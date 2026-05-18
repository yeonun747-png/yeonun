"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { AdminDashboardData, AdminDashboardPeriod } from "@/lib/admin-dashboard-data";

const PERIODS: { id: AdminDashboardPeriod; label: string }[] = [
  { id: "yesterday", label: "어제" },
  { id: "7d", label: "7일" },
  { id: "30d", label: "30일" },
];

const CHAR_FILL: Record<string, string> = {
  yeon: "#F5DAE0",
  yeo: "#BBD2C2",
  byeol: "#C9BCDF",
  un: "#B5BAC8",
};

function fmtKrw(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function deltaLabel(current: number, prev: number, compare = "전일") {
  if (prev <= 0) return { text: `— ${compare} 데이터 없음`, cls: "nt" };
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return { text: `▲ ${pct}% ${compare} 대비`, cls: "up" };
  if (pct < 0) return { text: `▼ ${Math.abs(pct)}% ${compare} 대비`, cls: "dn" };
  return { text: `— ${compare}과 동일`, cls: "nt" };
}

function periodSub(p: AdminDashboardPeriod) {
  if (p === "yesterday") return "어제 기준";
  if (p === "7d") return "최근 7일";
  return "최근 30일";
}

/** KPI 카드 안에서 금액 숫자가 라운드 박스를 넘지 않도록 폰트 크기 자동 조절 */
function KpiMoneyValue({ krw }: { krw: number }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLElement>(null);
  const amount = krw.toLocaleString("ko-KR");

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = valRef.current;
    if (!wrap || !el) return;

    const fit = () => {
      const max = window.matchMedia("(max-width: 1080px)").matches ? 22 : 26;
      const min = 11;
      let size = max;
      el.style.fontSize = `${size}px`;
      const unit = el.querySelector(".unit") as HTMLElement | null;
      if (unit) unit.style.fontSize = `${Math.max(10, Math.round(size * 0.5))}px`;

      for (let guard = 0; guard < 32 && size > min; guard++) {
        if (el.scrollWidth <= wrap.clientWidth - 2) break;
        size -= 1;
        el.style.fontSize = `${size}px`;
        if (unit) unit.style.fontSize = `${Math.max(10, Math.round(size * 0.5))}px`;
      }
    };

    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    return () => ro?.disconnect();
  }, [amount]);

  return (
    <div className="y-admin-v2-kc-val-fit" ref={wrapRef}>
      <strong ref={valRef} className="y-admin-v2-kc-val y-admin-v2-kc-val--money">
        {amount}
        <span className="unit">원</span>
      </strong>
    </div>
  );
}

function RevenueChart({ points }: { points: { label: string; krw: number }[] }) {
  const chart = useMemo(() => {
    const w = 520;
    const h = 130;
    const padL = 30;
    const padR = 25;
    const padT = 20;
    const padB = 12;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const max = Math.max(...points.map((p) => p.krw), 1);
    const step = points.length > 1 ? innerW / (points.length - 1) : innerW;
    const coords = points.map((p, i) => {
      const x = padL + i * step;
      const y = padT + innerH - (p.krw / max) * innerH;
      return { x, y, ...p };
    });
    const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const area =
      coords.map((c) => `${c.x},${c.y}`).join(" ") +
      ` ${coords[coords.length - 1]?.x ?? padL},${padT + innerH} ${coords[0]?.x ?? padL},${padT + innerH}`;
    const last = coords[coords.length - 1];
    const ticks = [max, Math.round(max * 0.6), Math.round(max * 0.2)];
    return { w, h, padL, padT, innerH, coords, line, area, last, ticks, max };
  }, [points]);

  return (
    <div className="y-admin-v2-chart-wrap">
      <svg width="100%" viewBox={`0 0 ${chart.w} ${chart.h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label="매출 트렌드">
        <defs>
          <linearGradient id="y-admin-rev-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C94B6A" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#C94B6A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={chart.padL}
            y1={chart.padT + chart.innerH * t}
            x2={chart.w - 25}
            y2={chart.padT + chart.innerH * t}
            stroke="#E6E0D8"
            strokeWidth="1"
          />
        ))}
        {chart.ticks.map((v, i) => (
          <text key={i} x="0" y={chart.padT + chart.innerH * (i / 2) + 3} fontSize="9" fill="#ADA49A">
            {v >= 10000 ? `${Math.round(v / 10000)}만` : v.toLocaleString("ko-KR")}
          </text>
        ))}
        <polygon points={chart.area} fill="url(#y-admin-rev-grad)" />
        <polyline
          points={chart.line}
          fill="none"
          stroke="#C94B6A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chart.coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === chart.coords.length - 1 ? 4.5 : 3}
            fill={i === chart.coords.length - 1 ? "#C94B6A" : "white"}
            stroke="#C94B6A"
            strokeWidth={i === chart.coords.length - 1 ? 2 : 1.5}
          />
        ))}
        {chart.last && chart.last.krw > 0 ? (
          <>
            <rect x={chart.last.x - 55} y={4} width="70" height="16" rx="4" fill="#1A1815" />
            <text x={chart.last.x - 20} y={15.5} fontSize="8.5" fill="white" textAnchor="middle" fontWeight="600">
              {chart.last.krw.toLocaleString("ko-KR")}원
            </text>
          </>
        ) : null}
      </svg>
      <div className="y-admin-v2-x-labels">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

function SocialDonut({ social }: { social: AdminDashboardData["socialLogin"] }) {
  const { segments, total } = useMemo(() => {
    const items = [
      { key: "google", color: "#4285F4", label: "구글", count: social.google },
      { key: "kakao", color: "#FEE500", label: "카카오", count: social.kakao },
      { key: "naver", color: "#03C75A", label: "네이버", count: social.naver },
    ];
    const total = social.total || items.reduce((s, i) => s + i.count, 0) || 1;
    const circ = 2 * Math.PI * 26;
    let offset = 0;
    const segments = items.map((item) => {
      const pct = item.count / total;
      const dash = pct * circ;
      const seg = { ...item, pct: Math.round(pct * 100), dash, offset: -offset };
      offset += dash;
      return seg;
    });
    return { segments, total };
  }, [social]);

  return (
    <div className="y-admin-v2-donut-block">
      <div className="y-admin-v2-donut-subtitle">소셜 계정 누적 (provider)</div>
      <div className="y-admin-v2-donut-row">
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <circle cx="36" cy="36" r="26" fill="none" stroke="#E6E0D8" strokeWidth="10" />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx="36"
              cy="36"
              r="26"
              fill="none"
              stroke={s.color}
              strokeWidth="10"
              strokeDasharray={`${s.dash} ${2 * Math.PI * 26}`}
              strokeDashoffset={s.offset}
              transform="rotate(-90 36 36)"
            />
          ))}
          <text x="36" y="39" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#1A1815">
            {total}명
          </text>
        </svg>
        <div className="y-admin-v2-donut-legend">
          {segments.map((s) => (
            <div key={s.key} className="y-admin-v2-dl">
              <span className="y-admin-v2-dd" style={{ background: s.color }} />
              {s.label} {s.pct}%
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardPanel({ data }: { data: AdminDashboardData }) {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("yesterday");
  const slice = data.slices[period];
  const ops = data.opsKpis;
  const revDelta = deltaLabel(ops.yesterdayRevenueKrw, ops.yesterdayRevenuePrevKrw, "전일");
  const weekDelta = deltaLabel(ops.weekRevenueKrw, ops.weekRevenuePrevKrw, "직전 7일");
  const dauDelta = deltaLabel(ops.yesterdayDau, ops.yesterdayDauPrev, "전일");
  const signupDelta = deltaLabel(ops.yesterdaySignups, ops.yesterdaySignupsPrev, "전일");
  const dateLabel = data.aggregationLabel;
  const chartTitle =
    period === "30d" ? "30일 결제 매출" : period === "7d" ? "7일 결제 매출" : "7일 결제 매출 (어제 포함)";
  const starMax = Math.max(...data.reviews.starCounts, 1);
  const starsDisplay = "★".repeat(Math.round(data.reviews.avg)) + "☆".repeat(5 - Math.round(data.reviews.avg));

  const funnelSteps = [
    { label: "소셜 계정 누적", val: slice.funnel.membersTotal, width: 100, cvr: null as string | null },
    {
      label: "기간 소셜 가입",
      val: slice.funnel.newSignups,
      width: slice.funnel.membersTotal ? (slice.funnel.newSignups / slice.funnel.membersTotal) * 100 : 0,
      cvr:
        slice.funnel.membersTotal > 0
          ? `누적 대비 ${Math.round((slice.funnel.newSignups / slice.funnel.membersTotal) * 100)}%`
          : null,
    },
    {
      label: "음성 세션 + 점사 요청",
      val: slice.funnel.fortuneOrVoice,
      width: slice.funnel.membersTotal ? (slice.funnel.fortuneOrVoice / slice.funnel.membersTotal) * 100 : 0,
      cvr:
        slice.funnel.newSignups > 0
          ? `가입 대비 ${Math.round((slice.funnel.fortuneOrVoice / slice.funnel.newSignups) * 100)}%`
          : null,
    },
    {
      label: "결제 완료 주문",
      val: slice.funnel.paidOrders,
      width: slice.funnel.membersTotal ? (slice.funnel.paidOrders / slice.funnel.membersTotal) * 100 : 0,
      cvr:
        slice.funnel.fortuneOrVoice > 0
          ? `이용 건 대비 ${Math.round((slice.funnel.paidOrders / slice.funnel.fortuneOrVoice) * 100)}%`
          : null,
      accent: true,
    },
  ];

  return (
    <div className="y-admin-v2-dash">
      <div className="y-admin-v2-ph">
        <div className="y-admin-v2-ph-left">
          <h2>운영 대시보드</h2>
          <p>
            {dateLabel} · DB 실시간 집계
          </p>
        </div>
        <div className="y-admin-v2-period" role="tablist" aria-label="집계 기간">
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
      </div>

      <div className="y-admin-v2-kpi y-admin-v2-kpi-6x2">
        {[
          ["점사 메뉴 상품", data.statusKpis.products, "fortune 메뉴 slug"],
          ["캐릭터", data.statusKpis.characters, "characters 테이블"],
          ["리뷰 행", data.statusKpis.reviews, "reviews 전체"],
          ["결제 테이블", data.statusKpis.paymentsReady ? "조회 OK" : "오류", "payments"],
          ["음성 테이블", data.statusKpis.voiceReady ? "조회 OK" : "오류", "voice_sessions"],
          ["점사 테이블", data.statusKpis.fortuneReady ? "조회 OK" : "오류", "fortune_requests"],
        ].map(([label, val, sub]) => (
          <div key={String(label)} className="y-admin-v2-kc">
            <div className="y-admin-v2-kc-label">{label}</div>
            <strong className="y-admin-v2-kc-val">{val}</strong>
            <span className="y-admin-v2-kc-delta nt">{sub}</span>
          </div>
        ))}
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">어제 결제 매출</div>
          <KpiMoneyValue krw={ops.yesterdayRevenueKrw} />
          <span className={"y-admin-v2-kc-delta " + revDelta.cls}>{revDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">최근 7일 결제 매출</div>
          <KpiMoneyValue krw={ops.weekRevenueKrw} />
          <span className={"y-admin-v2-kc-delta " + weekDelta.cls}>{weekDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label" title="음성·점사·채팅 세션 user_ref 중복 제거">
            어제 활성 user_ref
          </div>
          <strong className="y-admin-v2-kc-val">
            {ops.yesterdayDau}
            <span className="unit">명</span>
          </strong>
          <span className={"y-admin-v2-kc-delta " + dauDelta.cls}>{dauDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">어제 소셜 가입</div>
          <strong className="y-admin-v2-kc-val">
            {ops.yesterdaySignups}
            <span className="unit">명</span>
          </strong>
          <span className={"y-admin-v2-kc-delta " + signupDelta.cls}>{signupDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">어제 크레딧 충전</div>
          <strong className="y-admin-v2-kc-val">
            {ops.creditChargeCount}
            <span className="unit">건</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">
            {ops.creditChargeKrw > 0 ? `${fmtKrw(ops.creditChargeKrw)} (paid 주문)` : "paid 주문 없음"}
          </span>
        </div>
        <div className="y-admin-v2-kc warn">
          <div className="y-admin-v2-kc-label">어제 처리 오류</div>
          <strong className="y-admin-v2-kc-val">
            {ops.llmErrorTotal}
            <span className="unit">건</span>
          </strong>
          <span className="y-admin-v2-kc-delta nt">
            음성 {ops.llmErrorVoice} · 점사 {ops.llmErrorFortune} · 채팅 {ops.llmErrorChat}
          </span>
        </div>
      </div>
      <div className="y-admin-v2-sl">매출 · 이용 현황</div>
      <div className="y-admin-v2-row y-admin-v2-row-60-40">
        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">{chartTitle}</div>
          <div className="y-admin-v2-card-sub">일별 결제 금액 (원)</div>
          <RevenueChart points={slice.dailyRevenue} />
          <div className="y-admin-v2-mini-row">
            {[
              ["음성 상담 시간", `${slice.serviceMini.voiceHours}h`],
              ["채팅 메시지 수", `${slice.serviceMini.chatMessages.toLocaleString("ko-KR")}건`],
              ["점사 요청 수", `${slice.serviceMini.fortuneCount}건`],
              ["소셜 가입", `${slice.serviceMini.newSignups}명`],
            ].map(([lbl, val]) => (
              <div key={lbl} className="y-admin-v2-mini-item">
                <div className="y-admin-v2-mini-lbl">{lbl}</div>
                <div className="y-admin-v2-mini-val">{val}</div>
                <div className="y-admin-v2-mini-sub">{periodSub(period)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">캐릭터별 이용 비율</div>
          <div className="y-admin-v2-card-sub">음성 세션·점사 요청·채팅 세션 건수 합산</div>
          <div className="y-admin-v2-bar-rows">
            {slice.characterUsage.length === 0 ? (
              <p className="y-admin-v2-empty-hint">해당 기간 이용 데이터가 없습니다.</p>
            ) : (
              slice.characterUsage.map((c) => (
                <div key={c.key} className="y-admin-v2-br">
                  <div className="y-admin-v2-br-top">
                    <span className="y-admin-v2-br-name" style={{ color: c.color }}>
                      {c.name}
                    </span>
                    <span className="y-admin-v2-br-val">
                      {c.pct}% · {c.count}건
                    </span>
                  </div>
                  <div className="y-admin-v2-track">
                    <div
                      className="y-admin-v2-fill"
                      style={{ width: `${c.pct}%`, background: CHAR_FILL[c.key] ?? "#E6E0D8" }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <SocialDonut social={data.socialLogin} />
        </div>
      </div>

      <div className="y-admin-v2-sl">콘텐츠 · 전환</div>
      <div className="y-admin-v2-row y-admin-v2-row-3">
        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">결제 상품 순위</div>
          <div className="y-admin-v2-card-sub">
            paid 주문 · {period === "yesterday" ? "어제" : period === "7d" ? "7일" : "30일"} Top 5
          </div>
          <div className="y-admin-v2-rank-rows">
            {slice.productRank.length === 0 ? (
              <p className="y-admin-v2-empty-hint">해당 기간 판매 데이터가 없습니다.</p>
            ) : (
              slice.productRank.map((r) => (
                <div key={r.rank} className="y-admin-v2-rr">
                  <div className={"y-admin-v2-rr-n" + (r.rank <= 2 ? " hi" : "")}>{r.rank}</div>
                  <div className="y-admin-v2-rr-dot" style={{ background: CHAR_FILL[r.charKey] ?? "#F5DAE0", color: r.color }}>
                    {r.han}
                  </div>
                  <div className="y-admin-v2-rr-info">
                    <div className="y-admin-v2-rr-title">{r.title}</div>
                    <div className="y-admin-v2-rr-meta">{r.meta}</div>
                  </div>
                  <div className="y-admin-v2-rr-cnt">{r.count}건</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">리뷰 별점 분포</div>
          <div className="y-admin-v2-card-sub">reviews 테이블 · 별점 입력 {data.reviews.total}건</div>
          <div className="y-admin-v2-rating-head">
            <div className="y-admin-v2-r-big">{data.reviews.avg || "—"}</div>
            <div className="y-admin-v2-r-right">
              <p>{starsDisplay}</p>
              <span>평균 별점</span>
            </div>
          </div>
          <div className="y-admin-v2-star-rows">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = data.reviews.starCounts[star - 1] ?? 0;
              const pct = Math.round((count / starMax) * 100);
              return (
                <div key={star} className="y-admin-v2-sr">
                  <span className="y-admin-v2-sr-lbl">{star}</span>
                  <div className="y-admin-v2-sr-track">
                    <div className="y-admin-v2-sr-fill" style={{ width: `${pct}%`, background: star >= 4 ? "#F5B800" : star === 3 ? "#FDE68A" : "#F87171" }} />
                  </div>
                  <span className="y-admin-v2-sr-num">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="y-admin-v2-card">
          <div className="y-admin-v2-card-title">기간별 전환 (참고)</div>
          <div className="y-admin-v2-card-sub">{periodSub(period)}</div>
          <div className="y-admin-v2-funnel-rows">
            {funnelSteps.map((step) => (
              <div key={step.label} className="y-admin-v2-fr">
                <div className="y-admin-v2-fr-top">
                  <span className="y-admin-v2-fr-label">{step.label}</span>
                  <span className="y-admin-v2-fr-val">{step.val.toLocaleString("ko-KR")}</span>
                </div>
                <div className="y-admin-v2-fr-track">
                  <div
                    className="y-admin-v2-fr-fill"
                    style={{
                      width: `${Math.max(step.width, step.val > 0 ? 4 : 0)}%`,
                      opacity: step.accent ? 1 : 0.85,
                      background: step.accent ? "#8C2A40" : undefined,
                    }}
                  />
                </div>
                {step.cvr ? <div className="y-admin-v2-fr-cvr">{step.cvr}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="y-admin-v2-sl">운영 알림</div>
      <div className="y-admin-v2-card">
        <div className="y-admin-v2-alerts">
          {data.alerts.map((a, i) => (
            <div key={i} className={"y-admin-v2-al " + a.tone}>
              <span className="y-admin-v2-al-dot" />
              <div className="y-admin-v2-al-body">
                <div className="y-admin-v2-al-title">{a.title}</div>
                <div className="y-admin-v2-al-desc">{a.desc}</div>
                <div className="y-admin-v2-al-time">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

