"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { __YEONUN_VOICE_UNLOCK_KEY__ } from "@/components/meet/MeetCallButton";
import { appendKstToManseContext } from "@/lib/datetime/kst";
import { computeManseFromFormInput } from "@/lib/manse-ryeok";
import { VoiceDccAudioRecorder } from "@/lib/voice-dcc/audio-recorder";
import { VoiceLiveAudioStreamer } from "@/lib/voice-live/audio-streamer";

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

type NdjsonMsg =
  | { type: "userTranscript"; text: string }
  | { type: "audio"; base64: string; format?: "pcm_s16le"; sampleRate?: number }
  | { type: "assistantText"; text: string }
  | { type: "error"; message?: string }
  | { type: "done" };

export default function CallDccPageClient() {
  const sp = useSearchParams();
  const characterKey = asCharacterKey(sp.get("character_key"));
  const meta = CHARACTER_META[characterKey];
  const voiceOverride = String(sp.get("voice_external_id") ?? "").trim();

  const [unlocked] = useState(true);
  const [status, setStatus] = useState<string>("대기 중");
  const [lastUserText, setLastUserText] = useState("");
  const lastAssistantTextRef = useRef<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fetchedVoiceExternalId, setFetchedVoiceExternalId] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [ttsLevel, setTtsLevel] = useState(0);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  /** 캐릭터 TTS 이번 턴 남은 분량(스케줄된 PCM 큐 기준, 1=전부 남음) */
  const [ttsRemainFrac, setTtsRemainFrac] = useState(1);
  const [uiError, setUiError] = useState<string>("");
  const [muted, setMuted] = useState(false);
  const [activeLine, setActiveLine] = useState<"tts" | "stt">("tts");
  const [pttDown, setPttDown] = useState(false);
  const pttDownAtRef = useRef<number>(0);
  /** 마이크·recorder 준비 완료(오프닝 인사는 이후에만 호출) */
  const [dccAudioReady, setDccAudioReady] = useState(false);
  const openingDoneSessionRef = useRef<string | null>(null);
  const openingGenRef = useRef(0);

  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamerRef = useRef<VoiceLiveAudioStreamer | null>(null);
  const recorderRef = useRef<VoiceDccAudioRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const turnAbortRef = useRef<AbortController | null>(null);
  const assistantSpeakingRef = useRef(false);
  const rmsRef = useRef(0);
  // 초기 노이즈 플로어를 낮게 잡고(실측 rms 0.003~0.01), 적응형으로 천천히 올린다.
  const noiseFloorRef = useRef(0.003);
  const speechRef = useRef(false);
  const lastHotAtRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadRafRef = useRef<number | null>(null);
  const vadStateRef = useRef<{ thrOn: number; thrOff: number; above: number; below: number; speech: boolean }>({
    thrOn: 0,
    thrOff: 0,
    above: 0,
    below: 0,
    speech: false,
  });
  const vadSpeechSinceRef = useRef<number>(Date.now());
  const vadPrevSpeechRef = useRef<boolean>(false);
  /** 발화 구간 RMS 엔벨로프(릴리즈). 피크만으로 thrOff 잡으면 조용한 말끝에서 말끝 감지가 안 됨 */
  const vadEnvRef = useRef(0);
  const vadPeakRef = useRef(0);
  const vadLastActiveAtRef = useRef(0);
  const utteranceStartRef = useRef(0);

  const voiceExternalId = voiceOverride || fetchedVoiceExternalId || null;
  const voiceExternalIdRef = useRef<string | null>(null);
  voiceExternalIdRef.current = voiceExternalId;

  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micMeterSinkRef = useRef<GainNode | null>(null);

  const ensureAudioRunning = async (ctx: AudioContext) => {
    try {
      await ctx.resume?.();
    } catch {
      // ignore
    }
    if (ctx.state === "running") return;
    // 브라우저 자동재생 정책 때문에, 사용자 제스처가 필요할 수 있다.
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

  const makeStreamer = (ctx: AudioContext) =>
    new VoiceLiveAudioStreamer(ctx, {
      onActiveChange: (active) => {
        assistantSpeakingRef.current = active;
        setTtsPlaying(active);
        if (active) setActiveLine("tts");
      },
      onOutputLevel: (v) => setTtsLevel(v),
    });

  useEffect(() => {
    if (!ttsPlaying) {
      setTtsRemainFrac(1);
      return;
    }
    let raf = 0;
    const tick = () => {
      const fr = streamerRef.current?.getTtsRemainingFraction();
      setTtsRemainFrac(typeof fr === "number" ? fr : 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setTtsRemainFrac(1);
    };
  }, [ttsPlaying]);

  function buildManseContext(): string {
    try {
      const raw = localStorage.getItem("yeonun_saju_v1");
      if (!raw) return appendKstToManseContext("");
      const j = JSON.parse(raw) as any;
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
      const one = (p: any) =>
        `${p.gan}${p.ji} · 십성 ${p.sibsung}/${p.jiSibsung} · 오행 ${p.ohang} · 음양 ${p.eumyang} · 운성 ${p.sibiunsung} · 신살 ${p.sibisinsal}`;
      const lines = [`연주: ${one(m.year)}`, `월주: ${one(m.month)}`, `일주: ${one(m.day)}`, `시주: ${one(m.hour)}`].join("\n");
      return appendKstToManseContext(`${birthLines}\n\n[만세력 사주 명식]\n${lines}`);
    } catch {
      return appendKstToManseContext("");
    }
  }

  // 캐릭터별 voice external id 확보(기존 세션 API 재사용)
  useEffect(() => {
    let cancelled = false;
    if (voiceOverride) {
      return () => {
        cancelled = true;
      };
    }
    fetch("/api/voice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ character_key: characterKey, user_ref: "guest", summary: `${meta.name} DCC 음성상담 시작` }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data?.session?.id === "string" && data.session.id.trim()) setSessionId(data.session.id.trim());
        const ext = data?.prompt_context?.cartesia_voice?.external_id;
        if (typeof ext === "string" && ext.trim()) {
          setFetchedVoiceExternalId(ext.trim());
          setUiError("");
        } else {
          setUiError("Cartesia voice 설정을 찾지 못했어요. ?voice_external_id=... 를 붙이거나 서버에 CARTESIA_DEFAULT_VOICE_EXTERNAL_ID를 설정해 주세요.");
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
    if (!dccAudioReady || !sessionId || !voiceExternalId) return;
    if (openingDoneSessionRef.current === sessionId) return;
    const myGen = ++openingGenRef.current;
    let cancelled = false;
    const run = async () => {
      try {
        setStatus(`${meta.name}가 인사 중…`);
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        await ensureAudioRunning(ctx);
        if (cancelled || myGen !== openingGenRef.current) return;
        try {
          streamerRef.current?.stop();
        } catch {}
        if (audioCtxRef.current) streamerRef.current = makeStreamer(audioCtxRef.current);
        lastAssistantTextRef.current = "";
        assistantSpeakingRef.current = true;
        try {
          turnAbortRef.current?.abort();
        } catch {}
        const ac = new AbortController();
        turnAbortRef.current = ac;
        const res = await fetch("/api/voice/dcc-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_key: characterKey,
            session_id: sessionId,
            voice_external_id: voiceExternalId,
            manse_context: buildManseContext(),
            opening_handshake: true,
          }),
          signal: ac.signal,
        });
        if (cancelled || myGen !== openingGenRef.current) return;
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          setUiError(detail ? `인사(dcc-turn) 실패: ${detail.slice(0, 300)}` : "인사(dcc-turn) 실패");
          setStatus("듣는 중");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled || myGen !== openingGenRef.current) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let msg: NdjsonMsg | null = null;
            try {
              msg = JSON.parse(t);
            } catch {
              continue;
            }
            if (!msg) continue;
            if (msg.type === "userTranscript") {
              setLastUserText(String(msg.text ?? ""));
            } else if (msg.type === "audio") {
              const b64 = String(msg.base64 ?? "");
              const sr = Number(msg.sampleRate ?? 24000);
              if (b64) streamerRef.current?.pushPcm16Base64(b64, sr);
            } else if (msg.type === "assistantText") {
              lastAssistantTextRef.current = String(msg.text ?? "");
            } else if (msg.type === "error") {
              setStatus("오류");
            }
          }
        }
        if (!cancelled && myGen === openingGenRef.current) {
          openingDoneSessionRef.current = sessionId;
        }
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        const msg = String(err?.message ?? e ?? "");
        const aborted =
          err?.name === "AbortError" || /aborted|AbortError|BodyStreamBuffer was aborted/i.test(msg);
        if (!aborted && !cancelled && myGen === openingGenRef.current) {
          setUiError(`인사 스트림 실패: ${msg}`);
        }
      } finally {
        assistantSpeakingRef.current = streamerRef.current?.isActive?.() ?? false;
        if (!cancelled && myGen === openingGenRef.current) {
          setStatus("듣는 중");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      openingGenRef.current += 1;
    };
  }, [dccAudioReady, sessionId, voiceExternalId, characterKey, meta.name]);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const start = async () => {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) {
          setUiError("이 브라우저는 AudioContext를 지원하지 않아요.");
          return;
        }
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx({ sampleRate: 16000 });
        const ctx = audioCtxRef.current;
        await ensureAudioRunning(ctx);
        if (cancelled) return;
        streamerRef.current = makeStreamer(audioCtxRef.current);

        // 마이크 입력은 analyser로 "프레임 단위" RMS를 뽑아 VAD/바지인 반응성을 reunionf82 급으로 맞춘다.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
        });
        micStreamRef.current = stream;
        const tracks = stream.getAudioTracks?.() ?? [];
        if (tracks.length === 0) throw new Error("마이크 오디오 트랙이 없어요(권한/디바이스를 확인해 주세요).");
        const src = ctx.createMediaStreamSource(stream);
        if (!src) throw new Error("createMediaStreamSource 실패");
        micSourceRef.current = src;
        const analyser = ctx.createAnalyser();
        if (!analyser) throw new Error("createAnalyser 실패");
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.45;
        const meterSink = ctx.createGain();
        meterSink.gain.value = 0;
        micMeterSinkRef.current = meterSink;
        try {
          src.connect(analyser);
          analyser.connect(meterSink);
          meterSink.connect(ctx.destination);
        } catch (e: any) {
          throw new Error(`마이크 입력 연결 실패: ${String(e?.message || e)}`);
        }
        micAnalyserRef.current = analyser;

        const sampleRms = () => {
          const a = micAnalyserRef.current;
          if (!a) return 0;
          const buf = new Uint8Array(a.fftSize);
          a.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          return Math.sqrt(sum / buf.length);
        };
        const tick = () => {
          if (cancelled) return;
          const rms = sampleRms();
          rmsRef.current = rms;
          if (!speechRef.current && !assistantSpeakingRef.current) {
            // 노이즈 플로어는 급격히 커지지 않게 상한/하한을 둔다.
              const nf = noiseFloorRef.current;
              // 말소리(rms 상승)를 노이즈로 학습해버리면 VAD가 영원히 안 걸린다.
              // "충분히 조용할 때만" 천천히 노이즈 플로어를 업데이트한다.
              if (rms <= Math.max(0.006, nf * 1.15)) {
                const next = nf * 0.96 + rms * 0.04;
                noiseFloorRef.current = Math.max(0.0015, Math.min(0.02, next));
              }
          }
          setMicLevel(Math.max(0, Math.min(1, rms * 3.4)));
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);

        recorderRef.current = new VoiceDccAudioRecorder();
        await recorderRef.current.start({
          ctx,
          stream,
          existingMediaStreamSource: src,
        });
        if (cancelled) return;
        const voiceWaitDeadline = Date.now() + 120_000;
        while (!cancelled && !voiceExternalIdRef.current) {
          if (Date.now() > voiceWaitDeadline) {
            setUiError("음성 ID를 기다리다 시간이 초과됐어요. 새로고침 후 다시 시도해 주세요.");
            setStatus("오류");
            return;
          }
          await new Promise<void>((r) => setTimeout(r, 80));
        }
        if (cancelled) return;
        setDccAudioReady(true);
        setStatus("듣는 중");
      } catch (e: any) {
        setUiError(`초기화 실패: ${String(e?.message || e)}`);
        setStatus("오류");
      }
    };
    start();
    return () => {
      cancelled = true;
      setDccAudioReady(false);
      setStatus("종료");
      try {
        turnAbortRef.current?.abort();
      } catch {}
      try {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      } catch {}
      rafRef.current = null;
      try {
        if (vadRafRef.current != null) cancelAnimationFrame(vadRafRef.current);
      } catch {}
      vadRafRef.current = null;
      try {
        recorderRef.current?.stop(true);
      } catch {}
      try {
        micSourceRef.current?.disconnect();
      } catch {}
      micSourceRef.current = null;
      try {
        micAnalyserRef.current?.disconnect();
      } catch {}
      micAnalyserRef.current = null;
      try {
        micMeterSinkRef.current?.disconnect();
      } catch {}
      micMeterSinkRef.current = null;
      try {
        micStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      } catch {}
      micStreamRef.current = null;
      try {
        streamerRef.current?.stop();
      } catch {}
    };
  }, [unlocked]);

  // VAD(로컬): 말 시작/끝 감지해서 STT+스트리밍 턴 호출
  useEffect(() => {
    if (!unlocked) return;
    if (!voiceExternalId) return;
    let cancelled = false;

    // 노이즈 적응형 threshold (환경/기기별 편차 흡수)
    // (실측) 많은 기기에서 평상시 rms가 0.003~0.010 수준이라, 최소 threshold를 더 낮춰야 VAD가 걸린다.
    const THRESH_ON_MIN = 0.0035;
    const THRESH_OFF_MIN = 0.003;
    /** TTS 재생 중 마이크로 끊을 때(에코와 트레이드오프) */
    const BARGE_IN_THRESH_ON_MIN = 0.022;
    /** 말끝 확정 후 PCM 추출·STT 요청까지 추가 대기(너무 길면 체감 지연) */
    const HOLD_OFF_MS = 70;
    /** RMS가 thrOff 위로만 남을 때(말끝 잡기 어려운 환경) 쓰는 상한 대기 */
    const SPEECH_END_MS = 260;
    const VAD_WARMUP_MS = 650;
    /** 말끝이 절대 안 잡히는 환경(배경 RMS가 thrOff보다 큼)에서도 턴이 나가게 */
    const MAX_UTTERANCE_MS = 52_000;
    const MIN_GAP_MS = 280;
    /** 바지인만 짧게: 긴 턴 직후에도 끊기 반응이 나가게 */
    const MIN_GAP_BARGE_MS = 120;
    const FRAMES_ON = 1;
    const BARGE_IN_FRAMES_ON = 2;
    const FRAMES_OFF = 2;
    let above = 0;
    let below = 0;
    const vadReadyAt = Date.now() + VAD_WARMUP_MS;

    const clearSilenceTimer = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    };

    let endUtteranceInFlight = false;
    const runEndOfUtterance = async () => {
      if (endUtteranceInFlight) return;
      endUtteranceInFlight = true;
      try {
        if (!speechRef.current) return;
        speechRef.current = false;
        setStatus("처리 중…");
        const pcmBase64 = (await recorderRef.current?.stopAndGetBase64Pcm16()) || "";
        if (!pcmBase64) {
          setUiError("녹음 데이터가 비어 있어요. (마이크 입력/Worklet 연결을 확인해 주세요)");
          setStatus("듣는 중");
          return;
        }
        const ctx = audioCtxRef.current;
        const stream = micStreamRef.current ?? undefined;
        if (ctx) {
          recorderRef.current = new VoiceDccAudioRecorder();
          const shared = micSourceRef.current;
          recorderRef.current
            .start({
              ctx,
              stream,
              existingMediaStreamSource: shared ?? undefined,
              onRms: (rms) => {
                rmsRef.current = rms;
                setMicLevel(Math.max(0, Math.min(1, rms * 3.4)));
              },
            })
            .catch(() => {});
        }

        try {
          streamerRef.current?.stop();
        } catch {}
        if (audioCtxRef.current) streamerRef.current = makeStreamer(audioCtxRef.current);
        lastAssistantTextRef.current = "";
        assistantSpeakingRef.current = true;
        try {
          turnAbortRef.current?.abort();
        } catch {}
        const ac = new AbortController();
        turnAbortRef.current = ac;

        const res = await fetch("/api/voice/dcc-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            character_key: characterKey,
            session_id: sessionId,
            voice_external_id: voiceExternalId,
            manse_context: buildManseContext(),
            audio_base64: pcmBase64,
          }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          setUiError(detail ? `dcc-turn 실패: ${detail.slice(0, 300)}` : "dcc-turn 실패");
          setStatus("오류");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let msg: NdjsonMsg | null = null;
            try {
              msg = JSON.parse(t);
            } catch {
              continue;
            }
            if (!msg) continue;
            if (msg.type === "userTranscript") {
              setLastUserText(String(msg.text ?? ""));
            } else if (msg.type === "audio") {
              const b64 = String(msg.base64 ?? "");
              const sr = Number(msg.sampleRate ?? 24000);
              if (b64) {
                streamerRef.current?.pushPcm16Base64(b64, sr);
              }
            } else if (msg.type === "assistantText") {
              lastAssistantTextRef.current = String(msg.text ?? "");
            } else if (msg.type === "error") {
              setStatus("오류");
            } else if (msg.type === "done") {
              // no-op
            }
          }
        }
      } catch (e: unknown) {
        const err = e as { name?: string; message?: string };
        const msg = String(err?.message ?? e ?? "");
        const aborted =
          err?.name === "AbortError" || /aborted|AbortError|BodyStreamBuffer was aborted/i.test(msg);
        if (aborted) {
          return;
        }
        setUiError(`스트림 처리 실패: ${msg}`);
      } finally {
        assistantSpeakingRef.current = streamerRef.current?.isActive?.() ?? false;
        setStatus("듣는 중");
        endUtteranceInFlight = false;
      }
    };

    const scheduleSpeechEnd = () => {
      if (silenceTimerRef.current) return;
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        void runEndOfUtterance();
      }, HOLD_OFF_MS);
    };

    const tick = () => {
      if (cancelled) return;
      const rms = rmsRef.current;
      const now = Date.now();
      if (!speechRef.current) {
        const floor = noiseFloorRef.current;
        if (!assistantSpeakingRef.current && rms <= Math.max(0.012, floor * 1.35)) {
          const next = floor * 0.94 + rms * 0.06;
          noiseFloorRef.current = Math.max(0.0015, Math.min(0.02, next));
        }
        // 초기 노이즈플로어가 높게 잡히면 영원히 트리거가 안 걸릴 수 있어 multiplier를 낮춘다.
        const aiSpeaking = assistantSpeakingRef.current;
        const learnedFloor = noiseFloorRef.current;
        const thrOn = aiSpeaking
          ? Math.max(BARGE_IN_THRESH_ON_MIN, learnedFloor * 3.15)
          : Math.max(THRESH_ON_MIN, learnedFloor * 1.35, learnedFloor + 0.002);
        const framesOnTarget = aiSpeaking ? BARGE_IN_FRAMES_ON : FRAMES_ON;
        const minGapMs = aiSpeaking ? MIN_GAP_BARGE_MS : MIN_GAP_MS;
        vadStateRef.current.thrOn = thrOn;
        vadStateRef.current.thrOff = Math.max(THRESH_OFF_MIN, learnedFloor * 1.02);
        vadStateRef.current.above = above;
        vadStateRef.current.below = below;
        const speechNow = false;
        if (vadPrevSpeechRef.current !== speechNow) {
          vadSpeechSinceRef.current = Date.now();
          vadPrevSpeechRef.current = speechNow;
        }
        vadStateRef.current.speech = speechNow;
        if (now < vadReadyAt && !aiSpeaking) {
          above = 0;
        } else if (rms >= thrOn) above += 1;
        else above = 0;
        if (above >= framesOnTarget && now - lastHotAtRef.current >= minGapMs) {
          // lastHotAtRef는 speech-start 스팸 방지용
          lastHotAtRef.current = now;
          speechRef.current = true;
          above = 0;
          below = 0;
          vadEnvRef.current = Math.max(rms, 0.0004);
          vadPeakRef.current = Math.max(rms, THRESH_ON_MIN);
          vadLastActiveAtRef.current = now;
          utteranceStartRef.current = now;
          setActiveLine("stt");

          // barge-in: 사용자가 말 시작하면 "조건 없이" 즉시 끊는다.
          // - 스트리밍 요청이 진행 중이면 abort
          // - 이미 받아둔 오디오 큐가 재생 중이어도 stop
          try {
            turnAbortRef.current?.abort();
          } catch {}
          try {
            streamerRef.current?.stop();
          } catch {}
          if (audioCtxRef.current) streamerRef.current = makeStreamer(audioCtxRef.current);
          assistantSpeakingRef.current = streamerRef.current?.isActive?.() ?? false;

          setStatus("말하는 중");
          clearSilenceTimer();
        }
      } else {
        const floor = noiseFloorRef.current;
        // 고정 thrOff만 쓰면 "말한 뒤에도 RMS가 thrOff보다 큰" 기기에서 말끝이 영원히 안 옴 → bytes/audio 0
        let env = vadEnvRef.current;
        if (rms >= env) env = rms;
        else env = Math.max(rms, env * 0.907);
        vadEnvRef.current = env;
        const peak = Math.max(vadPeakRef.current, rms);
        vadPeakRef.current = peak;
        const activeThr = Math.max(THRESH_OFF_MIN, floor * 1.2, peak * 0.38);
        if (rms >= activeThr) {
          vadLastActiveAtRef.current = now;
        }
        const thrOff = Math.max(THRESH_OFF_MIN * 0.92, floor * 1.015, Math.min(env * 0.34, activeThr));
        vadStateRef.current.thrOn = Math.max(THRESH_ON_MIN, floor * 1.05);
        vadStateRef.current.thrOff = thrOff;
        vadStateRef.current.above = above;
        vadStateRef.current.below = below;
        const speechNow = true;
        if (vadPrevSpeechRef.current !== speechNow) {
          vadSpeechSinceRef.current = Date.now();
          vadPrevSpeechRef.current = speechNow;
        }
        vadStateRef.current.speech = speechNow;
        if (now - utteranceStartRef.current > MAX_UTTERANCE_MS) {
          clearSilenceTimer();
          void runEndOfUtterance();
        } else if (rms <= thrOff) {
          // 말소리가 잠깐만 thrOff 아래로 내려와도 먼저 잡음(SPEECH_END_MS 전에 STT로 넘김)
          below += 1;
          if (below >= FRAMES_OFF && !silenceTimerRef.current) scheduleSpeechEnd();
        } else if (now - vadLastActiveAtRef.current >= SPEECH_END_MS) {
          scheduleSpeechEnd();
        } else {
          below = 0;
          clearSilenceTimer();
        }
      }
      requestAnimationFrame(tick);
    };
    vadRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      clearSilenceTimer();
      try {
        if (vadRafRef.current != null) cancelAnimationFrame(vadRafRef.current);
      } catch {}
      vadRafRef.current = null;
    };
  }, [unlocked, voiceExternalId, characterKey, sessionId]);

  return (
    <div className="yeonunPage" style={{ background: "#1A1815" }}>
      <main className="y-call-root">
        <header className="y-call-header">
          <a className="y-call-back" href="/meet" aria-label="뒤로">
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
              <span className="y-call-status-text">{ttsPlaying ? `${meta.name}가 말하고 있어요` : status}</span>
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
              <div
                className="y-wave-tts-meter"
                role={ttsPlaying ? "progressbar" : undefined}
                aria-hidden={!ttsPlaying}
                aria-valuemin={ttsPlaying ? 0 : undefined}
                aria-valuemax={ttsPlaying ? 100 : undefined}
                aria-valuenow={ttsPlaying ? Math.round((1 - ttsRemainFrac) * 100) : undefined}
                aria-label={ttsPlaying ? `${meta.name} 음성 재생 남은 분량` : undefined}
                title="이번 답변에서 아직 재생되지 않은 음성(도착한 큐 기준)"
              >
                <div className="y-wave-tts-meter-track" />
                <div
                  className="y-wave-tts-meter-fill"
                  style={{
                    width: ttsPlaying ? `${Math.max(0, Math.min(100, ttsRemainFrac * 100))}%` : "0%",
                  }}
                />
              </div>
            </div>
            <div
              className={`y-wave-line stt ${activeLine === "stt" || (!ttsPlaying && !assistantSpeakingRef.current && micLevel > 0.04) ? "active" : ""}`}
              onClick={() => setActiveLine("stt")}
            >
              <div className="y-wave-tag">
                <span className="y-wave-dot stt" />
                <span className="y-wave-name">나</span>
              </div>
              <div className="y-wave-bars">
                {bars.map((i) => {
                  const spread = 0.42 + (((i * 5 + 1) % 8) / 11);
                  const micWave = Math.min(1, micLevel * 1.65);
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
            <div className="y-call-caption-head">내가 방금 한 말</div>
            <div className="y-call-caption-body">
              {uiError ? uiError : lastUserText ? lastUserText : voiceExternalId ? "말해보세요…" : "음성 설정 확인 중…"}
            </div>
          </div>
        </section>

        <footer className="y-call-controls" aria-label="컨트롤">
          <div className="y-call-meter">
            <div>
              <div className="y-call-meter-time">02:34</div>
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>상담 시간</div>
            </div>
            <div className="y-call-meter-info">
              <div className="free">
                무료 <span className="free">3분</span> 중 2:34 사용
              </div>
              <div>이후 분당 390원</div>
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
            <button
              className={`y-call-ctrl ${muted ? "muted" : ""}`}
              type="button"
              onPointerDown={() => {
                pttDownAtRef.current = Date.now();
                setPttDown(true);
                setActiveLine("stt");
                setStatus("말하는 중");
              }}
              onPointerUp={async () => {
                const heldMs = Date.now() - pttDownAtRef.current;
                setPttDown(false);
                // 짧게 탭이면 음소거 토글(목업 동작), 길게 누르면 PTT 전송
                if (heldMs < 180) {
                  setMuted((v) => !v);
                  return;
                }
                setStatus("처리 중…");
                try {
                  const pcmBase64 = (await recorderRef.current?.stopAndGetBase64Pcm16()) || "";
                  if (!pcmBase64) return;
                  // 새 recorder 재시작
                  const ctx = audioCtxRef.current;
                  const stream = micStreamRef.current ?? undefined;
                  if (ctx) {
                    recorderRef.current = new VoiceDccAudioRecorder();
                    recorderRef.current
                      .start({
                        ctx,
                        stream,
                        existingMediaStreamSource: micSourceRef.current ?? undefined,
                        onRms: (rms) => {
                          rmsRef.current = rms;
                          setMicLevel(Math.max(0, Math.min(1, rms * 3.4)));
                        },
                      })
                      .catch(() => {});
                  }
                  // 바지인 동작: 기존 재생/요청 중단
                  try {
                    turnAbortRef.current?.abort();
                  } catch {}
                  try {
                    streamerRef.current?.stop();
                  } catch {}
                  if (audioCtxRef.current) streamerRef.current = makeStreamer(audioCtxRef.current);

                  assistantSpeakingRef.current = true;
                  const ac = new AbortController();
                  turnAbortRef.current = ac;
                  const res = await fetch("/api/voice/dcc-turn", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      character_key: characterKey,
                      session_id: sessionId,
                      voice_external_id: voiceExternalId,
                      manse_context: buildManseContext(),
                      audio_base64: pcmBase64,
                    }),
                    signal: ac.signal,
                  });
                  if (!res.ok || !res.body) {
                    const detail = await res.text().catch(() => "");
                    setUiError(detail ? `dcc-turn 실패: ${detail.slice(0, 300)}` : "dcc-turn 실패");
                    return;
                  }
                  const reader = res.body.getReader();
                  const decoder = new TextDecoder();
                  let buf = "";
                  for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buf += decoder.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() ?? "";
                    for (const line of lines) {
                      const t = line.trim();
                      if (!t) continue;
                      let msg: NdjsonMsg | null = null;
                      try {
                        msg = JSON.parse(t);
                      } catch {
                        continue;
                      }
                      if (!msg) continue;
                      if (msg.type === "userTranscript") setLastUserText(String(msg.text ?? ""));
                      else if (msg.type === "audio") {
                        if (muted) continue;
                        const b64 = String((msg as any).base64 ?? "");
                        const sr = Number((msg as any).sampleRate ?? 24000);
                        if (b64) streamerRef.current?.pushPcm16Base64(b64, sr);
                      } else if (msg.type === "assistantText") lastAssistantTextRef.current = String(msg.text ?? "");
                    }
                  }
                } finally {
                  assistantSpeakingRef.current = streamerRef.current?.isActive?.() ?? false;
                  setStatus("듣는 중");
                }
              }}
              onPointerCancel={() => setPttDown(false)}
              aria-label={pttDown ? "말하는 중" : muted ? "음소거 해제" : "음소거"}
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
                  turnAbortRef.current?.abort();
                } catch {}
                try {
                  recorderRef.current?.stop(true);
                } catch {}
                try {
                  streamerRef.current?.stop();
                } catch {}
                setStatus("종료");
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
              className="y-call-ctrl"
              type="button"
              onClick={() => setMuted((v) => !v)}
              aria-label={muted ? "스피커 켜기" : "스피커 끄기"}
            >
              <svg viewBox="0 0 24 24">
                <path d="M11 5L6 9H2v6h4l5 4z" />
                <path d="M15 8a4 4 0 0 1 0 8" />
                <path d="M18 5a8 8 0 0 1 0 14" />
              </svg>
            </button>
          </div>

          <div className="y-call-tip">음성 응답이 1~2초 지연될 수 있어요 · 다른 작동(화면캡처·전화 등)을 하지 마세요</div>
        </footer>
      </main>
    </div>
  );
}

