"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import type { AttendanceRewardKind } from "@/lib/attendance-rewards";
import { rewardModalBodyKo, rewardModalTitleKo } from "@/lib/attendance-rewards";
import { syncLocalAttendanceStub } from "@/lib/attendance-local-stub";
import { applyAttendanceCreditReward } from "@/lib/mission-rewards";
import { supabaseBrowser } from "@/lib/supabase/client";

type SyncPayload = {
  ok: true;
  todayKst: string;
  /** 체험 로그인(auth-stub)만 있고 Supabase 세션 없음 → 로컬 출석 */
  isLocalStub?: boolean;
  attendedToday: boolean;
  streak: number;
  cycle: number;
  badgeStreak: number;
  daysUntilSeven: number;
  stampFilled: number;
  stampPulseIndex: number | null;
  cycleRewardLine: string;
  completedSeven: boolean;
  rewardKind: AttendanceRewardKind | null;
  couponPendingFromReward: boolean;
  voiceSecondsAdded: number;
  pendingCouponGranted: boolean;
  couponPending: boolean;
  nextCyclePreviewLine: string;
};

export function TodayAttendanceClient() {
  const [mounted, setMounted] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SyncPayload | null>(null);
  const [cycleBanner, setCycleBanner] = useState(false);
  const [rewardOpen, setRewardOpen] = useState(false);
  const rewardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSeqRef = useRef(0);

  const completionUiKey = (userId: string, todayKst: string) => `yeonun_att_7ui_${userId}_${todayKst}`;

  const applyCompletionUi = useCallback((p: SyncPayload, modalUserId: string) => {
    if (p.voiceSecondsAdded > 0) {
      applyAttendanceCreditReward(p.voiceSecondsAdded);
    }
    if (p.pendingCouponGranted) {
      window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "대기 중이던 할인 쿠폰이 발급됐어요" } }));
    }
    if (p.completedSeven && p.couponPendingFromReward) {
      window.dispatchEvent(
        new CustomEvent("yeonun:toast", {
          detail: { message: "쿠폰은 기존 쿠폰 사용 또는 만료 후 자동으로 발급돼요" },
        }),
      );
    }

    if (p.completedSeven && p.rewardKind && typeof window !== "undefined") {
      try {
        const ck = completionUiKey(modalUserId, p.todayKst ?? "");
        if (!sessionStorage.getItem(ck)) {
          sessionStorage.setItem(ck, "1");
          if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
          rewardTimerRef.current = setTimeout(() => setRewardOpen(true), 500);
          setCycleBanner(true);
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setCycleBanner(false), 2000);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const sync = useCallback(async () => {
    const sb = supabaseBrowser();
    const stub = readAuthStubLoggedIn();
    if (!sb) {
      setLoggedIn(stub);
      setLoading(false);
      if (stub) {
        const seq = ++syncSeqRef.current;
        const p = syncLocalAttendanceStub(new Date());
        if (seq !== syncSeqRef.current) return;
        setData({ ...p });
        applyCompletionUi({ ...p }, "local_stub");
      }
      return;
    }
    const {
      data: { session },
    } = await sb.auth.getSession();

    if (!session?.access_token) {
      if (stub) {
        setLoggedIn(true);
        setLoading(true);
        const seq = ++syncSeqRef.current;
        try {
          const p = syncLocalAttendanceStub(new Date());
          if (seq !== syncSeqRef.current) return;
          setData({ ...p });
          applyCompletionUi({ ...p }, "local_stub");
        } finally {
          if (seq === syncSeqRef.current) setLoading(false);
        }
        return;
      }
      setLoggedIn(false);
      setLoading(false);
      return;
    }

    setLoggedIn(true);
    setLoading(true);
    const seq = ++syncSeqRef.current;
    const userId = session.user.id;
    try {
      const res = await fetch("/api/today/attendance/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const raw: unknown = await res.json();
      if (seq !== syncSeqRef.current) return;
      if (!raw || typeof raw !== "object" || !("ok" in raw) || (raw as { ok?: unknown }).ok !== true) {
        setData(null);
        return;
      }
      const p = raw as SyncPayload;
      setData(p);
      applyCompletionUi(p, userId);
    } finally {
      if (seq === syncSeqRef.current) setLoading(false);
    }
  }, [applyCompletionUi]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void sync();
  }, [mounted, sync]);

  useEffect(() => {
    const onStub = () => void sync();
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
    return () => window.removeEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
  }, [sync]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange(() => {
      void sync();
    });
    return () => subscription.unsubscribe();
  }, [sync]);

  useEffect(() => {
    return () => {
      if (rewardTimerRef.current) clearTimeout(rewardTimerRef.current);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, []);

  const progressLabel = (() => {
    if (cycleBanner) return "새로운 사이클 시작!";
    if (!data) return "—";
    return `7일 달성까지 ${data.daysUntilSeven}일`;
  })();

  const reward = data?.rewardKind
    ? {
        title: rewardModalTitleKo(data.rewardKind),
        body: rewardModalBodyKo(data.rewardKind, Boolean(data.couponPendingFromReward)),
      }
    : null;

  const loginBlock = (
    <div className="y-att-guest">
      <p className="y-att-guest-text">로그인하면 출석 보상을 받을 수 있어요</p>
      <Link className="y-att-guest-login" href="/my?modal=auth">
        로그인
      </Link>
    </div>
  );

  return (
    <div className="y-attendance" aria-label="매일 출석">
      <div className="y-att-head">
        <h2 className="ySectionTitle y-att-section-title">
          매일 출석{" "}
          {data && data.badgeStreak >= 1 ? (
            <span className="y-att-streak">🔥 {data.badgeStreak}일 연속</span>
          ) : null}
        </h2>
        <div className="y-att-progress" aria-live="polite">
          {loggedIn && loading ? "…" : loggedIn ? progressLabel : ""}
        </div>
      </div>

      {loggedIn === false && loginBlock}

      {loggedIn && loading && (
        <div className="y-att-loading" aria-busy="true">
          출석 정보를 불러오는 중…
        </div>
      )}

      {loggedIn && !loading && data && (
        <>
          <div className="y-att-row">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const filled = data.stampFilled;
              const pulse = data.stampPulseIndex;
              let cls = "y-att-stamp future";
              let inner = "·";
              if (day <= filled) {
                cls = "y-att-stamp done";
                inner = "✓";
              } else if (pulse === day) {
                cls = "y-att-stamp today y-att-stamp--pulse";
                inner = "!";
              }
              return (
                <div key={day} className="y-att-day">
                  <div className="y-att-day-label">{day}일</div>
                  <div className={cls}>{inner}</div>
                </div>
              );
            })}
          </div>
          <div className="y-att-reward">
            <p className="y-att-reward-main">{data.cycleRewardLine}</p>
            <p className="y-att-reward-sub">하루라도 빠지면 1일부터 다시 시작 · 사이클마다 보상이 바뀝니다</p>
            {data.isLocalStub ? (
              <p className="y-att-reward-sub y-att-reward-stub-note">체험 로그인: 출석은 이 기기에만 저장돼요</p>
            ) : null}
          </div>
        </>
      )}

      {mounted && rewardOpen && data?.rewardKind ? (
        <YeonunSheetPortal>
          <div
            className="y-modal open"
            data-modal="reward"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setRewardOpen(false);
            }}
          >
            <div className="y-modal-sheet y-att-reward-sheet" role="dialog" aria-modal="true" aria-labelledby="y-att-reward-title">
              <div className="y-modal-handle" />
              <div className="y-modal-head">
                <span style={{ width: 32 }} aria-hidden />
                <div className="y-modal-title" id="y-att-reward-title">
                  7일 연속 달성
                </div>
                <button type="button" className="y-modal-close" onClick={() => setRewardOpen(false)} aria-label="닫기">
                  ×
                </button>
              </div>
              <div className="y-modal-scroll y-att-reward-scroll">
                {reward && (
                  <>
                    <p className="y-att-reward-modal-lead">{reward.title}</p>
                    <p className="y-att-reward-modal-body">{reward.body}</p>
                    <div className="y-att-reward-next">
                      <span className="y-att-reward-next-label">다음 사이클 보상</span>
                      <p className="y-att-reward-next-text">{data.nextCyclePreviewLine}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </YeonunSheetPortal>
      ) : null}
    </div>
  );
}
