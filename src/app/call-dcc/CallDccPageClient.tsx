"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { appendKstToManseContext } from "@/lib/datetime/kst";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";
import { extractRealtimeFunctionCallsFromResponseDone } from "@/lib/openai-realtime-function-calls";
import { extractRealtimeResponseUsage } from "@/lib/voice-realtime-response-usage";
import { recordMeetConsultCharacterForM07 } from "@/lib/daily-missions";
import { tryPersistMissionM07CompleteIfEligible } from "@/lib/mission-reconcile";
import { spendCreditsWithAuth } from "@/lib/credit-client";
import { YEONUN_CREDIT_UPDATE_EVENT, readWallet, ensureConsultTrialCreditsIfEligible } from "@/lib/credit-balance-local";
import {
  CREDIT_VOICE_MIN_TO_START,
  hasVoiceConsultCredits,
  voiceConsultCreditsShortfall,
} from "@/lib/voice-consult-credit-gate";
import {
  CREDIT_FREE_TRIAL_GRANT,
  CREDIT_VOICE_PER_MINUTE,
  CREDIT_VOICE_PER_SECOND,
} from "@/lib/credit-policy";
import { clearVoiceManseMeta, readVoiceManseMeta } from "@/lib/voice-dcc-manse-meta";
import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { resolveVoiceUserRef } from "@/lib/voice-user-ref";
import { YEONUN_AUTH_SESSION_CHANGED } from "@/lib/auth-session-events";
import { rollMaxAssistantResponses, rollWallMs } from "@/lib/voice-roll-triggers";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DEFAULT_FREE_TRIAL_SEC } from "@/lib/voice-balance-local";

type CharacterKey = "yeon" | "byeol" | "yeo" | "un";
type CharacterMeta = { key: CharacterKey; name: string; han: string; spec: string };

const CHARACTER_META: Record<CharacterKey, CharacterMeta> = {
  yeon: { key: "yeon", name: "연화", han: "蓮", spec: "재회 · 연애 · 궁합" },
  byeol: { key: "byeol", name: "별하", han: "星", spec: "자미두수 · 신년운세" },
  yeo: { key: "yeo", name: "여연", han: "麗", spec: "정통 사주 · 평생운" },
  un: { key: "un", name: "운서", han: "雲", spec: "작명 · 택일 · 꿈해몽" },
};

function asCharacterKey(v: string | null): CharacterKey {
  const t = String(v ?? "").trim();
  if (t === "byeol" || t === "yeo" || t === "un") return t;
  return "yeon";
}

const MOBILE_STT_WAVE_ACTIVATE_MIN = 0.06;

/** 원격 TTS 스피커 출력 tail (response.done 과 로컬 재생 어긋남 보정) */
const REMOTE_TTS_TAIL_ON = 0.014;
const REMOTE_TTS_TAIL_OFF = 0.005;

/** 마이크·캐릭터(TTS) 원격 오디오 미터 동일 스케일 */
function waveMeterLevelFromPeakRms(peak: number, rms: number): number {
  const combined = peak * 1.85 + rms * 6.5;
  const attenuated = combined * 0.38;
  return Math.max(0, Math.min(1, Math.pow(attenuated, 0.78)));
}

/** 종료·이탈 후 보관함 부제목(Haiku) — 페이지 이탈해도 요청 유지 */
function queueVoiceArchiveSubtitle(sessionId: string) {
  const sid = String(sessionId ?? "").trim();
  if (!sid || typeof window === "undefined") return;
  try {
    void fetch(`/api/voice/sessions/${encodeURIComponent(sid)}/archive-subtitle`, {
      method: "POST",
      keepalive: true,
    })
      .then((r) => r.json().catch(() => ({})))
      .then((j: { ok?: boolean; subtitle?: string | null }) => {
        const subtitle = String(j?.subtitle ?? "").trim();
        if (!j?.ok || !subtitle) return;
        window.dispatchEvent(
          new CustomEvent("yeonun:voice-archive-subtitle", {
            detail: { sessionId: sid, subtitle },
          }),
        );
      })
      .catch(() => {
        // ignore
      });
  } catch {
    // ignore
  }
}

