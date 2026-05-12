"use client";

import { useMemo, useRef, useState } from "react";

import { ADMIN_TTS_PREVIEW_HEADER } from "@/lib/admin-tts-preview-constants";

export type TtsVoiceOption = { id: string; label: string; external_id: string; provider?: string };

export function VoiceCharacterPromptTtsFields({
  voices,
  defaultVoiceId,
  isActiveDefault,
  adminTtsPreviewToken,
}: {
  voices: TtsVoiceOption[];
  defaultVoiceId: string;
  isActiveDefault: string;
  adminTtsPreviewToken?: string | null;
}) {
  const [voiceId, setVoiceId] = useState(defaultVoiceId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const picked = useMemo(() => voices.find((v) => v.id === voiceId), [voices, voiceId]);
  const externalId = picked?.external_id ?? "";
  const provider = picked?.provider ?? "cartesia";

  async function preview() {
    if (!externalId) return;
    setBusy(true);
    setErr(null);

    if (typeof window !== "undefined" && !audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    try {
      await audioCtxRef.current?.resume?.();
    } catch {
      // ignore
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const isOpenAi = provider === "openai_realtime";
      const res = await fetch(isOpenAi ? "/api/tts/openai/speech" : "/api/tts/cartesia/preview", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(adminTtsPreviewToken ? { [ADMIN_TTS_PREVIEW_HEADER]: adminTtsPreviewToken } : {}),
        },
        body: JSON.stringify(
          isOpenAi
            ? { voice: externalId, input: "안녕하세요. 연운 음성 미리듣기입니다." }
            : { voice_external_id: externalId, transcript: "안녕하세요. 연운 음성 미리듣기입니다." },
        ),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        const base = j.error || res.statusText;
        if (res.status === 401) {
          throw new Error(
            `${base} — /admin/login 에서 이 기기에서도 로그인했는지 확인하세요. (세션 만료 시 새로고침)`,
          );
        }
        throw new Error(base);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      queueMicrotask(() => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = 0;
      });

      const ctx = audioCtxRef.current;
      if (ctx) {
        try {
          const arr = await blob.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(arr.slice(0));
          try {
            sourceRef.current?.stop();
          } catch {
            // ignore
          }
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          sourceRef.current = src;
          src.start(0);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "미리듣기 실패");
    } finally {
      setBusy(false);
    }
  }

  if (voices.length === 0) {
    return (
      <p className="y-admin-empty">
        <span>등록된 보이스가 없습니다. 위 「OpenAI Realtime 보이스」에서 10종 DB 반영을 먼저 실행하세요.</span>
      </p>
    );
  }

  return (
    <div className="y-admin-tts-character-row">
      <div className="y-admin-tts-voice-and-preview">
        <select className="y-admin-tts-voice-select" name="tts_voice_id" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
          <option value="">Realtime 보이스 선택</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <button type="button" className="y-admin-secondary y-admin-tts-preview-inline-btn" disabled={!externalId || busy} onClick={preview}>
          {busy ? "생성 중…" : "미리듣기"}
        </button>
        {err ? <span className="y-admin-tts-err">{err}</span> : null}
      </div>
      <select className="y-admin-tts-voice-select" name="is_active" defaultValue={isActiveDefault}>
        <option value="true">활성</option>
        <option value="false">비활성</option>
      </select>
      {audioUrl ? <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} /> : null}
    </div>
  );
}
