"use client";

import { useRef, useState } from "react";

export function TtsVoiceListPreview({ externalId }: { externalId: string }) {
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

    // 클릭(사용자 제스처) 시점에 오디오 권한을 먼저 언락한다.
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
      const res = await fetch("/api/tts/cartesia/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_external_id: externalId,
          transcript: "안녕하세요. 연운 음성 미리듣기입니다.",
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      // 1) controls용 audio src는 유지
      queueMicrotask(() => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = 0;
      });

      // 2) 실제 자동재생은 WebAudio로 (await 이후에도 재생 가능)
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
          // WebAudio가 실패하면 controls로 재생하도록 둔다.
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
