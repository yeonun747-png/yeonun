import fs from "fs";

const out = `"use client";

import { useMemo } from "react";
import type { AdminDashboardData } from "@/lib/admin-dashboard-data";

function fmtKrw(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

function deltaLabel(current: number, prev: number) {
  if (prev <= 0) return { text: "— 전일 데이터 없음", cls: "nt" };
  const pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0) return { text: "▲ " + pct + "% 전일 대비", cls: "up" };
  if (pct < 0) return { text: "▼ " + Math.abs(pct) + "% 전일 대비", cls: "dn" };
  return { text: "— 전일과 동일", cls: "nt" };
}

export function AdminDashboardPanel({ data }: { data: AdminDashboardData }) {
  const revDelta = deltaLabel(data.period.revenueKrw, data.period.revenuePrevKrw);
  const dateLabel = useMemo(
    () => new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" }),
    [],
  );

  return (
    <div className="y-admin-v2-dash">
      <motionless className="y-admin-v2-ph">
        <div className="y-admin-v2-ph-left">
          <h2>운영 대시보드</h2>
          <p>{dateLabel} · DB 실시간 집계</p>
        </div>
      </div>

      <div className="y-admin-v2-kpi">
        {[
          ["상품", data.statusKpis.products, "운영 중"],
          ["캐릭터", data.statusKpis.characters, "운영 중"],
          ["리뷰", data.statusKpis.reviews, "누적"],
          ["결제", data.statusKpis.paymentsReady ? "연결됨" : "확인", "PG"],
          ["음성", data.statusKpis.voiceReady ? "연결됨" : "확인", "세션"],
          ["점사", data.statusKpis.fortuneReady ? "연결됨" : "확인", "요청"],
        ].map(([label, val, sub]) => (
          <div key={String(label)} className="y-admin-v2-kc">
            <div className="y-admin-v2-kc-label">{label}</div>
            <strong className="y-admin-v2-kc-val">{val}</strong>
            <span className="y-admin-v2-kc-delta nt">{sub}</span>
          </div>
        ))}
      </div>

      <div className="y-admin-v2-kpi" style={{ marginBottom: 20 }}>
        <div className="y-admin-v2-kc">
          <motionless className="y-admin-v2-kc-label">어제 매출</div>
          <strong className="y-admin-v2-kc-val">{data.period.revenueKrw.toLocaleString("ko-KR")}<span className="unit">원</span></strong>
          <span className={"y-admin-v2-kc-delta " + revDelta.cls}>{revDelta.text}</span>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">어제 결제</div>
          <strong className="y-admin-v2-kc-val">{data.period.orderCount}<span className="unit">건</span></strong>
        </div>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">신규 가입</div>
          <strong className="y-admin-v2-kc-val">{data.period.newSignups}<span className="unit">명</span></strong>
        </motionless>
        <div className="y-admin-v2-kc">
          <div className="y-admin-v2-kc-label">크레딧 충전</div>
          <strong className="y-admin-v2-kc-val">{data.period.creditChargeCount}<span className="unit">건</span></strong>
          <span className="y-admin-v2-kc-delta up">{fmtKrw(data.period.creditChargeKrw)}</span>
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
                <div className="y-admin-v2-al-desc">{a.desc}</motionless>
                <div className="y-admin-v2-al-time">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(
  "src/components/admin/AdminDashboardPanel.tsx",
  out.replaceAll("motionless", "div"),
  "utf8",
);
console.log("ok");
