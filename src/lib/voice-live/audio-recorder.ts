"use client";

import { PCM16_RECORDER_WORKLET } from "@/lib/voice-live/worklets/pcm16-recorder";

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function addWorkletModule(ctx: AudioContext, name: string, src: string) {
  const blob = new Blob([src], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class VoiceLiveAudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private onChunk: ((base64Pcm16: string) => void) | null = null;
  private onRms: ((rms: number) => void) | null = null;
  private started = false;

  async start(opts: {
    ctx: AudioContext;
    stream?: MediaStream;
    onChunk: (base64Pcm16: string) => void;
    onRms?: (rms: number) => void;
  }) {
    if (this.started) return;
    this.started = true;
    this.ctx = opts.ctx;
    this.onChunk = opts.onChunk;
    this.onRms = opts.onRms ?? null;

    if (!this.ctx.audioWorklet) throw new Error("AudioWorklet is not available");

    if (!opts.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
    } else {
      this.stream = opts.stream;
    }

    this.source = this.ctx.createMediaStreamSource(this.stream);
    await addWorkletModule(this.ctx, "pcm16-recorder", PCM16_RECORDER_WORKLET);
    // v2: 프로세서 이름을 변경해 캐시/재등록 문제를 회피
    this.node = new AudioWorkletNode(this.ctx, "pcm16-recorder-v2");
    this.node.port.onmessage = (ev: MessageEvent) => {
      const ab = (ev.data as any)?.int16arrayBuffer as ArrayBuffer | undefined;
      if (!ab) return;
      const rms = Number((ev.data as any)?.rms ?? 0);
      if (Number.isFinite(rms)) this.onRms?.(rms);
      const b64 = arrayBufferToBase64(ab);
      this.onChunk?.(b64);
    };
    this.source.connect(this.node);
    // worklet을 destination에 연결하지 않는다(이중 출력 방지)
  }

  stop(keepStream = true) {
    this.started = false;
    try {
      this.source?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.node?.disconnect?.();
    } catch {
      // ignore
    }
    this.node = null;
    this.source = null;
    this.onChunk = null;
    this.onRms = null;
    if (!keepStream) {
      try {
        this.stream?.getTracks?.().forEach((t) => t.stop());
      } catch {
        // ignore
      }
      this.stream = null;
    }
  }
}

