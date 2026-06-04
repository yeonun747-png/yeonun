"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { ManseDetailPanel } from "@/components/manse/ManseDetailPanel";
import { markMissionFactM10ManseViewedNow } from "@/lib/mission-reconcile";
import {
  computeManseFromFormInput,
  elementClassFromGan,
  getCurrentDaewoonPillar,
  toHanjaGan,
  toHanjaJi,
  type CalendarType,
} from "@/lib/manse-ryeok";

type StoredSaju = {
  name?: string;
  calendarType: CalendarType;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  gender: "male" | "female";
};

const STORAGE_KEY = "yeonun_saju_v1";
const SAJU_UPDATED_EVENT = "yeonun:saju-updated";

function pad2(v: string | number) {
  const s = String(v);
  return s.length >= 2 ? s : `0${s}`;
}

function genderLabel(g: "male" | "female") {
  return g === "male" ? "남" : "여";
}

function formatHangulHanjaGan(gan: string) {
  return `${gan}(${toHanjaGan(gan)})`;
}

function formatHangulHanjaJi(ji: string) {
  return `${ji}(${toHanjaJi(ji)})`;
}

function formatIljuHangulHanja(gan: string, ji: string) {
  return `${gan}${ji} (${toHanjaGan(gan)}${toHanjaJi(ji)})`;
}

/** 오행 한자 (화면 표기용) — 카드 요약 */
const SIBSUNG_HANJA: Record<string, string> = {
  비견: "比肩",
  겁재: "劫財",
  식신: "食神",
  상관: "傷官",
  편재: "偏財",
  정재: "正財",
  편관: "偏官",
  정관: "正官",
  편인: "偏印",
  정인: "正印",
};

const SINSAL_HANJA: Record<string, string> = {
  지살: "地殺",
  도화: "桃花",
  월살: "月殺",
  망신: "亡神",
  장성: "將星",
  반안: "攀鞍",
  역마: "驛馬",
  육해: "六害",
  화개: "華蓋",
  겁살: "劫殺",
  재살: "災殺",
  천살: "天殺",
};

function hanjaOrKo(map: Record<string, string>, ko: string) {
  return map[ko] ?? ko;
}

function formatSinsalHangulHanja(name: string) {
  return `${name}(${hanjaOrKo(SINSAL_HANJA, name)})`;
}

/** localStorage에서 명식 동기 읽기(서버에서는 항상 null) */
function readStoredSajuSync(): StoredSaju | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as Partial<StoredSaju>;
    if (!j?.year || !j?.month || !j?.day) return null;
    const calendarType: CalendarType =
      j.calendarType === "lunar" || j.calendarType === "lunar-leap" ? j.calendarType : "solar";
    const row: StoredSaju = {
      name: j.name,
      calendarType,
      year: String(j.year),
      month: String(j.month),
      day: String(j.day),
      hour: j.hour != null ? String(j.hour) : "",
      minute: j.minute != null ? String(j.minute) : "0",
      gender: j.gender === "male" ? "male" : "female",
    };
    const r = computeManseFromFormInput({
      userYear: row.year,
      userMonth: row.month,
      userDay: row.day,
      userBirthHour: row.hour || null,
      userBirthMinute: row.minute || null,
      userCalendarType: row.calendarType,
      userName: String(row.name || ""),
    });
    return r ? row : null;
  } catch {
    return null;
  }
}

/** 미션 등: 전체 만세력 시트를 열 수 있는 저장 명식이 있는지(연산 가능한 사주만) */
export function yeonunHasOpenableManseDetail(): boolean {
  if (typeof window === "undefined") return false;
  return readStoredSajuSync() !== null;
}

function sameStored(a: StoredSaju | null, b: StoredSaju | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.calendarType === b.calendarType &&
    a.gender === b.gender &&
    String(a.name ?? "") === String(b.name ?? "")
  );
}

