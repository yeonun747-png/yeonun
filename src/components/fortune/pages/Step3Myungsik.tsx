"use client";

import { useState } from "react";

import type { ManseRyeokData } from "@/lib/manse-ryeok";
import { explainMansePillar, toHanjaGan, toHanjaJi } from "@/lib/manse-ryeok";

const PILLARS = [
  ["year", "年柱 연주"],
  ["month", "月柱 월주"],
  ["day", "日柱 일주"],
  ["hour", "時柱 시주"],
] as const;

const OH_KEY: Record<string, "wood" | "fire" | "earth" | "metal" | "water"> = {
  갑: "wood",
  을: "wood",
  인: "wood",
  묘: "wood",
  병: "fire",
  정: "fire",
  사: "fire",
  오: "fire",
  무: "earth",
  기: "earth",
  진: "earth",
  술: "earth",
  축: "earth",
  미: "earth",
  경: "metal",
  신: "metal",
  유: "metal",
  임: "water",
  계: "water",
  자: "water",
  해: "water",
};

function ohangKeyOf(ch: string): "wood" | "fire" | "earth" | "metal" | "water" {
  return OH_KEY[ch] ?? "earth";
}

export function Step3Myungsik({
  name,
  manse,
  onNext,
  onPillarTalk,
}: {
  name: string;
  manse: ManseRyeokData;
  onNext: () => void;
  onPillarTalk: (text: string) => void;
}) {
  const [active, setActive] = useState<(typeof PILLARS)[number][0]>("day");
  return (
    <section className="y-fortune-v2-page">
      <div className="y-fortune-v2-section-head">
        <h1>사주 명식</h1>
        <p>{name}님의 사주팔자 · 글자를 탭하면 설명해드려요</p>
      </div>
      <div className="y-fortune-v2-pillar-grid">
        {PILLARS.map(([key, label]) => {
          const p = manse[key];
          const open = active === key;
          return (
            <button
              key={key}
              type="button"
              className={`y-fortune-v2-pillar ${open ? "active" : ""} ${key === "day" ? "day" : ""}`}
              onClick={() => {
                setActive(key);
                onPillarTalk(explainMansePillar(key, p, name));
              }}
            >
              <span className="y-fortune-v2-pillar-label">
                {label}
                {key === "day" ? " ★" : ""}
              </span>
              <span className="y-fortune-v2-ganji">
                <b className={`y-fortune-v2-hj y-fortune-v2-hj--${ohangKeyOf(p.gan)}`}>{toHanjaGan(p.gan)}</b>
                <b className={`y-fortune-v2-hj y-fortune-v2-hj--${ohangKeyOf(p.ji)}`}>{toHanjaJi(p.ji)}</b>
              </span>
              <span className="y-fortune-v2-pillar-desc">
                {p.gan}
                {p.ji} · {p.ohang}
              </span>
              {open ? (
                <span className="y-fortune-v2-pillar-detail">
                  {p.sibsung} · {p.jiSibsung} · {p.sibisinsal}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <button className="y-fortune-v2-primary" type="button" onClick={onNext}>
        오행 분석 보기 →
      </button>
    </section>
  );
}
