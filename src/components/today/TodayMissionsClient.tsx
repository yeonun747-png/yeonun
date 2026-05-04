"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { yeonunHasOpenableManseDetail } from "@/components/my/MySajuCardClient";
import {
  missionStorageKeysThatTriggerReconcile,
  reconcileMissionStateWithExternalFacts,
  YEONUN_MISSIONS_RECONCILE_EVENT,
} from "@/lib/mission-reconcile";

import { formatKstDateKey, msUntilNextKstMidnight } from "@/lib/datetime/kst";
import {
  defaultMissionState,
  isMissionCompleted,
  markMissionCompleteInState,
  missionUiLines,
  MISSION_STORAGE_KEY,
  missionActionHref,
  missionCtaLabel,
  syncMissionState,
  type MissionId,
  type MissionRuntimeState,
} from "@/lib/daily-missions";
import { applyMissionCreditReward } from "@/lib/mission-rewards";
import { MissionGlyph } from "@/components/today/MissionGlyph";

const LEGACY_MISSION_KEY = "yeonun_daily_missions_v1";

function loadState(): MissionRuntimeState {
  const today = formatKstDateKey(new Date());
  if (typeof window === "undefined") return defaultMissionState(today);
  try {
    let raw = localStorage.getItem(MISSION_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_MISSION_KEY);
    }
    if (!raw) {
      const s = defaultMissionState(today);
      localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const p = JSON.parse(raw) as Partial<MissionRuntimeState> & { lastAssigned24hMs?: unknown };
    const signup =
      typeof p.signupKstDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.signupKstDate)
        ? p.signupKstDate
        : today;
    const base = defaultMissionState(signup);
    const lastCompletedAtMs =
      p.lastCompletedAtMs && typeof p.lastCompletedAtMs === "object"
        ? (p.lastCompletedAtMs as MissionRuntimeState["lastCompletedAtMs"])
        : {};
    return {
      ...base,
      ...p,
      signupKstDate: signup,
      rolledDayKst: typeof p.rolledDayKst === "string" ? p.rolledDayKst : base.rolledDayKst,
      rolledIds: Array.isArray(p.rolledIds) ? (p.rolledIds as MissionId[]) : base.rolledIds,
      completedOnce: { ...base.completedOnce, ...p.completedOnce },
      completedToday: { ...base.completedToday, ...p.completedToday },
      lastCompletedAtMs: { ...base.lastCompletedAtMs, ...lastCompletedAtMs },
    };
  } catch {
    const s = defaultMissionState(today);
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(s));
    return s;
  }
}

function persist(state: MissionRuntimeState) {
  try {
    localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** 목업: "19시간 25분 후 갱신" */
function formatRefreshLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 1) return `${h}시간 ${m}분 후 갱신`;
  if (m >= 1) return `${m}분 후 갱신`;
  return `${s}초 후 갱신`;
}

const SAJU_UPDATED_EVENT = "yeonun:saju-updated";

