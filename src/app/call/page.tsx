"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";

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
  const [lastUserClipUrl, setLastUserClipUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [ttsBusy, setTtsBusy] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [listening, setListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);

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
    return () => {
      if (lastUserClipUrl) URL.revokeObjectURL(lastUserClipUrl);
    };
  }, [lastUserClipUrl]);

  async function toggleRecord() {
    if (recording) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecorderRef.current = rec;
      mediaChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) mediaChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mediaChunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (lastUserClipUrl) URL.revokeObjectURL(lastUserClipUrl);
        setLastUserClipUrl(URL.createObjectURL(blob));
        mediaChunksRef.current = [];
      };
      rec.start();
      setRecording(true);
    } catch {
      // 마이크 권한 거부 등
    }
  }

  async function playTts(text: string) {
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
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      ttsSrcRef.current = src;
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
      const one = (p: any) => `${p.gan}${p.ji}`;
      return `연주 ${one(m.year)} / 월주 ${one(m.month)} / 일주 ${one(m.day)} / 시주 ${one(m.hour)}`;
    } catch {
      return "";
    }
  }

  async function sendTurn(text: string) {
    if (!sessionId) return;
    const userText = String(text || "").trim();
    if (!userText) return;
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    try {
      const res = await fetch(`/api/voice/sessions/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userText, manse_context: buildManseContext() }),
      });
      const data = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data?.error || res.statusText }]);
        return;
      }
      const out = String(data?.text || "").trim();
      if (out) {
        setMessages((prev) => [...prev, { role: "assistant", text: out }]);
        await playTts(out);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", text: "네트워크 오류가 발생했어요." }]);
    }
  }

  function startListening() {
    if (listening) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((prev) => [...prev, { role: "assistant", text: "이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome 권장)" }]);
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
      if (t) sendTurn(t);
    };
    setListening(true);
    rec.start();
  }

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
                <span className="y-wave-name">연화</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => (
                  <div key={`t${i}`} className="y-wave-bar tts" style={{ animationDelay: `${(i % 6) * 0.08}s` }} />
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
                  <div key={`s${i}`} className="y-wave-bar stt" style={{ animationDelay: `${(i % 6) * 0.08}s` }} />
                ))}
              </div>
            </div>
          </div>

          <div className="y-call-caption" aria-label="자막">
            <div className="y-call-caption-head">내가 방금 한 말</div>
            <div className="y-call-caption-body">
              {messages.length > 0 ? messages[messages.length - 1]?.text : lastUserClipUrl ? "녹음이 저장되었습니다. 아래에서 재생할 수 있어요." : "말하기를 눌러 대화를 시작해보세요."}
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
            <button className={`y-call-ctrl ${recording ? "muted" : ""}`} type="button" onClick={toggleRecord} aria-label="녹음">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="6" />
              </svg>
            </button>
            <button className={`y-call-ctrl ${listening ? "muted" : ""}`} type="button" onClick={startListening} aria-label="말하기">
              <svg viewBox="0 0 24 24">
                <path d="M12 2 a4 4 0 0 1 4 4 v6 a4 4 0 0 1-8 0 V6 a4 4 0 0 1 4-4z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
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
            <button className="y-call-ctrl" type="button" aria-label="테스트 응답" disabled={!voiceExternalId || ttsBusy} onClick={() => playTts("네, 말씀해 주세요.")}>
              <svg viewBox="0 0 24 24">
                <path d="M11 5L6 9H3v6h3l5 4V5z" />
                <path d="M16 8a4 4 0 0 1 0 8" />
                <path d="M18.5 5.5a7 7 0 0 1 0 13" />
              </svg>
            </button>
          </div>

          {lastUserClipUrl ? (
            <div style={{ marginTop: 10 }}>
              <audio controls src={lastUserClipUrl} style={{ width: "100%" }} />
            </div>
          ) : null}

          {messages.length > 0 ? (
            <div style={{ marginTop: 10, color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.45 }}>
              {messages.slice(-4).map((m, idx) => (
                <div key={idx} style={{ marginTop: 6 }}>
                  <strong style={{ color: "white" }}>{m.role === "user" ? "나" : meta.name}</strong> · {m.text}
                </div>
              ))}
            </div>
          ) : null}

          <div className="y-call-note">
            음성 응답이 1~2초 지연될 수 있어요 · 다른 작업(화면캡쳐·전화 등)은 하지 마세요
          </div>
        </footer>
      </main>
    </div>
  );
}