function formatMmSs(totalSec: number): string {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 크레딧 미터용 스냅샷(통화 시작 시점 지갑) */
type WalletSnap = { free: number; paid: number; freeExpiresAtMs: number };

function buildVoiceCreditLines(): { line1: string; line2: string } {
  const wallet = readWallet();
  const now = Date.now();
  const freeExpired = wallet.freeExpiresAtMs < now;
  const freeRem = freeExpired ? 0 : Math.max(0, wallet.free);
  let line1: string;
  if (!freeExpired && freeRem > CREDIT_FREE_TRIAL_GRANT) {
    line1 = `무료·보너스 크레딧 ${freeRem.toLocaleString("ko-KR")} 잔여`;
  } else if (!freeExpired && freeRem > 0) {
    line1 = `무료 크레딧 ${freeRem.toLocaleString("ko-KR")} 잔여`;
  } else if (wallet.paid > 0) {
    line1 = `충전 크레딧 ${wallet.paid.toLocaleString("ko-KR")} 잔여`;
  } else {
    line1 = `잔여 ${(wallet.free + wallet.paid).toLocaleString("ko-KR")} 크레딧`;
  }
  return { line1, line2: `이후 분당 ${CREDIT_VOICE_PER_MINUTE.toLocaleString("ko-KR")} 크레딧` };
}

/** 통화 중 — 통화 시작 시점 스냅샷 + 경과 초 기준 (비회원도 로컬 지갑 차감과 동일하게 누적 표시) */
function buildVoiceMeterSessionLines(opts: {
  meterElapsedWallSec: number;
  snapshot: WalletSnap;
}): { line1: string; line2: string } {
  const sessionCreditsRaw = Math.max(0, Math.floor(opts.meterElapsedWallSec * CREDIT_VOICE_PER_SECOND));

  const now = Date.now();
  const snapFreeExpired = opts.snapshot.freeExpiresAtMs < now;
  const snapFreeRem = snapFreeExpired ? 0 : Math.max(0, opts.snapshot.free);
  const snapPaidRem = Math.max(0, opts.snapshot.paid);
  const snapTotal = snapFreeRem + snapPaidRem;

  const owedDisplay = Math.min(sessionCreditsRaw, snapTotal);
  const takeFree = Math.min(snapFreeRem, owedDisplay);
  const takePaid = owedDisplay - takeFree;
  const freeRemNow = Math.max(0, snapFreeRem - takeFree);
  const paidRemNow = Math.max(0, snapPaidRem - takePaid);

  const line2 = `이후 분당 ${CREDIT_VOICE_PER_MINUTE.toLocaleString("ko-KR")} 크레딧`;

  /** 무료 버킷 소진 중 — 잔여가 통화 시간에 따라 줄어듦(무료 먼저 차감) */
  if (!snapFreeExpired && snapFreeRem > CREDIT_FREE_TRIAL_GRANT && freeRemNow > 0) {
    return {
      line1: `무료·보너스 크레딧 ${freeRemNow.toLocaleString("ko-KR")} 잔여`,
      line2,
    };
  }

  if (!snapFreeExpired && (snapFreeRem > 0 || takeFree > 0 || sessionCreditsRaw === 0)) {
    if (freeRemNow > 0 || sessionCreditsRaw === 0) {
      return {
        line1: `무료 크레딧 ${freeRemNow.toLocaleString("ko-KR")} 잔여`,
        line2,
      };
    }
  }

  if (snapPaidRem > 0) {
    return {
      line1: `충전 크레딧 ${paidRemNow.toLocaleString("ko-KR")} 잔여`,
      line2,
    };
  }

  return {
    line1: `이번 통화 약 ${owedDisplay.toLocaleString("ko-KR")} 크레딧`,
    line2: `분당 ${CREDIT_VOICE_PER_MINUTE.toLocaleString("ko-KR")} 크레딧`,
  };
}

function extractAssistantFromResponseDone(ev: unknown): string {
  if (!ev || typeof ev !== "object") return "";
  const root = ev as Record<string, unknown>;
  try {
    const response = root.response;
    if (!response || typeof response !== "object") return "";
    const resp = response as Record<string, unknown>;
    const out = resp.output;
    if (Array.isArray(out)) {
      const parts: string[] = [];
      for (const item of out) {
        if (!item || typeof item !== "object") continue;
        const content = (item as Record<string, unknown>).content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (!c || typeof c !== "object") continue;
            const o = c as Record<string, unknown>;
            if (typeof o.text === "string") parts.push(o.text);
            if (typeof o.transcript === "string") parts.push(o.transcript);
          }
        }
      }
      const joined = parts.join(" ").trim();
      if (joined) return joined;
    }
  } catch {
    // ignore
  }
  const response = root.response;
  if (!response || typeof response !== "object") return "";
  const t = (response as Record<string, unknown>).output_text;
  return typeof t === "string" ? t.trim() : "";
}

