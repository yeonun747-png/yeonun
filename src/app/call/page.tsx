"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";
import { __YEONUN_VOICE_UNLOCK_KEY__ } from "@/components/meet/MeetCallButton";

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

export default function CallPage() {
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
  const [listening, setListening] = useState(false);
  const [lastSttText, setLastSttText] = useState<string>("");
  const [sttLevel, setSttLevel] = useState(0);
  const [ttsLevel, setTtsLevel] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const greetedRef = useRef(false);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

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

  useEffect(() => {
    return () => {};
  }, []);

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

  // unlocked가 false인 경우(직접 /call 진입 등) 최소 안내 오버레이는 유지한다.
  // (reunionf82처럼 완전 무터치 자동은 브라우저/권한 상태에 따라 불가능할 수 있음)

  // 마이크 입력 레벨을 측정해 STT 파형을 실제 볼륨로 움직인다. (언락 이후 시작)
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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
      } catch {
        // 권한 거부 등 -> 레벨은 0으로 유지
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
    };
  }, [unlocked]);

  // analyser로부터 RMS 레벨(0~1) 계산
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
    // 체감이 잘 되도록 약간 부스트/클램프
    return Math.max(0, Math.min(1, rms * 2.2));
  }

  // STT/TTS 레벨 루프
  useEffect(() => {
    if (!unlocked) return;
    const tick = () => {
      setSttLevel(sampleLevel(micAnalyserRef.current));
      setTtsLevel(sampleLevel(ttsAnalyserRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [unlocked]);

  // barge-in: 사용자가 말하기 시작(마이크 레벨 상승)하면 진행 중 TTS를 즉시 끊고 STT를 이어간다.
  useEffect(() => {
    if (!unlocked) return;
    if (ttsLevel < 0.08) return;
    if (sttLevel < 0.18) return;
    try {
      ttsSrcRef.current?.stop();
    } catch {
      // ignore
    }
    // 말이 이미 시작된 상황이라 듣기 재시작
    startListening(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, sttLevel, ttsLevel]);

  async function playTts(text: string, opts?: { onEnd?: () => void }) {
    if (!voiceExternalId || ttsBusy) return;
    setTtsBusy(true);
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
      // TTS 레벨 측정 analyser 준비
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.7;
      ttsAnalyserRef.current = analyser;
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ttsSrcRef.current = src;
      src.onended = () => {
        // 끝나면 레벨을 자연스럽게 0으로
        setTtsLevel(0);
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
      if (!raw) return "";
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
      if (!r) return "";
      const m = r.manse;
      const one = (p: any) =>
        `${p.gan}${p.ji} · 십성 ${p.sibsung}/${p.jiSibsung} · 오행 ${p.ohang} · 음양 ${p.eumyang} · 운성 ${p.sibiunsung} · 신살 ${p.sibisinsal}`;
      return [
        `연주: ${one(m.year)}`,
        `월주: ${one(m.month)}`,
        `일주: ${one(m.day)}`,
        `시주: ${one(m.hour)}`,
      ].join("\n");
    } catch {
      return "";
    }
  }

  async function sendTurn(text: string, opts?: { trigger?: "opening" | "user" }) {
    if (!sessionId) return;
    const userText = String(text || "").trim();
    const trigger = opts?.trigger === "opening" ? "opening" : "user";
    if (trigger !== "opening" && !userText) return;
    if (trigger !== "opening") setLastSttText(userText);
    try {
      const res = await fetch(`/api/voice/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, trigger, manse_context: buildManseContext() }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        // 사용자에게는 LLM 텍스트를 노출하지 않는다. (필요 시 콘솔로만)
        return;
      }
      const out = String(data?.text || "").trim();
      if (out) {
        await playTts(out, { onEnd: () => startListening(true) });
      }
    } catch {
      // ignore
    }
  }

  function startListening(autoRestart: boolean) {
    if (listening) return;
    if (!unlocked) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      return;
    }
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += t;
      }
    };
    rec.onerror = () => {
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (t) {
        sendTurn(t, { trigger: "user" });
        return;
      }
      if (autoRestart) {
        // 말이 없으면 잠깐 쉬고 다시 듣기 (reunionf82의 silence break 느낌)
        setTimeout(() => startListening(true), 350);
      }
    };
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  // 입장 시 자동 오프닝 → TTS 종료 후 자동 STT
  useEffect(() => {
    if (!unlocked) return;
    if (!sessionId || !voiceExternalId) return;
    if (greetedRef.current) return;
    greetedRef.current = true;
    sendTurn("", { trigger: "opening" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, sessionId, voiceExternalId]);

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
                그 사람은 <strong>헤어진 후에도 마음을 닫지 못한 상태</strong>입니다. 다만 표현이 서툰 일주이니 먼저 다가가지 않을 가능성이 높아요.
                5월 중순부터 인연이 다시 닿을 자리가 보이니, 그 전까지는 <strong>차분히 자신을 돌보는 시간</strong>으로 쓰세요.
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
                <div style={{ fontSize: 12, letterSpacing: "0.18em", color: "rgba(245,218,224,0.75)", marginBottom: 10 }}>
                  VOICE · START
                </div>
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
                      height: `${8 + Math.round(ttsLevel * 30 * (0.5 + ((i % 6) / 6))) }px`,
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
                      height: `${8 + Math.round(sttLevel * 30 * (0.5 + ((i % 6) / 6))) }px`,
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
              {lastSttText ? lastSttText : listening ? "듣는 중…" : "잠시만요…"}
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

          <div className="y-call-btns">
            <button className={`y-call-ctrl ${muted ? "muted" : ""}`} type="button" onClick={() => setMuted((v) => !v)}>
              <svg viewBox="0 0 24 24">
                <path d="M12 2 a4 4 0 0 1 4 4 v6 a4 4 0 0 1-8 0 V6 a4 4 0 0 1 4-4z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <path d="M12 19v3" />
              </svg>
            </button>
            <button className="y-call-end" type="button" onClick={endCall}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
                <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
              </svg>
              상담 종료
            </button>
          </div>

          <div className="y-call-note">
            음성 응답이 1~2초 지연될 수 있어요 · 다른 작업(화면캡쳐·전화 등)은 하지 마세요
          </div>
        </footer>
      </main>
    </div>
  );
}

