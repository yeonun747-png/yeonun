"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { VoiceLiveAudioRecorder } from "@/lib/voice-live/audio-recorder";
import { VoiceLiveAudioStreamer } from "@/lib/voice-live/audio-streamer";

type LiveInbound =
  | { type: "ready"; t?: string }
  | { type: "text"; role?: "user" | "assistant" | string; text?: string }
  | { type: "transcript"; role?: "user" | "assistant" | string; text?: string; final?: boolean }
  | { type: "audio"; data?: string; sample_rate?: number }
  | { type: "interrupted"; reason?: string };

function wsUrlFromEnv() {
  const explicit = (process.env.NEXT_PUBLIC_VOICE_LIVE_WS_URL || "").trim();
  if (explicit) return explicit;
  const base = (process.env.NEXT_PUBLIC_CLOUDWAYS_URL || process.env.CLOUDWAYS_URL || "").trim();
  if (!base) return "";
  const u = new URL(base);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/voice/live";
  u.search = "";
  return u.toString();
}

export default function CallLivePageClient() {
  const [unlocked, setUnlocked] = useState(false);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string>("대기 중");
  const [lastText, setLastText] = useState<string>("");
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [errorText, setErrorText] = useState<string>("");
  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const [micLevel, setMicLevel] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<VoiceLiveAudioRecorder | null>(null);
  const streamerRef = useRef<VoiceLiveAudioStreamer | null>(null);

  function sampleRms(analyser: AnalyserNode | null) {
    if (!analyser) return 0;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const start = async () => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        const ctx = audioCtxRef.current!;
        await ctx.resume?.();

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.7;
        src.connect(analyser);
        micAnalyserRef.current = analyser;

        // 레벨 UI
        const tick = () => {
          const rms = sampleRms(micAnalyserRef.current);
          setMicLevel(Math.max(0, Math.min(1, rms * 2.2)));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // ignore
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      micAnalyserRef.current = null;
    };
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;

    const wsUrl = wsUrlFromEnv();
    if (!wsUrl) {
      setErrorText("NEXT_PUBLIC_VOICE_LIVE_WS_URL 또는 NEXT_PUBLIC_CLOUDWAYS_URL이 필요합니다.");
      return;
    }

    let cancelled = false;
    setStatus("연결 중…");

    const connect = async () => {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current!;
      await ctx.resume?.();

      streamerRef.current = new VoiceLiveAudioStreamer(ctx);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        if (cancelled) return;
        setConnected(true);
        setStatus("초기화…");
        setErrorText("");

        // Gemini Live 전용으로만 사용한다는 전제 (다른 provider 분기 없음)
        ws.send(
          JSON.stringify({
            type: "init",
            model: "gemini-live-2.5-flash-native-audio",
            // 서버에 따라 필요할 수 있는 힌트 필드들(없어도 무시될 수 있음)
            audio_format: "pcm16",
            sample_rate: 24000,
            language: "ko",
          }),
        );

        if (!recorderRef.current) recorderRef.current = new VoiceLiveAudioRecorder();
        const rec = recorderRef.current;
        try {
          await rec.start({
            ctx,
            onChunk: (base64) => {
              if (cancelled) return;
              if (ws.readyState !== WebSocket.OPEN) return;
              ws.send(JSON.stringify({ type: "audio", data: base64 }));
            },
          });
        } catch (e) {
          setErrorText(e instanceof Error ? e.message : "마이크를 시작하지 못했습니다.");
        }
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        let msg: LiveInbound | null = null;
        try {
          msg = JSON.parse(String(ev.data || "{}"));
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "ready") {
          setStatus("대화 중");
          return;
        }
        if (msg.type === "interrupted") {
          streamerRef.current?.stop();
          // 재생기 재생성(다음 오디오를 새 타임라인에 붙이기)
          if (audioCtxRef.current) streamerRef.current = new VoiceLiveAudioStreamer(audioCtxRef.current);
          setStatus("사용자 끼어들기");
          return;
        }
        if (msg.type === "audio" && msg.data) {
          streamerRef.current?.pushPcm16Base64(msg.data, msg.sample_rate);
          return;
        }
        if (msg.type === "text") {
          const t = String(msg.text ?? "").trim();
          if (t) setLastText(t);
          return;
        }
        if (msg.type === "transcript") {
          const t = String(msg.text ?? "").trim();
          if (t) setLastTranscript(t);
          return;
        }
      };

      ws.onerror = () => {
        if (cancelled) return;
        setErrorText("WebSocket 오류가 발생했습니다.");
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setStatus("연결 종료");
      };
    };

    connect().catch((e) => setErrorText(e instanceof Error ? e.message : "연결에 실패했습니다."));

    return () => {
      cancelled = true;
      setConnected(false);
      try {
        recorderRef.current?.stop(true);
      } catch {
        // ignore
      }
      try {
        streamerRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      streamerRef.current = null;
    };
  }, [unlocked]);

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className="y-call-root">
        <header className="y-call-header">
          <a className="y-call-back" href="/meet" aria-label="뒤로">
            <svg viewBox="0 0 24 24">
              <path d="M15 18 L9 12 L15 6" />
            </svg>
          </a>
          <div className="y-call-title">VOICE · LIVE (GEMINI)</div>
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
              aria-label="터치하면 라이브 음성대화 시작"
            >
              <div style={{ maxWidth: 440 }}>
                <div style={{ fontSize: 12, letterSpacing: "0.18em", color: "rgba(245,218,224,0.75)", marginBottom: 10 }}>
                  VOICE · LIVE
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>화면을 한 번 터치하면 시작돼요</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
                  Gemini Live 프록시(`/voice/live`)에 연결합니다.
                </div>
              </div>
            </div>
          ) : null}

          <div className="y-call-avatar-wrap">
            <div className="y-call-aura-1" />
            <div className="y-call-aura-2" />
            <div className="y-call-aura-3" />
            <div className="y-call-avatar">蓮</div>
          </div>

          <div className="y-call-name-block">
            <div className="y-call-spec">Gemini Live</div>
            <div className="y-call-name">{connected ? "연결됨" : "연결 안됨"}</div>
            <div className="y-call-status">
              {status}
              <span className="pulse-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>

          <div className="y-call-wave-dual" aria-label="마이크 레벨">
            <div className="y-wave-line stt active">
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div
                    key={`m${i}`}
                    className="y-wave-bar stt"
                    style={{
                      height: `${8 + Math.round(micLevel * 30 * (0.5 + (i % 6) / 6))}px`,
                      transition: "height 80ms linear",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="y-call-caption" aria-label="자막">
            <div className="y-call-caption-head">실시간 텍스트</div>
            <div className="y-call-caption-body">
              {errorText ? errorText : lastTranscript ? lastTranscript : lastText ? lastText : unlocked ? "듣는 중…" : "잠시만요…"}
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          <div className="y-call-actions">
            <button
              className="y-call-btn danger"
              type="button"
              onClick={() => {
                try {
                  wsRef.current?.close();
                } catch {
                  // ignore
                }
              }}
            >
              연결 종료
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}