export default function CallDccPageClient() {
  const { user } = useYeonunAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const characterKey = asCharacterKey(sp.get("character_key"));
  const meta = CHARACTER_META[characterKey];
  const voiceOverride = String(sp.get("voice_external_id") ?? "").trim();
  const fromFortuneNav = sp.get("from_fortune") === "1";

  const [status, setStatus] = useState<string>("준비 중");
  const [lastUserText, setLastUserText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fetchedVoiceExternalId, setFetchedVoiceExternalId] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [ttsLevel, setTtsLevel] = useState(0);
  /** 서버 턴(ref) 또는 로컬 스피커 출력(원격 트랙 레벨) — 파형·상태·STT 강조 동기화 */
  const [ttsOutputActive, setTtsOutputActive] = useState(false);
  const [uiError, setUiError] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [activeLine, setActiveLine] = useState<"tts" | "stt">("tts");
  const [rtcReady, setRtcReady] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** 크레딧 미터: 세션 시작 벽시계 기준 경과(롤로 표시 타이머가 리셋돼도 유지) */
  const [meterElapsedWallSec, setMeterElapsedWallSec] = useState(0);
  /** 음성 세션 생성 후 미터 앵커·과금 플래그 확정 시 인터벌 재시작용 */
  const [meterAnchorBump, setMeterAnchorBump] = useState(0);
  /** 지갑 변경 시 통화 외 미터 문구 갱신 */
  const [creditRev, setCreditRev] = useState(0);
  const [speakerMuted, setSpeakerMuted] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const sessionStartMsRef = useRef(0);
  const endPostedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mutedRef = useRef(muted);
  const speakerMutedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const openingSentRef = useRef(false);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  /** 서버 이벤트 기준(응답 생성 구간). 로컬 재생과 어긋날 수 있음 → ttsOutputActive는 별도 합성 */
  const ttsPlayingRef = useRef(false);
  /** 원격 RTP 오디오 레벨로 "아직 스피커에 소리가 남았는지" (response.done 이후 tail) */
  const ttsRemoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const ttsRemoteFloatBufRef = useRef<Float32Array | null>(null);
  const remoteTailAudibleRef = useRef(false);
  const ttsOutputUiLastRef = useRef(false);
  const disconnectRemoteTtsTapRef = useRef<(() => void) | null>(null);
  /** tickMeter 마지막에 갱신 — DC 핸들러에서 STT 라인 스틸 방지 */
  const ttsUiGateRef = useRef(false);
  const micFloatBufRef = useRef<Float32Array | null>(null);
  /** item_id → 누적 delta (completed 시 비움) */
  const userSttPartialByItemRef = useRef<Record<string, string>>({});
  const resumeAfterRollRef = useRef(false);
  const rollBusyRef = useRef(false);
  const assistantResponseDoneCountRef = useRef(0);
  /** compress-roll / roll-status / realtime-usage — 세션 생성·롤·client-secret에서 채움 */
  const rollSecretRef = useRef("");
  const responseCreatedAtRef = useRef<number | null>(null);
  /** response.done usage — 누적/스냅샷 혼용 대비해 직전 값 대비 델타만 서버에 보냄 */
  const lastUsageSnapshotRef = useRef({ in: 0, out: 0, tot: 0 });
  /** 비회원 무료 3분 경과 시 한 번만 종료 */
  const guestCapDoneRef = useRef(false);
  /** 통화 중 크레딧 소진 시 한 번만 종료(회원) */
  const creditCapDoneRef = useRef(false);
  /** 세션 시작 시 비회원 무료 통화 여부 — 종료 시 크레딧 미차감 */
  const guestFreeCallRef = useRef(false);
  /** 세션 롤 등으로 상담 표시 시간이 리셋돼도, 무료 한도·크레딧 미터는 첫 통화 시작 시점부터 누적 */
  const voiceMeterWallStartMsRef = useRef<number | null>(null);
  /** 통화 시작 시점 로컬 지갑(회원 과금·표시 상한) */
  const billingWalletSnapshotRef = useRef<WalletSnap | null>(null);

  const voiceExternalId = voiceOverride || fetchedVoiceExternalId || null;

  const [guestCapActive, setGuestCapActive] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [creditGateReady, setCreditGateReady] = useState(false);
  const [creditBlocked, setCreditBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const sb = supabaseBrowser();
      if (!sb) {
        if (!cancelled) {
          setGuestCapActive(true);
          setAuthReady(true);
        }
        return;
      }
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (!cancelled) {
        setGuestCapActive(!session?.access_token);
        setAuthReady(true);
      }
    };
    void sync();
    const onAuth = () => void sync();
    window.addEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener(YEONUN_AUTH_SESSION_CHANGED, onAuth);
    };
  }, []);

  useLayoutEffect(() => {
    if (!authReady) return;
    if (guestCapActive) {
      setCreditBlocked(false);
      setCreditGateReady(true);
      return;
    }
    ensureConsultTrialCreditsIfEligible();
    setCreditBlocked(!hasVoiceConsultCredits());
    setCreditGateReady(true);
  }, [authReady, guestCapActive]);

  useEffect(() => {
    if (!authReady || guestCapActive) return;
    const onCredit = () => setCreditBlocked(!hasVoiceConsultCredits());
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, onCredit);
  }, [authReady, guestCapActive]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    if (!sessionId) return;
    const tick = () => {
      const start = sessionStartMsRef.current;
      if (!start) return;
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setMeterElapsedWallSec(0);
      return;
    }
    if (voiceMeterWallStartMsRef.current == null) return;
    const tick = () => {
      const t = voiceMeterWallStartMsRef.current;
      if (!t) return;
      setMeterElapsedWallSec(Math.max(0, Math.floor((Date.now() - t) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sessionId, meterAnchorBump]);

  useEffect(() => {
    const on = () => setCreditRev((n) => n + 1);
    window.addEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
    return () => window.removeEventListener(YEONUN_CREDIT_UPDATE_EVENT, on);
  }, []);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
    const el = remoteAudioRef.current;
    if (el) el.muted = speakerMuted;
  }, [speakerMuted]);

  useEffect(() => {
    const tr = micStreamRef.current?.getAudioTracks?.()[0];
    if (tr) tr.enabled = !muted;
  }, [muted]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
    lastUsageSnapshotRef.current = { in: 0, out: 0, tot: 0 };
  }, [sessionId]);

  useLayoutEffect(() => {
    if (!fromFortuneNav) {
      clearVoiceManseMeta();
    }
  }, [fromFortuneNav]);

  const creditLine = useMemo(() => {
    if (
      !sessionId ||
      voiceMeterWallStartMsRef.current == null ||
      billingWalletSnapshotRef.current == null
    ) {
      return buildVoiceCreditLines();
    }
    return buildVoiceMeterSessionLines({
      meterElapsedWallSec,
      snapshot: billingWalletSnapshotRef.current,
    });
  }, [sessionId, meterElapsedWallSec, creditRev]);

  const finalizeVoiceSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id || endPostedRef.current) return;
    endPostedRef.current = true;
    const wallMs = voiceMeterWallStartMsRef.current;
    const started = sessionStartMsRef.current;
    const wallDurationSec = wallMs
      ? Math.max(0, Math.round((Date.now() - wallMs) / 1000))
      : started
        ? Math.max(0, Math.round((Date.now() - started) / 1000))
        : 0;

    const owedCredits = Math.floor(wallDurationSec * CREDIT_VOICE_PER_SECOND);

    try {
      if (typeof window !== "undefined") {
        try {
          const FIRST = "yeonun_first_voice_completed_v1";
          if (!localStorage.getItem(FIRST)) {
            localStorage.setItem(FIRST, "1");
            window.dispatchEvent(new Event("yeonun:first-voice-session-ended"));
          }
          recordMeetConsultCharacterForM07(characterKey);
          tryPersistMissionM07CompleteIfEligible();
        } catch {
          // ignore
        }
      }
      await fetch(`/api/voice/sessions/${id}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_sec: wallDurationSec, cost_krw: 0 }),
      });
    } catch {
      // ignore
    } finally {
      queueVoiceArchiveSubtitle(id);
      /** 비회원 3분 무료 통화는 크레딧 미차감 · 회원만 차감 */
      if (typeof window !== "undefined" && owedCredits > 0 && !guestFreeCallRef.current) {
        await spendCreditsWithAuth(owedCredits, {
          kind: "spend_voice",
          ref_type: "voice_session",
          ref_id: id,
          memo: `음성 통화 ${wallDurationSec}초`,
        });
      }
    }
    clearVoiceManseMeta();
  }, [characterKey]);

  useEffect(() => {
    return () => {
      void finalizeVoiceSession();
    };
  }, [finalizeVoiceSession]);

  /** 비회원: 무료 3분 경과 시 통화 종료 후 로그인 유도 */
  useEffect(() => {
    if (!guestCapActive || !sessionId || voiceMeterWallStartMsRef.current == null) return;
    const wallElapsedSec = Math.floor((Date.now() - voiceMeterWallStartMsRef.current) / 1000);
    if (wallElapsedSec < DEFAULT_FREE_TRIAL_SEC) return;
    if (guestCapDoneRef.current) return;
    guestCapDoneRef.current = true;
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    setStatus("종료");
    setUiError("비회원 무료 시간(3분)이 끝났습니다. 이어서 이용하려면 로그인해 주세요.");
    void (async () => {
      await finalizeVoiceSession();
      router.replace(
        `/meet?modal=auth&after_auth=${encodeURIComponent(`call:${characterKey}`)}`,
      );
    })();
  }, [guestCapActive, sessionId, meterElapsedWallSec, finalizeVoiceSession, router, characterKey]);

  /** 회원: 통화 중 크레딧 소진 시 종료(채팅과 동일) */
  useEffect(() => {
    if (guestCapActive || creditBlocked || !sessionId || voiceMeterWallStartMsRef.current == null) return;
    const snap = billingWalletSnapshotRef.current;
    if (!snap) return;
    const now = Date.now();
    const snapFreeRem = snap.freeExpiresAtMs < now ? 0 : Math.max(0, snap.free);
    const snapPaidRem = Math.max(0, snap.paid);
    const snapTotal = snapFreeRem + snapPaidRem;
    if (snapTotal <= 0) return;
    const owed = Math.floor(meterElapsedWallSec * CREDIT_VOICE_PER_SECOND);
    if (owed < snapTotal) return;
    if (creditCapDoneRef.current) return;
    creditCapDoneRef.current = true;
    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    setStatus("종료");
    setUiError("크레딧이 부족해요. 충전 후 이어서 이용해 주세요.");
    void (async () => {
      await finalizeVoiceSession();
      router.push("/checkout/credit");
    })();
  }, [guestCapActive, creditBlocked, sessionId, meterElapsedWallSec, finalizeVoiceSession, router]);

  const ensureAudioRunning = async (ctx: AudioContext) => {
    try {
      await ctx.resume?.();
    } catch {
      // ignore
    }
    if (ctx.state === "running") return;
    setStatus("화면을 한 번 탭해 시작해 주세요");
    await new Promise<void>((resolve) => {
      const on = async () => {
        window.removeEventListener("pointerdown", on);
        window.removeEventListener("keydown", on);
        try {
          await ctx.resume?.();
        } catch {
          // ignore
        }
        resolve();
      };
      window.addEventListener("pointerdown", on, { once: true });
      window.addEventListener("keydown", on, { once: true });
    });
  };

  function buildManseContext(): string {
    const vm = readVoiceManseMeta();
    if (vm?.productSlug) {
      return buildFortuneManseContext({ profile: vm.profile, productSlug: vm.productSlug });
    }
    try {
      const raw = localStorage.getItem("yeonun_saju_v1");
      if (!raw) return appendKstToManseContext("");
      const j = JSON.parse(raw) as {
        calendarType?: string;
        year?: string | number;
        month?: string | number;
        day?: string | number;
        hour?: string | number | null;
        minute?: string | number | null;
        name?: string;
      };
      const cal =
        j.calendarType === "lunar-leap" ? "음력(윤)" : j.calendarType === "lunar" ? "음력" : "양력";
      const y = String(j.year || "").trim();
      const mo = String(j.month || "").trim();
      const d = String(j.day || "").trim();
      const ho = j.hour != null && String(j.hour).trim() !== "" ? String(j.hour).trim() : "";
      const mi = j.minute != null && String(j.minute).trim() !== "" ? String(j.minute).trim() : "";
      const birthLines = [
        `[사용자 출생 입력]`,
        j.name ? `- 이름(기록용): ${String(j.name).trim()}` : null,
        `- 달력: ${cal}`,
        y && mo && d ? `- 생년월일: ${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : null,
        ho !== "" ? `- 출생 시각: ${ho}시 ${mi !== "" ? `${mi}분` : "(분 미입력)"}` : `- 출생 시각: 미입력(시주는 일간 기준 규칙에 따름)`,
      ]
        .filter(Boolean)
        .join("\n");
      const r = computeManseFromFormInput({
        userYear: y,
        userMonth: mo,
        userDay: d,
        userBirthHour: ho !== "" ? ho : null,
        userBirthMinute: mi !== "" ? mi : null,
        userCalendarType: j.calendarType === "lunar-leap" ? "lunar-leap" : j.calendarType === "lunar" ? "lunar" : "solar",
        userName: String(j.name || ""),
      });
      if (!r) return appendKstToManseContext(birthLines);
      const m = r.manse;
      type Pillar = {
        gan: string;
        ji: string;
        sibsung: string;
        jiSibsung: string;
        ohang: string;
        eumyang: string;
        sibiunsung: string;
        sibisinsal: string;
      };
      const one = (p: Pillar) =>
        `${p.gan}${p.ji} · 십성 ${p.sibsung}/${p.jiSibsung} · 오행 ${p.ohang} · 음양 ${p.eumyang} · 운성 ${p.sibiunsung} · 신살 ${p.sibisinsal}`;
      const lines = [`연주: ${one(m.year)}`, `월주: ${one(m.month)}`, `일주: ${one(m.day)}`, `시주: ${one(m.hour)}`].join("\n");
      return appendKstToManseContext(`${birthLines}\n\n[만세력 사주 명식]\n${lines}`);
    } catch {
      return appendKstToManseContext("");
    }
  }

  const appendTurn = useCallback(async (role: "user" | "assistant", text: string) => {
    const sid = sessionIdRef.current;
    const t = String(text ?? "").trim();
    if (!sid || !t) return;
    try {
      await fetch(`/api/voice/sessions/${sid}/append-turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text: t.slice(0, 12000) }),
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (voiceOverride || !creditGateReady || (!guestCapActive && creditBlocked)) {
      return () => {
        cancelled = true;
      };
    }
    let summaryForSession: string | null = null;
    try {
      const raw = sessionStorage.getItem("yeonun_fortune_voice_brief");
      if (raw) {
        const j = JSON.parse(raw) as { summary?: string };
        const s = typeof j.summary === "string" ? j.summary.trim() : "";
        if (s) {
          summaryForSession = `[방금 본 점사 요약]\n${s}\n\n${meta.name} DCC 음성상담 시작`;
        }
        sessionStorage.removeItem("yeonun_fortune_voice_brief");
      }
    } catch {
      // ignore
    }
    fetch("/api/voice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character_key: characterKey,
        user_ref: resolveVoiceUserRef(user?.id),
        ...(summaryForSession ? { summary: summaryForSession } : {}),
      }),
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (typeof data?.session?.id === "string" && data.session.id.trim()) {
          const sid = data.session.id.trim();
          sessionStartMsRef.current = Date.now();
          endPostedRef.current = false;
          sessionIdRef.current = sid;
          setElapsedSec(0);
          guestFreeCallRef.current = guestCapActive;
          if (!guestCapActive) {
            ensureConsultTrialCreditsIfEligible();
          }
          voiceMeterWallStartMsRef.current = Date.now();
          const w = readWallet();
          billingWalletSnapshotRef.current = {
            free: w.free,
            paid: w.paid,
            freeExpiresAtMs: w.freeExpiresAtMs,
          };
          if (cancelled) return;
          setMeterAnchorBump((x) => x + 1);
          setSessionId(sid);
          const rs = (data.session as { roll_secret?: string }).roll_secret;
          if (typeof rs === "string" && rs.trim()) rollSecretRef.current = rs.trim();
        }
        const tv = data?.prompt_context?.tts_voice ?? data?.prompt_context?.cartesia_voice;
        const ext = typeof tv?.external_id === "string" ? tv.external_id.trim() : "";
        if (ext) {
          setFetchedVoiceExternalId(ext);
          setUiError("");
        } else {
          setUiError("Realtime 보이스가 설정되지 않았어요. 어드민에서 OpenAI 보이스 10종 DB 반영 후 캐릭터 음성 프롬프트를 연결해 주세요.");
        }
      })
      .catch((e) => {
        setUiError(`voice session 실패: ${String(e?.message || e)}`);
      });
    return () => {
      cancelled = true;
    };
  }, [characterKey, meta.name, voiceOverride, user?.id, creditGateReady, creditBlocked, guestCapActive]);

  useEffect(() => {
    if (!sessionId || !voiceExternalId) return;
    let cancelled = false;
    openingSentRef.current = false;
    remoteTailAudibleRef.current = false;
    ttsUiGateRef.current = false;
    ttsOutputUiLastRef.current = false;
    assistantResponseDoneCountRef.current = 0;
    setTtsOutputActive(false);

    const tickMeter = () => {
      if (cancelled) return;
      const a = micAnalyserRef.current;
      if (a) {
        let buf = micFloatBufRef.current;
        if (!buf || buf.length !== a.fftSize) {
          buf = new Float32Array(a.fftSize);
          micFloatBufRef.current = buf;
        }
        // TS 5.8+ lib: Float32Array<ArrayBufferLike> vs WebIDL ArrayBuffer — 런타임은 동일 버퍼
        // @ts-expect-error AnalyserNode.getFloatTimeDomainData buffer typing mismatch
        a.getFloatTimeDomainData(buf);
        let peak = 0;
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) {
          const s = buf[i];
          const abs = Math.abs(s);
          if (abs > peak) peak = abs;
          sumSq += s * s;
        }
        const rms = Math.sqrt(sumSq / buf.length);
        setMicLevel(waveMeterLevelFromPeakRms(peak, rms));
      }

      let remoteTts = 0;
      const ra = ttsRemoteAnalyserRef.current;
      if (ra) {
        let rbuf = ttsRemoteFloatBufRef.current;
        if (!rbuf || rbuf.length !== ra.fftSize) {
          rbuf = new Float32Array(ra.fftSize);
          ttsRemoteFloatBufRef.current = rbuf;
        }
        // @ts-expect-error AnalyserNode.getFloatTimeDomainData buffer typing mismatch
        ra.getFloatTimeDomainData(rbuf);
        let rpeak = 0;
        let rsumSq = 0;
        for (let i = 0; i < rbuf.length; i++) {
          const s = rbuf[i];
          const abs = Math.abs(s);
          if (abs > rpeak) rpeak = abs;
          rsumSq += s * s;
        }
        const rrms = Math.sqrt(rsumSq / rbuf.length);
        remoteTts = waveMeterLevelFromPeakRms(rpeak, rrms);
      }

      let tail = remoteTailAudibleRef.current;
      if (remoteTts >= REMOTE_TTS_TAIL_ON) tail = true;
      else if (remoteTts <= REMOTE_TTS_TAIL_OFF) tail = false;
      remoteTailAudibleRef.current = tail;

      const gate = ttsPlayingRef.current || tail;
      ttsUiGateRef.current = gate;
      if (gate !== ttsOutputUiLastRef.current) {
        ttsOutputUiLastRef.current = gate;
        setTtsOutputActive(gate);
      }

      const fakeTts = ttsPlayingRef.current ? 0.35 + Math.sin(Date.now() / 210) * 0.12 : 0;
      const ttsBar = remoteTts > 0.003 ? Math.min(1, Math.max(remoteTts, fakeTts * 0.35)) : fakeTts;
      setTtsLevel(ttsBar);

      rafRef.current = requestAnimationFrame(tickMeter);
    };

    const run = async () => {
      try {
        setStatus("연결 중…");

        const secretPayload = {
          character_key: characterKey,
          session_id: sessionId,
          manse_context: buildManseContext(),
        };
        const secretResultPromise = fetch("/api/voice/openai-realtime/client-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(secretPayload),
        }).then(async (res) => ({
          ok: res.ok,
          json: (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            value?: string;
            error?: string;
            details?: string;
          },
        }));

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;

        const Ctx =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) throw new Error("AudioContext 미지원");
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        await ensureAudioRunning(ctx);

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.36;
        const sink = ctx.createGain();
        sink.gain.value = 0;
        src.connect(analyser);
        analyser.connect(sink);
        sink.connect(ctx.destination);
        micAnalyserRef.current = analyser;
        rafRef.current = requestAnimationFrame(tickMeter);

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) throw new Error("마이크 트랙 없음");
        audioTrack.enabled = !mutedRef.current;

        const { ok: secretOk, json: secretJson } = await secretResultPromise;
        if (!secretOk || !secretJson.ok || !secretJson.value) {
          throw new Error(secretJson.details || secretJson.error || "Realtime 토큰 발급 실패");
        }
        const rs = (secretJson as { roll_secret?: string }).roll_secret;
        if (typeof rs === "string" && rs.trim()) rollSecretRef.current = rs.trim();
        const EPHEMERAL_KEY = String(secretJson.value);

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        const remoteAudio = document.createElement("audio");
        remoteAudio.autoplay = true;
        remoteAudio.setAttribute("playsinline", "true");
        remoteAudio.style.display = "none";
        document.body.appendChild(remoteAudio);
        remoteAudioRef.current = remoteAudio;
        pc.ontrack = (e) => {
          const [ms] = e.streams;
          remoteAudio.srcObject = ms;
          remoteAudio.muted = speakerMutedRef.current;
          void remoteAudio.play().catch(() => {});

          const ctxTap = audioCtxRef.current;
          if (!ctxTap || !ms.getAudioTracks().length) return;
          try {
            disconnectRemoteTtsTapRef.current?.();
            disconnectRemoteTtsTapRef.current = null;
            const src = ctxTap.createMediaStreamSource(ms);
            const an = ctxTap.createAnalyser();
            an.fftSize = 1024;
            an.smoothingTimeConstant = 0.42;
            const silent = ctxTap.createGain();
            silent.gain.value = 0;
            src.connect(an);
            an.connect(silent);
            silent.connect(ctxTap.destination);
            ttsRemoteAnalyserRef.current = an;
            disconnectRemoteTtsTapRef.current = () => {
              try {
                src.disconnect();
              } catch {
                // ignore
              }
              try {
                an.disconnect();
              } catch {
                // ignore
              }
              try {
                silent.disconnect();
              } catch {
                // ignore
              }
              ttsRemoteAnalyserRef.current = null;
            };
          } catch {
            // ignore
          }
        };

        pc.addTrack(audioTrack);

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;

        const flushSaveUserInsightCalls = async (fcs: ReturnType<typeof extractRealtimeFunctionCallsFromResponseDone>) => {
          const sid = sessionIdRef.current;
          if (!sid || !fcs.length) return;
          let handled = false;
          for (const fc of fcs) {
            if (fc.name !== "save_user_insight") continue;
            handled = true;
            let payload: { category?: string; detail?: string; importance_level?: number };
            try {
              payload = JSON.parse(fc.arguments || "{}") as typeof payload;
            } catch {
              const dcE = dcRef.current;
              if (dcE?.readyState === "open") {
                dcE.send(
                  JSON.stringify({
                    type: "conversation.item.create",
                    item: {
                      type: "function_call_output",
                      call_id: fc.call_id,
                      output: JSON.stringify({ ok: false, error: "invalid_json" }),
                    },
                  }),
                );
              }
              continue;
            }
            const res = await fetch(`/api/voice/sessions/${sid}/save-insight`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                category: payload.category,
                detail: payload.detail,
                importance_level: payload.importance_level,
              }),
            });
            const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
            const ok = res.ok && j.ok === true;
            const dcOut = dcRef.current;
            if (dcOut?.readyState === "open") {
              dcOut.send(
                JSON.stringify({
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: fc.call_id,
                    output: JSON.stringify(
                      ok ? { ok: true } : { ok: false, error: j.error || `http_${res.status}` },
                    ),
                  },
                }),
              );
            }
          }
          if (handled) {
            const dcResume = dcRef.current;
            if (dcResume?.readyState === "open") {
              dcResume.send(JSON.stringify({ type: "response.create", response: {} }));
            }
          }
        };

        const checkSessionRoll = async () => {
          if (rollBusyRef.current || cancelled) return;
          const sid = sessionIdRef.current;
          if (!sid) return;
          if (Date.now() - sessionStartMsRef.current < 12_000) return;
          let should = false;
          const elapsed = Date.now() - sessionStartMsRef.current;
          if (elapsed >= rollWallMs()) should = true;
          if (assistantResponseDoneCountRef.current >= rollMaxAssistantResponses()) should = true;
          if (!should && rollSecretRef.current) {
            try {
              const rs = await fetch(`/api/voice/sessions/${sid}/roll-status`, {
                headers: { "X-Voice-Roll-Secret": rollSecretRef.current },
              });
              const j = (await rs.json().catch(() => ({}))) as { should_roll?: boolean; ok?: boolean };
              if (rs.ok && j.should_roll === true) should = true;
            } catch {
              // ignore
            }
          }
          if (!should || cancelled) return;
          rollBusyRef.current = true;
          try {
            const r = await fetch(`/api/voice/sessions/${sid}/compress-roll`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(rollSecretRef.current ? { "X-Voice-Roll-Secret": rollSecretRef.current } : {}),
              },
              body: JSON.stringify({}),
            });
            const j = (await r.json().catch(() => ({}))) as {
              ok?: boolean;
              new_session_id?: string;
              roll_secret?: string;
            };
            if (cancelled || !r.ok || !j.ok || typeof j.new_session_id !== "string" || !j.new_session_id.trim()) {
              return;
            }
            const nrs = typeof j.roll_secret === "string" ? j.roll_secret.trim() : "";
            if (nrs) rollSecretRef.current = nrs;
            resumeAfterRollRef.current = true;
            sessionStartMsRef.current = Date.now();
            assistantResponseDoneCountRef.current = 0;
            setSessionId(j.new_session_id.trim());
          } finally {
            rollBusyRef.current = false;
          }
        };

        dc.addEventListener("open", () => {
          setRtcReady(true);
          setStatus("듣는 중");
          if (!openingSentRef.current) {
            openingSentRef.current = true;
            if (resumeAfterRollRef.current) {
              resumeAfterRollRef.current = false;
              return;
            }
            dc.send(JSON.stringify({ type: "response.create", response: {} }));
          }
        });

        dc.addEventListener("message", (ev) => {
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
          } catch {
            return;
          }
          const ty = String(msg.type ?? "");

          if (ty === "error" || ty === "response.error") {
            const errObj = msg.error;
            const errRec = errObj && typeof errObj === "object" ? (errObj as Record<string, unknown>) : null;
            const m = String(errRec?.message ?? msg.message ?? "Realtime 오류");
            setUiError(m.slice(0, 400));
          }

          if (ty === "response.created") {
            responseCreatedAtRef.current = Date.now();
          }

          if (ty === "response.created" || ty === "response.output_audio.started") {
            ttsPlayingRef.current = true;
            setActiveLine("tts");
          }

          if (ty === "response.done") {
            ttsPlayingRef.current = false;
            setStatus("듣는 중");
            const assistantText = extractAssistantFromResponseDone(msg);
            const fcs = extractRealtimeFunctionCallsFromResponseDone(msg);
            const usage = extractRealtimeResponseUsage(msg);
            const t0 = responseCreatedAtRef.current;
            responseCreatedAtRef.current = null;
            const latencyMs = t0 != null ? Math.max(0, Date.now() - t0) : 0;
            const prev = lastUsageSnapshotRef.current;
            let di = 0;
            let doo = 0;
            let dtot = 0;
            if (usage) {
              di = Math.max(0, usage.input_tokens - prev.in);
              doo = Math.max(0, usage.output_tokens - prev.out);
              dtot = Math.max(0, usage.total_tokens - prev.tot);
              if (dtot === 0 && (di > 0 || doo > 0)) dtot = di + doo;
              lastUsageSnapshotRef.current = {
                in: Math.max(prev.in, usage.input_tokens),
                out: Math.max(prev.out, usage.output_tokens),
                tot: Math.max(prev.tot, usage.total_tokens),
              };
            }
            void (async () => {
              if (assistantText) await appendTurn("assistant", assistantText);
              if (fcs.length) await flushSaveUserInsightCalls(fcs);
              assistantResponseDoneCountRef.current += 1;
              const sidU = sessionIdRef.current;
              const sec = rollSecretRef.current;
              if (sidU && sec && (di > 0 || doo > 0 || dtot > 0 || latencyMs > 0)) {
                try {
                  await fetch(`/api/voice/sessions/${sidU}/realtime-usage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-Voice-Roll-Secret": sec },
                    body: JSON.stringify({
                      input_tokens_delta: di,
                      output_tokens_delta: doo,
                      total_tokens_delta: dtot > 0 ? dtot : di + doo,
                      response_latency_ms: latencyMs,
                    }),
                  });
                } catch {
                  // ignore
                }
              }
              await checkSessionRoll();
            })();
          }

          if (ty === "conversation.item.input_audio_transcription.delta") {
            const id = String(msg.item_id ?? "_");
            const delta = String(msg.delta ?? "");
            if (delta) {
              userSttPartialByItemRef.current[id] = (userSttPartialByItemRef.current[id] ?? "") + delta;
              setLastUserText(userSttPartialByItemRef.current[id]);
              if (!ttsUiGateRef.current) setActiveLine("stt");
            }
          }

          if (ty === "conversation.item.input_audio_transcription.completed") {
            const id = String(msg.item_id ?? "");
            if (id) delete userSttPartialByItemRef.current[id];
            const ut = String(msg.transcript ?? "").trim();
            if (ut) {
              setLastUserText(ut);
              void appendTurn("user", ut);
            }
          }
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          body: offer.sdp ?? "",
          headers: {
            Authorization: `Bearer ${EPHEMERAL_KEY}`,
            "Content-Type": "application/sdp",
          },
        });
        const answerSdp = await sdpRes.text();
        if (!sdpRes.ok) {
          throw new Error(answerSdp.slice(0, 500));
        }
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      } catch (e: unknown) {
        const err = e instanceof Error ? e.message : String(e);
        if (!cancelled) setUiError(`Realtime 연결 실패: ${err}`);
        setStatus("오류");
      }
    };

    void run();

    return () => {
      cancelled = true;
      userSttPartialByItemRef.current = {};
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        dcRef.current?.close();
      } catch {
        // ignore
      }
      dcRef.current = null;
      try {
        pcRef.current?.getSenders().forEach((s) => {
          try {
            s.track?.stop();
          } catch {
            // ignore
          }
        });
        pcRef.current?.close();
      } catch {
        // ignore
      }
      pcRef.current = null;
      try {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      micStreamRef.current = null;
      try {
        const el = remoteAudioRef.current;
        if (el?.parentNode) el.parentNode.removeChild(el);
      } catch {
        // ignore
      }
      remoteAudioRef.current = null;
      ttsPlayingRef.current = false;
      remoteTailAudibleRef.current = false;
      ttsUiGateRef.current = false;
      ttsOutputUiLastRef.current = false;
      setTtsOutputActive(false);
      try {
        disconnectRemoteTtsTapRef.current?.();
      } catch {
        // ignore
      }
      disconnectRemoteTtsTapRef.current = null;
      try {
        micAnalyserRef.current?.disconnect();
      } catch {
        // ignore
      }
      micAnalyserRef.current = null;
      try {
        audioCtxRef.current?.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
      setRtcReady(false);
    };
  }, [sessionId, voiceExternalId, characterKey, appendTurn]);

  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  const showCreditShortage = creditGateReady && !guestCapActive && creditBlocked;
  const creditNeedMore = voiceConsultCreditsShortfall();
  const creditShortageCaption =
    creditNeedMore > 0
      ? `크레딧이 부족해요. ${creditNeedMore.toLocaleString("ko-KR")} 크레딧이 더 필요해요.`
      : `크레딧이 부족해요. 음성 상담을 시작하려면 최소 ${CREDIT_VOICE_MIN_TO_START.toLocaleString("ko-KR")} 크레딧이 필요해요.`;

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className={`y-call-root${showCreditShortage ? " y-call-root--credit-low" : ""}`}>
        <header className="y-call-header">
          <a
            className="y-call-back"
            href="/meet"
            aria-label="뒤로"
            onClick={(e) => {
              e.preventDefault();
              void (async () => {
                try {
                  pcRef.current?.close();
                } catch {
                  // ignore
                }
                await finalizeVoiceSession();
                router.push("/meet");
              })();
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 12H5 M12 5l-7 7 7 7" />
            </svg>
          </a>
          <div className="y-call-title">YEONUN · LIVE 상담</div>
          <div className="y-call-stats" />
        </header>

        <section className="y-call-stage" aria-label="통화 중">
          <div className="y-call-avatar-wrap">
            <div className="y-call-aura-1" />
            <div className="y-call-aura-2" />
            <div className="y-call-aura-3" />
            <div className="y-call-avatar">{meta.han}</div>
          </div>

          <div className="y-call-name-block">
            <div className="y-call-spec">{meta.spec}</div>
            <h1 className="y-call-name">{meta.name}</h1>
            <div className="y-call-status">
              <span className="y-call-status-text">
                {showCreditShortage
                  ? "크레딧 충전 후 상담을 시작할 수 있어요"
                  : ttsOutputActive
                    ? `${meta.name}가 말하고 있어요`
                    : rtcReady
                      ? status
                      : "연결 중…"}
              </span>
              <span className="pulse-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>

          <div className="y-call-wave-dual" aria-label="듀얼 파형">
            <div
              className={`y-wave-line tts ${activeLine === "tts" || ttsOutputActive ? "active" : ""}`}
              onClick={() => setActiveLine("tts")}
            >
              <div className="y-wave-tag">
                <span className="y-wave-dot tts" />
                <span className="y-wave-name">{meta.name}</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => {
                  const spread = 0.42 + (((i * 3 + 2) % 8) / 11);
                  const ttsWave = Math.min(1, ttsLevel * 0.88);
                  const h = 8 + Math.round(ttsWave * 36 * spread);
                  return (
                    <div
                      key={`t${i}`}
                      className="y-wave-bar tts"
                      style={{
                        height: `${h}px`,
                        transition: "height 70ms linear",
                      }}
                    />
                  );
                })}
              </div>
            </div>
            <div
              className={`y-wave-line stt ${activeLine === "stt" || (!ttsOutputActive && micLevel > MOBILE_STT_WAVE_ACTIVATE_MIN) ? "active" : ""}`}
              onClick={() => setActiveLine("stt")}
            >
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => {
                  const spread = 0.42 + (((i * 5 + 1) % 8) / 11);
                  const micWave = Math.min(1, micLevel * 0.88);
                  const h = 8 + Math.round(micWave * 36 * spread);
                  return (
                    <div
                      key={`m${i}`}
                      className="y-wave-bar stt"
                      style={{
                        height: `${h}px`,
                        transition: "height 70ms linear",
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="y-call-caption" aria-label="자막">
            <div className="y-call-caption-head">내가 방금 한 말 (인식)</div>
            <div className={`y-call-caption-body${showCreditShortage ? " y-call-caption-body--credit-low" : ""}`}>
              {showCreditShortage
                ? creditShortageCaption
                : uiError
                  ? uiError
                  : lastUserText
                    ? lastUserText
                    : voiceExternalId
                      ? "말하면 자동으로 인식됩니다…"
                      : "음성 설정 확인 중…"}
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          {!showCreditShortage ? (
            <div className="y-call-meter">
              <div>
                <div className="y-call-meter-time">{formatMmSs(sessionId ? elapsedSec : 0)}</div>
                <div className="y-call-meter-sub">상담 시간</div>
              </div>
              <div className="y-call-meter-info">
                <div className="free">{creditLine.line1}</div>
                <div>{creditLine.line2}</div>
                {guestCapActive ? (
                  <div className="y-call-meter-guest-hint">
                    비회원 · 무료 최대 {DEFAULT_FREE_TRIAL_SEC / 60}분
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {showCreditShortage ? (
            <div className="y-call-btns y-call-btns--credit-low">
              <button
                type="button"
                className="y-call-credit-charge"
                onClick={() => router.push("/checkout/credit")}
              >
                크레딧 충전하기
              </button>
              <button type="button" className="y-call-credit-back" onClick={() => router.push("/meet")}>
                돌아가기
              </button>
            </div>
          ) : (
            <div className="y-call-btns">
              <button
              className={`y-call-ctrl${muted ? " muted" : ""}`}
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "마이크 켜기" : "마이크 끄기"}
            >
              <svg viewBox="0 0 24 24">
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3" />
              </svg>
            </button>

            <button
              className="y-call-end"
              type="button"
              onClick={() => {
                try {
                  pcRef.current?.close();
                } catch {
                  // ignore
                }
                setStatus("종료");
                void (async () => {
                  await finalizeVoiceSession();
                  router.push("/meet");
                })();
              }}
              aria-label="상담 종료"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
              </svg>
              상담 종료
            </button>

            <button
              className={`y-call-ctrl${speakerMuted ? " speaker-muted" : ""}`}
              type="button"
              onClick={() => setSpeakerMuted((m) => !m)}
              aria-label={speakerMuted ? "스피커 켜기" : "스피커 음소거"}
            >
              <svg viewBox="0 0 24 24">
                <path d="M11 5L6 9H2v6h4l5 4z" />
                <path d="M15 8a4 4 0 0 1 0 8" />
              </svg>
            </button>
          </div>
          )}
        </footer>
      </main>
    </div>
  );
}
