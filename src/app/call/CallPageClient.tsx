"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { appendKstToManseContext } from "@/lib/datetime/kst";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";
import { __YEONUN_VOICE_UNLOCK_KEY__ } from "@/components/meet/MeetCallButton";
import { VoiceLiveAudioRecorder } from "@/lib/voice-live/audio-recorder";

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

export default function CallPageClient() {
  const sp = useSearchParams();
  const characterKey = asCharacterKey(sp.get("character_key"));
  const meta = CHARACTER_META[characterKey];

  const [muted, setMuted] = useState(false);
  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const [activeLine, setActiveLine] = useState<"tts" | "stt">("tts");
  const [ended, setEnded] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [voiceExternalId, setVoiceExternalId] = useState<string | null>(null);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastSttText, setLastSttText] = useState<string>("");
  const [sttLevel, setSttLevel] = useState(0);
  const [ttsLevel, setTtsLevel] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [micReady, setMicReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const greetedRef = useRef(false);
  const sentFinalRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceCountRef = useRef(0);
  const thinkingRef = useRef(false);
  const listeningRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const ttsSpeakingRef = useRef(false);
  const bargeInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bargeHotFramesRef = useRef(0);
  const bargeTriggeredRef = useRef(false);
  const liveWsRef = useRef<WebSocket | null>(null);
  const liveReadyRef = useRef(false);
  const liveRecorderRef = useRef<VoiceLiveAudioRecorder | null>(null);
  const liveSseRef = useRef<EventSource | null>(null);
  const liveMicRmsRef = useRef(0);
  const liveNoiseFloorRef = useRef(0.008);
  const sttLevelRef = useRef(0);
  const ttsLevelRef = useRef(0);

  thinkingRef.current = thinking;
  listeningRef.current = listening;
  sttLevelRef.current = sttLevel;
  ttsLevelRef.current = ttsLevel;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_key: characterKey, user_ref: "guest", summary: `${meta.name} 음성상담 시작` }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.session?.id) setSessionId(data.session.id);
        const ext = data?.prompt_context?.cartesia_voice?.external_id;
        if (typeof ext === "string" && ext.trim()) setVoiceExternalId(ext.trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [characterKey, meta.name]);

  // meet에서 클릭(사용자 제스처)로 권한을 선요청했다면, call 입장 시 추가 터치 없이 시작한다.
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(__YEONUN_VOICE_UNLOCK_KEY__);
      if (v === "1") {
        setUnlocked(true);
        sessionStorage.removeItem(__YEONUN_VOICE_UNLOCK_KEY__);
      }
    } catch {
      // ignore
    }
  }, []);

  // 마이크 입력 레벨을 측정해 STT 파형을 실제 볼륨으로 움직인다. (언락 이후 시작)
  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const start = async () => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current;
        await ctx.resume?.();
        // reunionf82와 동일 계열: 스피커 에코가 마이크로 들어와 바지인/VAD가 흔들리는 것을 줄인다.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        micStreamRef.current = stream;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        micAnalyserRef.current = analyser;
        setMicReady(true);
      } catch {
        setMicReady(false);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      try {
        micStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      micStreamRef.current = null;
      micAnalyserRef.current = null;
      setMicReady(false);
    };
  }, [unlocked]);

  function sampleLevel(analyser: AnalyserNode | null): number {
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    return Math.max(0, Math.min(1, rms * 2.2));
  }

  // STT/TTS 레벨 루프 + 프레임 기반 바지인
  useEffect(() => {
    if (!unlocked) return;
    const tick = () => {
      const nextStt = sampleLevel(micAnalyserRef.current);
      const nextTts = sampleLevel(ttsAnalyserRef.current);
      setSttLevel(nextStt);
      setTtsLevel(nextTts);

      sttLevelRef.current = nextStt;
      ttsLevelRef.current = nextTts;
      if (ttsSpeakingRef.current && !bargeTriggeredRef.current) {
        const mic = liveMicRmsRef.current || nextStt;
        const floor = liveNoiseFloorRef.current;
        const thr = Math.max(0.018, floor * 2.2);
        if (mic > thr) bargeHotFramesRef.current += 1;
        else bargeHotFramesRef.current = 0;
        if (bargeHotFramesRef.current >= 3) {
          bargeTriggeredRef.current = true;
          bargeHotFramesRef.current = 0;
          clearSilenceTimer();
          try {
            ttsSrcRef.current?.stop();
          } catch {
            // ignore
          }
          ttsSpeakingRef.current = false;
          fetch("/api/voice/live/ai-speaking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, value: false }),
            keepalive: true,
          }).catch(() => {});
          intentionalStopRef.current = false;
          listeningRef.current = false;
          setListening(false);
          // eslint-disable-next-line no-console
          console.log("[voice][barge-in] local");
          setTimeout(() => startListening(true), 250);
        }
      } else if (!ttsSpeakingRef.current) {
        bargeHotFramesRef.current = 0;
        bargeTriggeredRef.current = false;
      }

      if (nextTts > 0.12) setActiveLine("tts");
      else if (listeningRef.current || nextStt > 0.12) setActiveLine("stt");
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [unlocked, sessionId]);

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function startSilenceTimer(seconds: number) {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      if (thinkingRef.current) return;
      if (ttsLevelRef.current > 0.08) return;
      if (silenceCountRef.current >= 2) return;
      silenceCountRef.current += 1;
      sendTurn("__SILENCE_BREAK__", { trigger: "silence", silenceSeconds: seconds });
    }, Math.max(1, seconds) * 1000);
  }

  function stopListening() {
    clearSilenceTimer();
    intentionalStopRef.current = true;
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    setListening(false);
  }

  async function playTts(text: string, opts?: { onEnd?: () => void }) {
    if (!voiceExternalId || ttsBusy) return;
    setTtsBusy(true);
    stopListening();
    clearSilenceTimer();
    if (typeof window !== "undefined" && !audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    try {
      await audioCtxRef.current?.resume?.();
    } catch {
      // ignore
    }

    try {
      const res = await fetch("/api/tts/cartesia/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_external_id: voiceExternalId, transcript: text }),
      });
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const audioBuf = await ctx.decodeAudioData(buf.slice(0));
      try {
        ttsSrcRef.current?.stop();
      } catch {
        // ignore
      }
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      ttsAnalyserRef.current = analyser;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ttsSrcRef.current = src;
      ttsSpeakingRef.current = true;
      bargeTriggeredRef.current = false;
      bargeHotFramesRef.current = 0;
      fetch("/api/voice/live/ai-speaking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, value: true }),
        keepalive: true,
      }).catch(() => {});
      src.onended = () => {
        setTtsLevel(0);
        ttsSpeakingRef.current = false;
        bargeTriggeredRef.current = false;
        bargeHotFramesRef.current = 0;
        fetch("/api/voice/live/ai-speaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, value: false }),
          keepalive: true,
        }).catch(() => {});
        opts?.onEnd?.();
      };
      src.start(0);
    } catch {
      // ignore
    } finally {
      setTtsBusy(false);
    }
  }

  function buildManseContext(): string {
    try {
      const raw = localStorage.getItem("yeonun_saju_v1");
      if (!raw) return appendKstToManseContext("");
      const j = JSON.parse(raw) as any;
      const r = computeManseFromFormInput({
        userYear: String(j.year || ""),
        userMonth: String(j.month || ""),
        userDay: String(j.day || ""),
        userBirthHour: j.hour != null ? String(j.hour) : null,
        userBirthMinute: j.minute != null ? String(j.minute) : null,
        userCalendarType: j.calendarType === "lunar-leap" ? "lunar-leap" : j.calendarType === "lunar" ? "lunar" : "solar",
        userName: String(j.name || ""),
      });
      if (!r) return appendKstToManseContext("");
      const m = r.manse;
      const one = (p: any) =>
        `${p.gan}${p.ji} · 십성 ${p.sibsung}/${p.jiSibsung} · 오행 ${p.ohang} · 음양 ${p.eumyang} · 운성 ${p.sibiunsung} · 신살 ${p.sibisinsal}`;
      const lines = [`연주: ${one(m.year)}`, `월주: ${one(m.month)}`, `일주: ${one(m.day)}`, `시주: ${one(m.hour)}`].join("\n");
      return appendKstToManseContext(lines);
    } catch {
      return appendKstToManseContext("");
    }
  }

  async function sendTurn(
    text: string,
    opts?: { trigger?: "opening" | "user" | "silence"; silenceSeconds?: number; clientOpeningText?: string },
  ) {
    if (!sessionId) return;
    const userText = String(text || "").trim();
    const trigger = opts?.trigger === "opening" ? "opening" : opts?.trigger === "silence" ? "silence" : "user";
    if (trigger !== "opening" && !userText) return;
    if (trigger === "user") setLastSttText(userText);
    clearSilenceTimer();
    setThinking(true);
    try {
      const payload: any = { text: userText, trigger, manse_context: buildManseContext() };
      if (trigger === "opening" && opts?.clientOpeningText) payload.client_opening_text = String(opts.clientOpeningText);
      if (trigger === "silence" && opts?.silenceSeconds) payload.silence_seconds = opts.silenceSeconds;
      const res = await fetch(`/api/voice/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) return;
      const out = String(data?.text || "").trim();
      if (out) {
        // eslint-disable-next-line no-console
        console.log("[voice][llm]", out);
      }
      if (out) {
        await playTts(out, {
          onEnd: () => {
            startSilenceTimer(5);
            setTimeout(() => startListening(true), 220);
          },
        });
      }
    } catch {
      // ignore
    } finally {
      setThinking(false);
    }
  }

  function startListening(autoRestart: boolean) {
    if (listeningRef.current) return;
    if (!unlocked) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setLastSttText("이 브라우저는 음성 전사(STT)를 지원하지 않아요. Chrome/Edge에서 다시 시도해 주세요.");
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "ko-KR";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    let interimText = "";
    let flushTimer: any = null;
    const scheduleFlush = () => {
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        const candidate = (finalText + interimText).trim();
        if (sentFinalRef.current) return;
        if (!candidate) return;
        sentFinalRef.current = true;
        try {
          rec.stop();
        } catch {}
        // eslint-disable-next-line no-console
        console.log("[voice][stt]", candidate);
        sendTurn(candidate, { trigger: "user" });
      }, 1500);
    };
    sentFinalRef.current = false;
    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      interimText = interim;
      const display = (finalText + interim).trim();
      if (display) setLastSttText(display);
      if (display) {
        clearSilenceTimer();
        silenceCountRef.current = 0;
        scheduleFlush();
      }
      const finalized = finalText.trim();
      if (!sentFinalRef.current && finalized) {
        sentFinalRef.current = true;
        if (flushTimer) clearTimeout(flushTimer);
        try {
          rec.stop();
        } catch {}
        // eslint-disable-next-line no-console
        console.log("[voice][stt]", finalized);
        sendTurn(finalized, { trigger: "user" });
      }
    };
    rec.onerror = (ev: any) => {
      if (flushTimer) clearTimeout(flushTimer);
      intentionalStopRef.current = false;
      setListening(false);
      try {
        const reason = String(ev?.error || "").trim();
        if (reason) setLastSttText(`STT 오류: ${reason}`);
      } catch {
        // ignore
      }
      if (autoRestart) setTimeout(() => startListening(true), 450);
    };
    rec.onend = () => {
      if (flushTimer) clearTimeout(flushTimer);
      listeningRef.current = false;
      setListening(false);
      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }
      if (autoRestart) setTimeout(() => startListening(true), 350);
    };
    listeningRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
    }
  }

  // 언락 직후 STT가 조용히 안 뜨는 케이스를 방지: TTS가 말하는 중이 아닐 때 한 번 시작을 시도
  useEffect(() => {
    if (!unlocked) return;
    const id = setTimeout(() => {
      if (!ttsSpeakingRef.current) startListening(true);
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  // 입장 시 오프닝
  useEffect(() => {
    if (!unlocked) return;
    if (!sessionId || !voiceExternalId) return;
    if (greetedRef.current) return;
    greetedRef.current = true;
    sendTurn("", { trigger: "opening" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, sessionId, voiceExternalId]);

  // AudioWorklet 스트리밍 + SSE interrupted 수신
  useEffect(() => {
    if (!unlocked) return;
    if (!sessionId) return;
    const httpBase = "/api/voice/live";
    let cancelled = false;
    liveReadyRef.current = false;
    const connect = async () => {
      try {
        const es = new EventSource(`${httpBase}/events?session_id=${encodeURIComponent(sessionId)}`);
        liveSseRef.current = es;
        es.onmessage = (ev) => {
          let msg: any = null;
          try {
            msg = JSON.parse(String(ev.data || "{}"));
          } catch {
            return;
          }
          if (msg?.type === "ready") {
            liveReadyRef.current = true;
            return;
          }
          if (msg?.type === "interrupted") {
            try {
              ttsSrcRef.current?.stop();
            } catch {}
            ttsSpeakingRef.current = false;
            fetch("/api/voice/live/ai-speaking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId, value: false }),
              keepalive: true,
            }).catch(() => {});
            intentionalStopRef.current = false;
            listeningRef.current = false;
            setListening(false);
            setTimeout(() => startListening(true), 250);
          }
        };

        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current!;
        await ctx.resume?.();

        if (!liveRecorderRef.current) liveRecorderRef.current = new VoiceLiveAudioRecorder();
        const rec = liveRecorderRef.current;
        await rec.start({
          ctx,
          stream: micStreamRef.current ?? undefined,
          onRms: (rms) => {
            liveMicRmsRef.current = rms;
            if (!ttsSpeakingRef.current) {
              const nf = liveNoiseFloorRef.current;
              liveNoiseFloorRef.current = nf * 0.9 + rms * 0.1;
            }
          },
          onChunk: (base64) => {
            if (cancelled) return;
            if (!ttsSpeakingRef.current) return;
            fetch(`${httpBase}/audio`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_id: sessionId, data: base64, ai_speaking: ttsSpeakingRef.current }),
              keepalive: true,
            }).catch(() => {});
          },
        });
      } catch {
        // ignore
      }
    };
    connect();
    return () => {
      cancelled = true;
      liveReadyRef.current = false;
      try {
        liveRecorderRef.current?.stop(true);
      } catch {}
      try {
        liveSseRef.current?.close();
      } catch {}
      liveSseRef.current = null;
    };
  }, [unlocked, sessionId]);

  const endCall = () => {
    setEnded(true);
    if (!sessionId) return;
    fetch(`/api/voice/sessions/${sessionId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration_sec: 252,
        cost_krw: 0,
        summary: "그 사람은 헤어진 후에도 마음을 닫지 못한 상태입니다.",
      }),
    }).catch(() => {});
  };

  if (ended) {
    return (
      <div className="yeonunPage">
        <main className="y-call-end-screen" aria-label="상담 종료 요약">
          <div className="y-call-end-hero">
            <div className="y-call-end-eyebrow">CALL ENDED · 상담 종료</div>
            <h2 className="y-call-end-title">{meta.name}와 4분 12초</h2>
            <div className="y-call-end-time">04:12 · 2026.04.26 SUN</div>
          </div>
          <div className="y-call-summary-section">
            <div className="y-call-summary-card">
              <div className="y-call-summary-head">
                <div className="y-call-summary-icon">心</div>
                <div className="y-call-summary-title">연화의 한 마디 요약</div>
              </div>
              <div className="y-call-summary-body">
                그 사람은 <strong>헤어진 후에도 마음을 닫지 못한 상태</strong>입니다. 다만 표현이 서툰 일주이니 먼저 다가가지 않을 가능성이 높아요. 5월 중순부터 인연이 다시 닿을
                자리가 보이니, 그 전까지는 <strong>차분히 자신을 돌보는 시간</strong>으로 쓰세요.
              </div>
            </div>
            <div className="y-call-summary-card">
              <div className="y-call-summary-head">
                <div className="y-call-summary-icon">道</div>
                <div className="y-call-summary-title">행동 가이드</div>
              </div>
              <div className="y-call-summary-body">
                · 4월 말까지는 먼저 연락하지 마세요
                <br />· 5월 중순 이후, 자연스러운 안부 정도가 적절합니다
                <br />· 만약 다시 만나게 되면 두 분의 속궁합은 좋습니다
              </div>
            </div>
            <div className="y-call-rating">
              <div className="y-call-rating-q">연화의 풀이는 어떠셨나요?</div>
              <div className="y-call-rating-stars" aria-label="별점">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} className="y-call-rating-star on" type="button" aria-label={`${i + 1}점`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="y-call-end-foot">
            <button className="y-end-btn-secondary" type="button" onClick={() => (window.location.href = "/")}>
              홈으로
            </button>
            <button className="y-end-btn-primary" type="button" onClick={() => (window.location.href = "/content/reunion-maybe?modal=1")}>
              텍스트로 받아보기 · 14,900원
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className="y-call-root">
        <header className="y-call-header">
          <a className="y-call-back" href="/meet" aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </a>
          <div className="y-call-title">VOICE · LIVE</div>
          <div className="y-call-stats" />
        </header>

        <section className="y-call-stage" aria-label="통화 중">
          {!unlocked ? (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={() => setUnlocked(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setUnlocked(true);
              }}
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                textAlign: "center",
                color: "rgba(255,255,255,0.9)",
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(10px)",
              }}
              aria-label="터치하면 음성대화 시작"
            >
              <div style={{ maxWidth: 420 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.18em", color: "rgba(245,218,224,0.75)", marginBottom: 10 }}>VOICE · START</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>화면을 한 번 터치하면 대화가 시작돼요</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                  앱 외부에서 바로 들어온 경우(권한 선요청이 없는 경우)에는
                  <br />
                  최초 1회 터치가 필요합니다.
                </div>
              </div>
            </div>
          ) : null}
          <div className="y-call-avatar-wrap">
            <div className="y-call-aura-1" />
            <div className="y-call-aura-2" />
            <div className="y-call-aura-3" />
            <div className="y-call-avatar">{meta.han}</div>
          </div>

          <div className="y-call-name-block">
            <div className="y-call-spec">{meta.spec}</div>
            <div className="y-call-name">{meta.name}</div>
            <div className="y-call-status">
              {meta.name}가 말하고 있어요
              <span className="pulse-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>

          <div className="y-call-wave-dual" aria-label="듀얼 파형">
            <div className={`y-wave-line tts ${activeLine === "tts" ? "active" : ""}`} onClick={() => setActiveLine("tts")}>
              <div className="y-wave-tag">
                <span className="y-wave-dot tts" />
                <span className="y-wave-name">{meta.name}</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div
                    key={`t${i}`}
                    className="y-wave-bar tts"
                    style={{
                      height: `${8 + Math.round(ttsLevel * 30 * (0.5 + (i % 6) / 6))}px`,
                      transition: "height 80ms linear",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className={`y-wave-line stt ${activeLine === "stt" ? "active" : ""}`} onClick={() => setActiveLine("stt")}>
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div
                    key={`s${i}`}
                    className="y-wave-bar stt"
                    style={{
                      height: `${8 + Math.round(sttLevel * 30 * (0.5 + (i % 6) / 6))}px`,
                      transition: "height 80ms linear",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="y-call-caption" aria-label="자막">
            <div className="y-call-caption-head">내가 방금 한 말</div>
            <div className="y-call-caption-body">
              {lastSttText ? lastSttText : listening ? "듣는 중…" : unlocked ? (micReady ? "듣는 중…" : "마이크 연결 중…") : "잠시만요…"}
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          <div className="y-call-meter">
            <div>
              <div className="y-call-meter-time">02:34</div>
              <div className="y-call-meter-sub">상담 시간</div>
            </div>
            <div className="y-call-meter-info">
              <div className="y-call-meter-usage">
                무료 <span className="free">3분</span> 중 2:34 사용
              </div>
              <div className="y-call-meter-after">이후 분당 390원</div>
            </div>
          </div>

          <div className="y-call-mic" aria-label="마이크 민감도">
            <div className="y-call-mic-row">
              <span className="label">마이크 민감도</span>
              <span className="value">50%</span>
            </div>
            <div className="y-call-mic-track" role="presentation">
              <div className="y-call-mic-fill" style={{ width: "50%" }} />
              <div className="y-call-mic-thumb" style={{ left: "50%" }} />
            </div>
          </div>

          <div className="y-call-actions">
            <button className="y-call-btn ghost" type="button" onClick={() => setMuted((v) => !v)}>
              {muted ? "음소거 해제" : "음소거"}
            </button>
            <button className="y-call-btn danger" type="button" onClick={endCall}>
              통화 종료
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

