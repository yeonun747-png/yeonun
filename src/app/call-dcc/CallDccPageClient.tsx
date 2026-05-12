"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { appendKstToManseContext } from "@/lib/datetime/kst";
import { buildFortuneManseContext } from "@/lib/fortune-manse-context";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";
import { extractRealtimeFunctionCallsFromResponseDone } from "@/lib/openai-realtime-function-calls";
import { recordMeetConsultCharacterForM07 } from "@/lib/daily-missions";
import { tryPersistMissionM07CompleteIfEligible } from "@/lib/mission-reconcile";
import { YEONUN_CREDIT_UPDATE_EVENT, readWallet } from "@/lib/credit-balance-local";
import {
  CREDIT_FREE_TRIAL_GRANT,
  CREDIT_VOICE_PER_MINUTE,
} from "@/lib/credit-policy";
import { clearVoiceManseMeta, readVoiceManseMeta } from "@/lib/voice-dcc-manse-meta";
import { getOrCreateVoiceVisitorRef } from "@/lib/voice-visitor-ref";

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

const MOBILE_STT_WAVE_ACTIVATE_MIN = 0.04;

function formatMmSs(totalSec: number): string {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.max(0, totalSec) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildVoiceCreditLines(): { line1: string; line2: string } {
  const wallet = readWallet();
  const now = Date.now();
  const freeExpired = wallet.freeExpiresAtMs < now;
  const freeUsed = Math.max(
    0,
    CREDIT_FREE_TRIAL_GRANT - Math.min(CREDIT_FREE_TRIAL_GRANT, Math.max(0, wallet.free)),
  );
  let line1: string;
  if (!freeExpired && (wallet.free > 0 || freeUsed > 0)) {
    line1 = `무료 ${CREDIT_FREE_TRIAL_GRANT.toLocaleString("ko-KR")} 크레딧 중 ${freeUsed.toLocaleString("ko-KR")} 사용`;
  } else if (wallet.paid > 0) {
    line1 = `충전 크레딧 ${wallet.paid.toLocaleString("ko-KR")} 잔여`;
  } else {
    line1 = `잔여 ${(wallet.free + wallet.paid).toLocaleString("ko-KR")} 크레딧`;
  }
  return { line1, line2: `이후 분당 ${CREDIT_VOICE_PER_MINUTE} 크레딧` };
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
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [uiError, setUiError] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [activeLine, setActiveLine] = useState<"tts" | "stt">("tts");
  const [rtcReady, setRtcReady] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [creditLine, setCreditLine] = useState(() => buildVoiceCreditLines());
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
  const ttsPlayingRef = useRef(false);
  const micFloatBufRef = useRef<Float32Array | null>(null);
  /** item_id → 누적 delta (completed 시 비움) */
  const userSttPartialByItemRef = useRef<Record<string, string>>({});

  const voiceExternalId = voiceOverride || fetchedVoiceExternalId || null;

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
    const on = () => setCreditLine(buildVoiceCreditLines());
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
  }, [sessionId]);

  useLayoutEffect(() => {
    if (!fromFortuneNav) {
      clearVoiceManseMeta();
    }
  }, [fromFortuneNav]);

  const finalizeVoiceSession = useCallback(async () => {
    const id = sessionIdRef.current;
    if (!id || endPostedRef.current) return;
    endPostedRef.current = true;
    const started = sessionStartMsRef.current;
    const duration_sec = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : 0;
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
        body: JSON.stringify({ duration_sec, cost_krw: 0 }),
      });
    } catch {
      // ignore
    }
    clearVoiceManseMeta();
  }, [characterKey]);

  useEffect(() => {
    return () => {
      void finalizeVoiceSession();
    };
  }, [finalizeVoiceSession]);

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
    if (voiceOverride) {
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
        user_ref: getOrCreateVoiceVisitorRef(),
        ...(summaryForSession ? { summary: summaryForSession } : {}),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.session?.id === "string" && data.session.id.trim()) {
          const sid = data.session.id.trim();
          sessionStartMsRef.current = Date.now();
          endPostedRef.current = false;
          sessionIdRef.current = sid;
          setElapsedSec(0);
          setSessionId(sid);
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
  }, [characterKey, meta.name, voiceOverride]);

  useEffect(() => {
    if (!sessionId || !voiceExternalId) return;
    let cancelled = false;
    openingSentRef.current = false;

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
        // 피크+ RMS 조합(로컬 모니터링은 에코캔슬 등으로 RMS만으로는 너무 작을 때가 많음)
        const raw = peak * 1.85 + rms * 6.5;
        setMicLevel(Math.max(0, Math.min(1, Math.pow(raw, 0.72))));
      }
      const fakeTts = ttsPlayingRef.current ? 0.35 + Math.sin(Date.now() / 210) * 0.12 : 0;
      setTtsLevel(fakeTts);
      rafRef.current = requestAnimationFrame(tickMeter);
    };

    const run = async () => {
      try {
        setStatus("연결 중…");
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

        const secretRes = await fetch("/api/voice/openai-realtime/client-secret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_key: characterKey,
            session_id: sessionId,
            manse_context: buildManseContext(),
          }),
        });
        const secretJson = (await secretRes.json().catch(() => ({}))) as { ok?: boolean; value?: string; error?: string; details?: string };
        if (!secretRes.ok || !secretJson.ok || !secretJson.value) {
          throw new Error(secretJson.details || secretJson.error || "Realtime 토큰 발급 실패");
        }
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

        dc.addEventListener("open", () => {
          setRtcReady(true);
          setStatus("듣는 중");
          if (!openingSentRef.current) {
            openingSentRef.current = true;
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

          if (ty === "response.created" || ty === "response.output_audio.started") {
            ttsPlayingRef.current = true;
            setTtsPlaying(true);
            setActiveLine("tts");
          }

          if (ty === "response.done") {
            ttsPlayingRef.current = false;
            setTtsPlaying(false);
            setStatus("듣는 중");
            const assistantText = extractAssistantFromResponseDone(msg);
            if (assistantText) void appendTurn("assistant", assistantText);
            const fcs = extractRealtimeFunctionCallsFromResponseDone(msg);
            if (fcs.length) void flushSaveUserInsightCalls(fcs);
          }

          if (ty === "conversation.item.input_audio_transcription.delta") {
            const id = String(msg.item_id ?? "_");
            const delta = String(msg.delta ?? "");
            if (delta) {
              userSttPartialByItemRef.current[id] = (userSttPartialByItemRef.current[id] ?? "") + delta;
              setLastUserText(userSttPartialByItemRef.current[id]);
              setActiveLine("stt");
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

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className="y-call-root">
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
                {ttsPlaying ? `${meta.name}가 말하고 있어요` : rtcReady ? status : "연결 중…"}
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
              className={`y-wave-line tts ${activeLine === "tts" || ttsPlaying ? "active" : ""}`}
              onClick={() => setActiveLine("tts")}
            >
              <div className="y-wave-tag">
                <span className="y-wave-dot tts" />
                <span className="y-wave-name">{meta.name}</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => {
                  const spread = 0.42 + (((i * 3 + 2) % 8) / 11);
                  const h = 8 + Math.round(ttsLevel * 36 * spread);
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
              className={`y-wave-line stt ${activeLine === "stt" || (!ttsPlaying && micLevel > MOBILE_STT_WAVE_ACTIVATE_MIN) ? "active" : ""}`}
              onClick={() => setActiveLine("stt")}
            >
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => {
                  const spread = 0.42 + (((i * 5 + 1) % 8) / 11);
                  const micWave = Math.min(1, micLevel * 1.35);
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
            <div className="y-call-caption-body">
              {uiError ? uiError : lastUserText ? lastUserText : voiceExternalId ? "말하면 자동으로 인식됩니다…" : "음성 설정 확인 중…"}
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          <div className="y-call-meter">
            <div>
              <div className="y-call-meter-time">{formatMmSs(sessionId ? elapsedSec : 0)}</div>
              <div className="y-call-meter-sub">상담 시간</div>
            </div>
            <div className="y-call-meter-info">
              <div className="free">{creditLine.line1}</div>
              <div>{creditLine.line2}</div>
            </div>
          </div>

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
        </footer>
      </main>
    </div>
  );
}