export function MySajuCardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  /** 서버와 하이드 1차는 null로 맞춤. 같은 틱에서 useLayoutEffect로 LS 복원해 첫 페인트에 실데이터 */
  const [saved, setSaved] = useState<StoredSaju | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loadFromStorage = () => {
    setSaved((prev) => {
      const next = readStoredSajuSync();
      if (sameStored(prev, next)) return prev;
      return next;
    });
  };

  useLayoutEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** 오늘의 미션 등: `/my?modal=manse` → 저장 사주가 있을 때만 전체 만세력 시트 오픈 */
  useEffect(() => {
    if (!mounted) return;
    if (searchParams.get("modal") !== "manse") return;
    const ok = readStoredSajuSync();
    if (!ok) {
      router.replace("/my", { scroll: false });
      return;
    }
    setSheetOpen(true);
    router.replace("/my", { scroll: false });
  }, [mounted, searchParams, router]);

  useEffect(() => {
    const onCustom = () => {
      loadFromStorage();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadFromStorage();
    };
    window.addEventListener(SAJU_UPDATED_EVENT, onCustom as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SAJU_UPDATED_EVENT, onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const computed = useMemo(() => {
    if (!saved) return null;
    return computeManseFromFormInput({
      userYear: saved.year,
      userMonth: saved.month,
      userDay: saved.day,
      userBirthHour: saved.hour || null,
      userBirthMinute: saved.minute || null,
      userCalendarType: saved.calendarType,
      userName: saved.name || "",
    });
  }, [saved]);

  const manse = computed?.manse ?? null;
  const hasData = !!(saved && computed && manse);

  useEffect(() => {
    if (!sheetOpen || !hasData) return;
    markMissionFactM10ManseViewedNow();
  }, [sheetOpen, hasData]);

  const sub = hasData
    ? `${saved!.year}. ${pad2(saved!.month)}. ${pad2(saved!.day)}. ${saved!.hour ? `${pad2(saved!.hour)}:${pad2(saved!.minute || "00")}` : "시간 모름"} · ${genderLabel(saved!.gender)}`
    : "아직 입력되지 않았습니다";

  const pillarsCfg = [
    { label: "시" as const, gan: manse?.hour.gan, ji: manse?.hour.ji },
    { label: "일" as const, gan: manse?.day.gan, ji: manse?.day.ji },
    { label: "월" as const, gan: manse?.month.gan, ji: manse?.month.ji },
    { label: "년" as const, gan: manse?.year.gan, ji: manse?.year.ji },
  ];

  const birthYearNum = saved ? parseInt(saved.year, 10) : NaN;
  const daewoonSummary =
    hasData && manse && Number.isFinite(birthYearNum)
      ? getCurrentDaewoonPillar(manse, saved!.gender, birthYearNum)
      : null;

  const sheetNode =
    mounted && sheetOpen && hasData && manse ? (
      <YeonunSheetPortal>
      <div
        className="y-modal open y-modal--manse-detail"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setSheetOpen(false);
        }}
      >
        <div className="y-modal-sheet y-manse-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="y-manse-detail-title">
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <span style={{ width: 32 }} aria-hidden />
            <div className="y-modal-title" id="y-manse-detail-title">
              전체 만세력
            </div>
            <button type="button" className="y-modal-close" onClick={() => setSheetOpen(false)} aria-label="닫기">
              ×
            </button>
          </div>
          <div className="y-modal-scroll y-manse-detail-scroll">
            <ManseDetailPanel
              sajuInput={{
                name: saved.name ?? "",
                calendarType: saved.calendarType,
                year: saved.year,
                month: saved.month,
                day: saved.day,
                hour: saved.hour,
                minute: saved.minute,
                gender: saved.gender,
              }}
            />
          </div>
        </div>
      </div>
      </YeonunSheetPortal>
    ) : null;

  return (
    <div className="y-my-saju-card">
      <div className="y-my-saju-head">
        <div className="y-my-saju-title-block">
          <div className="y-my-saju-icon">命</div>
          <div>
            <div className="y-my-saju-title">내 사주 명식</div>
            <div className="y-my-saju-sub">{sub}</div>
          </div>
        </div>
        <Link className="y-my-saju-edit" href="/my?modal=saju" scroll={false}>
          {hasData ? "수정 ›" : "입력 ›"}
        </Link>
      </div>

      <div className="y-my-pillars" aria-label="사주 기둥">
        {pillarsCfg.map((p) => (
          <div key={p.label} className="y-my-pillar">
            <div className="y-my-p-label">{p.label}</div>
            <div className="y-my-p-glyph-stack">
              <div
                className={
                  p.gan ? `y-my-p-cheon ${elementClassFromGan(p.gan)}` : "y-my-p-cheon y-my-p-cheon--placeholder"
                }
              >
                {p.gan ? formatHangulHanjaGan(p.gan) : "—"}
              </div>
              <div className={p.ji ? "y-my-p-ji" : "y-my-p-ji y-my-p-ji--placeholder"}>
                {p.ji ? formatHangulHanjaJi(p.ji) : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="y-my-saju-summary" aria-label="요약">
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">일주</div>
          <div className="y-my-summary-value">
            {hasData ? <strong>{formatIljuHangulHanja(manse!.day.gan, manse!.day.ji)}</strong> : <strong className="y-my-summary-placeholder">—</strong>}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">용신</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {formatHangulHanjaGan(manse!.month.gan)} · {manse!.month.sibsung}({hanjaOrKo(SIBSUNG_HANJA, manse!.month.sibsung)})
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">현재 대운</div>
          <div className="y-my-summary-value">
            {hasData && daewoonSummary ? (
              <strong>
                {formatIljuHangulHanja(daewoonSummary.gan, daewoonSummary.ji)} · {daewoonSummary.ageFrom} → {daewoonSummary.ageTo}세
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
        <div className="y-my-summary-item">
          <div className="y-my-summary-label">신살</div>
          <div className="y-my-summary-value">
            {hasData ? (
              <strong>
                {formatSinsalHangulHanja(manse!.day.sibisinsal)} · {formatSinsalHangulHanja(manse!.year.sibisinsal)}
              </strong>
            ) : (
              <strong className="y-my-summary-placeholder">—</strong>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="y-my-saju-cta"
        disabled={!hasData}
        onClick={() => hasData && setSheetOpen(true)}
      >
        전체 만세력 분석 보기 →
      </button>
      {sheetNode}
    </div>
  );
}

export const __YEONUN_SAJU_STORAGE_KEY__ = STORAGE_KEY;
