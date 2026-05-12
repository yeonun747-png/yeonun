"use client";

import { useRef, useState } from "react";

export function TtsVoiceListPreview({ externalId, provider = "cartesia" }: { externalId: string; provider?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isOpenAi
            ? { voice: externalId, input: "안녕하세요. 연운 음성 미리듣기입니다." }
            : { voice_external_id: externalId, transcript: "안녕하세요. 연운 음성 미리듣기입니다." },
        ),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
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

  return (
    <span className="y-admin-tts-list-preview">
      <button type="button" className="y-admin-tts-list-preview-btn" disabled={!externalId || busy} onClick={preview}>
        {busy ? "…" : "미리듣기"}
      </button>
      {err ? <span className="y-admin-tts-err">{err}</span> : null}
      {audioUrl ? <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} /> : null}
    </span>
  );
}
