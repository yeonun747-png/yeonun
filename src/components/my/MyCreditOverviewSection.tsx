"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { MySummaryPayload } from "@/app/api/my/summary/route";
import { readAuthStubLoggedIn, YEONUN_AUTH_STUB_EVENT } from "@/lib/auth-stub";
import {
  LS_VOICE_BALANCE_SEC,
  LS_VOICE_FREE_REMAINING_SEC,
  readVoiceBalanceSecClient,
  readVoiceFreeRemainingSecClient,
  voiceMinutesFloor,
  YEONUN_VOICE_BALANCE_UPDATE_EVENT,
} from "@/lib/voice-balance-local";
import { supabaseBrowser } from "@/lib/supabase/client";

/** 10분 3,900원 패키지 → `PaymentModal`. 첫 충전 시만 쿼리에 보너스 플래그 포함(배너·전폭 버튼 동일). */
function voiceCreditPaymentHref(firstChargeBonus: boolean): string {
  let q =
    "modal=payment&product=voice-credit-10m&title=" +
    encodeURIComponent("음성상담 10분 충전") +
    "&price=3900&character_key=yeon&profile=single&minutes=10";
  if (firstChargeBonus) q += "&first_voice_credit_bonus=1";
  return `/my?${q}`;
}

export function MyCreditOverviewSection() {
  const [guest, setGuest] = useState(true);
  const [balanceTick, setBalanceTick] = useState(0);
  const [summary, setSummary] = useState<MySummaryPayload | null>(null);

  const refreshLocalVoice = useCallback(() => setBalanceTick((t) => t + 1), []);

  const fetchSummary = useCallback(async () => {
    const stub = readAuthStubLoggedIn();
    const sb = supabaseBrowser();
    const session = sb ? (await sb.auth.getSession()).data.session : null;
    const loggedIn = Boolean(session?.access_token) || stub;
    setGuest(!loggedIn);
    if (!loggedIn) return;
    if (!session?.access_token) {
      setSummary(null);
      return;
    }
    try {
      const res = await fetch("/api/my/summary", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const j = (await res.json()) as MySummaryPayload | { ok: false };
      if ("ok" in j && j.ok === true) setSummary(j);
      else setSummary(null);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    const onStub = () => void fetchSummary();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_VOICE_BALANCE_SEC || e.key === LS_VOICE_FREE_REMAINING_SEC) refreshLocalVoice();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchSummary();
    };
    window.addEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", fetchSummary);
    const onVoiceBump = () => refreshLocalVoice();
    window.addEventListener(YEONUN_VOICE_BALANCE_UPDATE_EVENT, onVoiceBump);
    return () => {
      window.removeEventListener(YEONUN_AUTH_STUB_EVENT, onStub);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", fetchSummary);
      window.removeEventListener(YEONUN_VOICE_BALANCE_UPDATE_EVENT, onVoiceBump);
    };
  }, [fetchSummary, refreshLocalVoice]);

  const voiceSec = useMemo(() => {
    void balanceTick;
    return readVoiceBalanceSecClient();
  }, [balanceTick]);

  const freeSec = useMemo(() => {
    void balanceTick;
    return readVoiceFreeRemainingSecClient();
  }, [balanceTick]);

  const voiceMin = voiceMinutesFloor(voiceSec);
  const freeMin = voiceMinutesFloor(freeSec);

  const consultationCount = summary?.consultationCount ?? 0;
  const archiveCount = summary?.archiveCount ?? 0;
  const showFirstChargeHint = summary ? !summary.hasCreditPurchaseHistory : true;

  if (guest) {
    return (
      <section className="y-my-credit-guest-panel" aria-label="음성 크레딧 안내">
        <div className="y-my-credit-login-card">
          <p className="y-my-credit-login-title">음성 상담 크레딧 · 통계</p>
          <p className="y-my-credit-login-desc">로그인 후 잔여 시간과 상담 기록을 확인할 수 있어요.</p>
          <Link className="y-my-credit-login-btn" href="/my?modal=auth">
            로그인
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="y-my-credit-block" aria-label="음성 크레딧">
        <Link
          className="y-vip-card y-vip-card--link"
          href={voiceCreditPaymentHref(showFirstChargeHint)}
          scroll={false}
          aria-label="크레딧 충전 결제 열기"
        >
          <div className="y-vip-eyebrow">CREDIT · 음성 잔액</div>
          <div className="y-vip-title">음성상담 잔여 시간 {voiceMin}분</div>
          <div className="y-vip-desc">10분 3,900원부터. 충전 후 365일간 유효합니다.</div>
          <span className="y-vip-arrow" aria-hidden>
            ›
          </span>
        </Link>
        {showFirstChargeHint ? (
          <div className="y-my-credit-charge-row">
            <Link
              href={voiceCreditPaymentHref(true)}
              scroll={false}
              className="y-my-credit-charge-fullbtn"
              aria-label="음성 상담 첫 충전 한정 10% 더 적립, 음성 크레딧 충전하기"
            >
              <span className="y-my-credit-fullbtn-text">
                음성 상담 첫 충전 한정 · 10% 더 적립
              </span>
              <span className="y-my-credit-fullbtn-sep" aria-hidden>
                |
              </span>
              <span className="y-my-credit-fullbtn-cta">음성 크레딧 충전하기</span>
            </Link>
          </div>
        ) : null}
      </section>

      <div className="y-my-stats" aria-label="통계">
        <div className="y-my-stat">
          <div className="y-my-stat-num">{consultationCount}</div>
          <div className="y-my-stat-label">상담 횟수</div>
        </div>
        <div className="y-my-stat">
          <div className="y-my-stat-num">{archiveCount}</div>
          <div className="y-my-stat-label">보관함</div>
        </div>
        <div className="y-my-stat">
          <div className="y-my-stat-num">
            {freeMin}
            <span className="y-my-stat-unit">분</span>
          </div>
          <div className="y-my-stat-label">무료 잔여</div>
        </div>
      </div>
    </>
  );
}