export function TodayMissionsClient() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [runtime, setRuntime] = useState<MissionRuntimeState>(() => defaultMissionState("1970-01-01"));
  const [countdownMs, setCountdownMs] = useState(0);
  const markedIoRef = useRef<Set<MissionId>>(new Set());
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pullAndReconcileRuntime = useCallback((): MissionRuntimeState => {
    const raw = loadState();
    const s0 = syncMissionState(new Date(), raw).state;
    const next = reconcileMissionStateWithExternalFacts(new Date(), s0);
    persist(next);
    return next;
  }, []);

  const scheduleReconcileFromStorage = useCallback(() => {
    if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
    reconcileTimerRef.current = setTimeout(() => {
      reconcileTimerRef.current = null;
      setRuntime(pullAndReconcileRuntime());
    }, 60);
  }, [pullAndReconcileRuntime]);

  useEffect(() => {
    setMounted(true);
    setRuntime(pullAndReconcileRuntime());
  }, [pullAndReconcileRuntime]);

  const snapshot = useMemo(() => syncMissionState(new Date(), runtime), [runtime]);

  useEffect(() => {
    if (!mounted) return;
    const tick = () => {
      setCountdownMs(msUntilNextKstMidnight(new Date()));
      setRuntime((prev) => {
        const synced = syncMissionState(new Date(), prev);
        if (
          synced.state.rolledDayKst !== prev.rolledDayKst ||
          JSON.stringify(synced.state.rolledIds) !== JSON.stringify(prev.rolledIds)
        ) {
          persist(synced.state);
          return synced.state;
        }
        return prev;
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [mounted]);

  /** 다른 탭·화면에서 미션 사실이 쌓인 뒤 오늘 탭으로 돌아올 때 LS 기준으로 다시 맞춤 */
  useEffect(() => {
    if (!mounted) return;
    const onReconcile = () => scheduleReconcileFromStorage();
    const onVis = () => {
      if (document.visibilityState === "visible") scheduleReconcileFromStorage();
    };
    const onStorage = (e: StorageEvent) => {
      if (missionStorageKeysThatTriggerReconcile(e.key)) scheduleReconcileFromStorage();
    };
    window.addEventListener(YEONUN_MISSIONS_RECONCILE_EVENT, onReconcile);
    window.addEventListener(SAJU_UPDATED_EVENT, onReconcile);
    window.addEventListener("focus", onReconcile);
    window.addEventListener("pageshow", onReconcile);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      if (reconcileTimerRef.current) clearTimeout(reconcileTimerRef.current);
      window.removeEventListener(YEONUN_MISSIONS_RECONCILE_EVENT, onReconcile);
      window.removeEventListener(SAJU_UPDATED_EVENT, onReconcile);
      window.removeEventListener("focus", onReconcile);
      window.removeEventListener("pageshow", onReconcile);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, [mounted, scheduleReconcileFromStorage]);

  /** 만남·음성·채팅 등에서 LS만 갱신된 뒤 오늘 탭으로 올 때(같은 창) 포커스 이벤트 없이도 동기화 */
  useEffect(() => {
    if (!mounted || pathname !== "/today") return;
    scheduleReconcileFromStorage();
  }, [mounted, pathname, scheduleReconcileFromStorage]);

  const { trio, allComplete } = snapshot;
  const doneCount = trio.filter((m) => isMissionCompleted(m.id, runtime.completedOnce, runtime.completedToday)).length;

  const markComplete = useCallback(
    (id: MissionId) => {
      setRuntime((prev) => {
        const { trio: tr, state: s0 } = syncMissionState(new Date(), prev);
        if (!tr.some((t) => t.id === id)) return prev;
        if (isMissionCompleted(id, s0.completedOnce, s0.completedToday)) return prev;
        const marked = markMissionCompleteInState(s0, id, tr, Date.now());
        applyMissionCreditReward(id);
        const { state: s2 } = syncMissionState(new Date(), marked);
        persist(s2);
        try {
          window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "미션 완료 · 보상이 적립됐어요" } }));
        } catch {
          // ignore
        }
        return s2;
      });
    },
    [],
  );

  useEffect(() => {
    const onFirstNote = (e: Event) => {
      const d = (e as CustomEvent<{ kstDate?: string }>).detail;
      if (d?.kstDate === formatKstDateKey(new Date())) markComplete("M11");
    };
    const onFirstVoice = () => markComplete("M02");
    const onDailyWordsShare = (e: Event) => {
      const d = (e as CustomEvent<{ kstDate?: string }>).detail;
      if (d?.kstDate === formatKstDateKey(new Date())) markComplete("M12");
    };
    window.addEventListener("yeonun:daily-note-first-save", onFirstNote);
    window.addEventListener("yeonun:first-voice-session-ended", onFirstVoice);
    window.addEventListener("yeonun:daily-words-share-complete", onDailyWordsShare);
    return () => {
      window.removeEventListener("yeonun:daily-note-first-save", onFirstNote);
      window.removeEventListener("yeonun:first-voice-session-ended", onFirstVoice);
      window.removeEventListener("yeonun:daily-words-share-complete", onDailyWordsShare);
    };
  }, [markComplete]);

  useEffect(() => {
    if (!mounted || trio.length === 0) return;
    const ids = new Set(trio.map((t) => t.id));
    const obs: IntersectionObserver[] = [];
    const tryMark = (id: MissionId, el: Element | null) => {
      if (!el || !ids.has(id) || markedIoRef.current.has(id)) return;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries.some((en) => en.isIntersecting && en.intersectionRatio > 0.2)) {
            markedIoRef.current.add(id);
            markComplete(id);
            io.disconnect();
          }
        },
        { threshold: [0, 0.2, 0.5] },
      );
      io.observe(el);
      obs.push(io);
    };
    tryMark("M03", document.getElementById("today-iljin"));
    tryMark("M04", document.getElementById("today-daily-words"));
    return () => obs.forEach((o) => o.disconnect());
  }, [mounted, trio, markComplete, runtime.rolledDayKst]);

  if (!mounted) {
    return (
      <div className="y-mission-section" aria-hidden>
        <div className="y-mission-header">
          <div className="y-mission-title-row">
            <h2 className="ySectionTitle y-mission-head-title">오늘의 미션</h2>
            <span className="y-mission-progress-pill">0 / 3 완료</span>
          </div>
          <span className="y-mission-refresh">—</span>
        </div>
        <div className="y-mission-list">
          <div className="y-mission-item y-mission-item--skeleton" />
          <div className="y-mission-item y-mission-item--skeleton" />
          <div className="y-mission-item y-mission-item--skeleton" />
        </div>
      </div>
    );
  }

  if (allComplete) {
    return (
      <div className="y-mission-section" aria-label="오늘의 미션">
        <div className="y-mission-header">
          <div className="y-mission-title-row">
            <h2 className="ySectionTitle y-mission-head-title">오늘의 미션</h2>
            <span className="y-mission-progress-pill">
              {doneCount} / {trio.length} 완료
            </span>
          </div>
          <span className="y-mission-refresh">{formatRefreshLabel(countdownMs)}</span>
        </div>
        <div className="y-mission-all-done-card" role="status">
          <div className="y-mission-all-done-han">祝</div>
          <div className="y-mission-all-done-title">오늘의 미션을 모두 완료했어요</div>
          <p className="y-mission-all-done-desc">새로운 미션은 자정에 도착해요</p>
        </div>
        <div className="y-mission-foot">
          <span>매일 자정 · 새 미션 3개 갱신 · 완료 시 즉시 보상 적립</span>
        </div>
      </div>
    );
  }

  return (
    <div className="y-mission-section" aria-label="오늘의 미션">
      <div className="y-mission-header">
        <div className="y-mission-title-row">
          <h2 className="ySectionTitle y-mission-head-title">오늘의 미션</h2>
          <span className="y-mission-progress-pill">
            {doneCount} / {trio.length} 완료
          </span>
        </div>
        <span className="y-mission-refresh">{formatRefreshLabel(countdownMs)}</span>
      </div>
      <div className="y-mission-list">
        {trio.map((m) => {
          const href =
            m.id === "M10"
              ? !mounted || !yeonunHasOpenableManseDetail()
                ? "/my?modal=saju"
                : "/my?modal=manse"
              : missionActionHref(m.id);
          const done = isMissionCompleted(m.id, runtime.completedOnce, runtime.completedToday);
          const cta = missionCtaLabel(m.id);
          const ui = missionUiLines(m.id);
          const line2 = done ? (
            <>
              <span className="y-mission-badge y-mission-badge--complete">완료</span>
              <span className="y-mission-desc">{ui.descDone}</span>
            </>
          ) : (
            <>
              <span className="y-mission-badge y-mission-badge--rose">{ui.badgeTodo}</span>
              <span className="y-mission-desc">{ui.descTodo}</span>
            </>
          );
          return (
            <div
              key={m.id}
              className={`y-mission-item${done ? " done-item" : ""}`}
              data-mission={m.id}
              role="group"
              aria-label={m.name}
            >
              {done ? (
                <div className="y-mission-row-main">
                  <div className={`y-mission-icon y-mission-icon--${m.id}`} aria-hidden>
                    <MissionGlyph id={m.id} />
                  </div>
                  <div className="y-mission-text">
                    <div className="y-mission-name">{m.name}</div>
                    <div className="y-mission-line2">{line2}</div>
                  </div>
                </div>
              ) : (
                <Link href={href} className="y-mission-row-main" scroll={href.includes("#")}>
                  <div className={`y-mission-icon y-mission-icon--${m.id}`} aria-hidden>
                    <MissionGlyph id={m.id} />
                  </div>
                  <div className="y-mission-text">
                    <div className="y-mission-name">{m.name}</div>
                    <div className="y-mission-line2">{line2}</div>
                  </div>
                </Link>
              )}
              {!done ? (
                <Link href={href} className="y-mission-status todo" scroll={href.includes("#")}>
                  {cta}
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="y-mission-foot">
        <span>매일 자정 · 새 미션 3개 갱신 · 완료 시 즉시 보상 적립</span>
      </div>
    </div>
  );
}
