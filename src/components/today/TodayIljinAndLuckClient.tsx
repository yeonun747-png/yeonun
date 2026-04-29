"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { __YEONUN_SAJU_STORAGE_KEY__ } from "@/components/my/MySajuCardClient";
import { getKstParts } from "@/lib/datetime/kst";
import type { TodayPublicIljin, TodayPublicLuck } from "@/lib/today-kst-public";

const SAJU_UPDATED = "yeonun:saju-updated";
const CACHE_PREFIX = "yeonun:today-for-you:v1:";

function pad2(n: number) {
  return String(Math.trunc(n)).padStart(2, "0");
}

type ForYouApiBody = {
  name: string;
  calendarType: string;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: string;
};

type ForYouApiOk = {
  han: string;
  hangulName: string;
  msg: string;
  tags: [string, string, string];
  color: string;
  nums: string;
  dir: string;
  food: string;
};

function stableSajuKey(b: ForYouApiBody): string {
  return [b.calendarType, b.year, b.month, b.day, b.hour, b.minute, b.gender].join("|");
}

function parseStoredSaju(raw: string | null): ForYouApiBody | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const year = String(j.year ?? "").trim();
    const month = String(j.month ?? "").trim();
    const day = String(j.day ?? "").trim();
    if (!year || !month || !day) return null;
    const y = parseInt(year, 10);
    const mo = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
    if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const ct = String(j.calendarType ?? "solar");
    const calendarType = ct === "lunar" || ct === "lunar-leap" ? ct : "solar";
    const hour = j.hour != null ? String(j.hour).trim() : "";
    const minute = String(j.minute ?? "0").trim() || "0";
    const gender = j.gender === "male" || j.gender === "female" ? j.gender : "female";
    return {
      name: String(j.name ?? "").trim(),
      calendarType,
      year,
      month,
      day,
      hour,
      minute,
      gender,
    };
  } catch {
    return null;
  }
}

function applyApiToState(j: ForYouApiOk, setIljin: (v: TodayPublicIljin) => void, setLuck: (v: TodayPublicLuck) => void) {
  setIljin({
    han: j.han,
    hangulName: j.hangulName,
    msg: j.msg,
    tags: j.tags,
  });
  setLuck({
    color: j.color,
    nums: j.nums,
    dir: j.dir,
    food: j.food,
  });
}

export function TodayIljinAndLuckClient(props: {
  fallbackIljin: TodayPublicIljin;
  fallbackLuck: TodayPublicLuck;
  /** 일진 카드와 행운 그리드 사이 (예: FOR YOU CTA) */
  between?: ReactNode;
}) {
  const fallbackRef = useRef(props);
  fallbackRef.current = props;

  const [iljin, setIljin] = useState<TodayPublicIljin>(props.fallbackIljin);
  const [luck, setLuck] = useState<TodayPublicLuck>(props.fallbackLuck);

  const sync = useCallback(() => {
    const fb = fallbackRef.current;
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(__YEONUN_SAJU_STORAGE_KEY__);
    const body = parseStoredSaju(raw);
    if (!body) {
      setIljin(fb.fallbackIljin);
      setLuck(fb.fallbackLuck);
      return;
    }

    const kst = getKstParts(new Date());
    const kstKey = `${kst.year}-${pad2(kst.month)}-${pad2(kst.day)}`;
    const cacheKey = `${CACHE_PREFIX}${kstKey}:${stableSajuKey(body)}`;

    try {
      const hit = window.sessionStorage.getItem(cacheKey);
      if (hit) {
        const j = JSON.parse(hit) as ForYouApiOk;
        if (j?.han && j?.hangulName && j?.msg && Array.isArray(j.tags) && j.tags.length >= 3 && j.color && j.nums && j.dir && j.food) {
          applyApiToState(
            {
              ...j,
              tags: [String(j.tags[0]), String(j.tags[1]), String(j.tags[2])] as [string, string, string],
            },
            setIljin,
            setLuck,
          );
          return;
        }
      }
    } catch {
      // 캐시 무시 후 재요청
    }

    void (async () => {
      try {
        const res = await fetch("/api/today/for-you", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = (await res.json()) as ForYouApiOk & { error?: string };
        if (!res.ok || j.error || !j.msg || !j.tags || !j.color) {
          setIljin(fb.fallbackIljin);
          setLuck(fb.fallbackLuck);
          return;
        }
        const normalized: ForYouApiOk = {
          han: String(j.han),
          hangulName: String(j.hangulName),
          msg: String(j.msg),
          tags: [String(j.tags[0] ?? ""), String(j.tags[1] ?? ""), String(j.tags[2] ?? "")] as [string, string, string],
          color: String(j.color),
          nums: String(j.nums),
          dir: String(j.dir),
          food: String(j.food),
        };
        applyApiToState(normalized, setIljin, setLuck);
        try {
          window.sessionStorage.setItem(cacheKey, JSON.stringify(normalized));
        } catch {
          // ignore
        }
      } catch {
        setIljin(fb.fallbackIljin);
        setLuck(fb.fallbackLuck);
      }
    })();
  }, []);

  useEffect(() => {
    sync();
    const onSaju = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === __YEONUN_SAJU_STORAGE_KEY__) sync();
    };
    window.addEventListener(SAJU_UPDATED, onSaju);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAJU_UPDATED, onSaju);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  return (
    <>
      <div className="y-iljin-card">
        <div className="y-iljin-content">
          <div className="y-iljin-label">TODAY · 오늘의 일진</div>
          <div className="y-iljin-cheon">
            <span className="y-iljin-han">{iljin.han}</span>
            <span className="y-iljin-name">{iljin.hangulName}</span>
          </div>
          <p className="y-iljin-msg">{iljin.msg}</p>
          <div className="y-iljin-tags">
            {iljin.tags.map((t, i) => (
              <span key={`${i}-${t}`} className="y-iljin-tag">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {props.between ?? null}

      <div className="y-luck-grid" aria-label="오늘의 행운">
        <div className="y-luck-tile color">
          <div className="y-luck-icon">色</div>
          <div className="y-luck-text">
            <div className="y-luck-label">오늘의 색</div>
            <div className="y-luck-value">{luck.color}</div>
          </div>
        </div>
        <div className="y-luck-tile number">
          <div className="y-luck-icon">數</div>
          <div className="y-luck-text">
            <div className="y-luck-label">오늘의 숫자</div>
            <div className="y-luck-value">{luck.nums}</div>
          </div>
        </div>
        <div className="y-luck-tile dir">
          <div className="y-luck-icon">向</div>
          <div className="y-luck-text">
            <div className="y-luck-label">길한 방향</div>
            <div className="y-luck-value">{luck.dir}</div>
          </div>
        </div>
        <div className="y-luck-tile food">
          <div className="y-luck-icon">膳</div>
          <div className="y-luck-text">
            <div className="y-luck-label">길조 음식</div>
            <div className="y-luck-value">{luck.food}</div>
          </div>
        </div>
      </div>
    </>
  );
}
