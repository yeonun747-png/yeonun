"use client";

type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(ev: MessageEvent) => void>;
};

const registeredWorklets: Map<AudioContext, Record<string, WorkletGraph>> = new Map();

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: false,
};

const AUDIO_RECORDING_WORKLET = `
class AudioProcessingWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(2048);
    this.bufferWriteIndex = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.event === "flush") {
        if (this.bufferWriteIndex > 0) this.sendAndClearBuffer();
        this.port.postMessage({ event: "flushDone" });
      }
    };
  }

  process(inputs) {
    if (inputs[0].length) {
      const channel0 = inputs[0][0];
      this.processChunk(channel0);
    }
    return true;
  }

  sendAndClearBuffer() {
    this.port.postMessage({
      event: "chunk",
      data: {
        int16arrayBuffer: this.buffer.slice(0, this.bufferWriteIndex).buffer,
      },
    });
    this.bufferWriteIndex = 0;
  }

  processChunk(float32Array) {
    const l = float32Array.length;
    for (let i = 0; i < l; i++) {
      const int16Value = float32Array[i] * 32768;
      this.buffer[this.bufferWriteIndex++] = int16Value;
      if (this.bufferWriteIndex >= this.buffer.length) {
        this.sendAndClearBuffer();
      }
    }
    if (this.bufferWriteIndex >= this.buffer.length) {
      this.sendAndClearBuffer();
    }
  }
}
`;

const VOLUME_METER_WORKLET = `
class VolMeter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.volume = 0;
    this.updateIntervalInMS = 16;
    this.nextUpdateFrame = this.updateIntervalInMS;
    this.port.onmessage = event => {
      if (event.data.updateIntervalInMS) {
        this.updateIntervalInMS = event.data.updateIntervalInMS;
      }
    };
  }

  get intervalInFrames() {
    return (this.updateIntervalInMS / 1000) * sampleRate;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const samples = input[0];
      let sum = 0;
      for (let i = 0; i < samples.length; ++i) {
        sum += samples[i] * samples[i];
      }
      const rms = Math.sqrt(sum / samples.length);
      this.volume = Math.max(rms, this.volume * 0.7);
      this.nextUpdateFrame -= samples.length;
      if (this.nextUpdateFrame < 0) {
        this.nextUpdateFrame += this.intervalInFrames;
        this.port.postMessage({ volume: this.volume });
      }
    }
    return true;
  }
}
`;

function createWorkletFromSrc(workletName: string, workletSrc: string) {
  const script = new Blob([`registerProcessor("${workletName}", ${workletSrc})`], {
    type: "application/javascript",
  });
  return URL.createObjectURL(script);
}

async function addNamedWorklet(ctx: AudioContext, workletName: string, workletSrc: string, handler: (ev: MessageEvent) => void) {
  let record = registeredWorklets.get(ctx);
  if (!record) {
    record = {};
    registeredWorklets.set(ctx, record);
  }

  if (record[workletName]) {
    record[workletName].handlers.push(handler);
    return record[workletName].node;
  }

  record[workletName] = { handlers: [handler] };
  const src = createWorkletFromSrc(workletName, workletSrc);
  try {
    await ctx.audioWorklet.addModule(src);
  } finally {
    URL.revokeObjectURL(src);
  }
  const node = new AudioWorkletNode(ctx, workletName);
  node.port.onmessage = (ev: MessageEvent) => {
    record?.[workletName]?.handlers.forEach((h) => h(ev));
  };
  record[workletName].node = node;
  return node;
}

function uint8ToBase64Chunked(bytes: Uint8Array) {
  const CHUNK = 49152;
  let out = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, bytes.length);
    let bin = "";
    for (let j = i; j < end; j++) bin += String.fromCharCode(bytes[j]);
    out += btoa(bin);
  }
  return out;
}

function concatUint8(chunks: Uint8Array[]) {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export class VoiceDccAudioRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  /** false면 source는 외부(CallDcc 미터 등)에서 생성·연결 유지 */
  private ownsMediaSource = true;
  private recordingWorklet: AudioWorkletNode | null = null;
  private volumeWorklet: AudioWorkletNode | null = null;
  private started = false;
  private chunks: Uint8Array[] = [];
  private onRms: ((rms: number) => void) | null = null;
  private starting: Promise<void> | null = null;
  private sawAnyChunk = false;
  /** 워클릿 flush 완료 시 resolve(stopAndGetBase64Pcm16) */
  private pendingFlushDone: (() => void) | null = null;

  debugState() {
    return {
      started: this.started,
      mode: this.recordingWorklet ? "reunion-worklet" : "none",
      sawAnyChunk: this.sawAnyChunk,
      chunks: this.chunks.length,
    };
  }

  async start(opts: {
    ctx: AudioContext;
    stream?: MediaStream;
    /** 동일 스트림에 소스 노드를 두 개 만들지 않도록(미터·녹음 공유) 외부에서 만든 소스를 넘김 */
    existingMediaStreamSource?: MediaStreamAudioSourceNode;
    onRms?: (rms: number) => void;
  }) {
    if (this.started || this.starting) return this.starting ?? undefined;
    this.onRms = opts.onRms ?? null;
    this.ctx = opts.ctx;

    this.starting = (async () => {
      if (!this.ctx?.audioWorklet) throw new Error("AudioWorklet is not available");

      if (opts.existingMediaStreamSource) {
        this.ownsMediaSource = false;
        this.source = opts.existingMediaStreamSource;
        this.stream = opts.stream ?? null;
        const tr = this.stream?.getAudioTracks?.()?.[0];
        if (tr) tr.enabled = true;
      } else {
        this.ownsMediaSource = true;
        this.stream =
          opts.stream ??
          (await navigator.mediaDevices.getUserMedia({
            audio: AUDIO_CONSTRAINTS,
          }));

        const track = this.stream.getAudioTracks?.()[0];
        if (!track || track.readyState === "ended") {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        }

        const activeTrack = this.stream.getAudioTracks?.()[0];
        if (!activeTrack) throw new Error("마이크 오디오 트랙이 없어요(권한/디바이스를 확인해 주세요).");
        activeTrack.enabled = true;

        await this.ctx.resume();
        this.source = this.ctx.createMediaStreamSource(this.stream);
      }

      await this.ctx.resume();

      this.recordingWorklet = (await addNamedWorklet(this.ctx, "yeonun-dcc-audio-recorder-worklet", AUDIO_RECORDING_WORKLET, (ev) => {
        const payload = ev.data as { event?: string; data?: { int16arrayBuffer?: ArrayBuffer } };
        if (payload?.event === "flushDone") {
          const r = this.pendingFlushDone;
          this.pendingFlushDone = null;
          r?.();
          return;
        }
        const arrayBuffer = payload?.data?.int16arrayBuffer;
        if (!arrayBuffer) return;
        const copy = new Uint8Array(arrayBuffer).slice();
        if (copy.byteLength > 0) {
          this.sawAnyChunk = true;
          this.chunks.push(copy);
        }
      })) ?? null;

      this.volumeWorklet = (await addNamedWorklet(this.ctx, "yeonun-dcc-vu-meter", VOLUME_METER_WORKLET, (ev) => {
        const volume = Number((ev.data as { volume?: number })?.volume ?? 0);
        if (Number.isFinite(volume)) this.onRms?.(volume);
      })) ?? null;

      if (!this.recordingWorklet || !this.volumeWorklet) throw new Error("AudioWorkletNode 생성 실패");
      this.source.connect(this.recordingWorklet);
      this.source.connect(this.volumeWorklet);
      this.started = true;
    })();

    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async stopAndGetBase64Pcm16(): Promise<string> {
    if (this.starting) await this.starting.catch(() => undefined);
    const node = this.recordingWorklet;
    if (node?.port) {
      await Promise.race([
        new Promise<void>((resolve) => {
          this.pendingFlushDone = resolve;
          try {
            node.port.postMessage({ event: "flush" });
          } catch {
            resolve();
          }
        }),
        /** 워클릿 응답 실패 시 상한(기존 고정 85ms보다 짧게, 이벤트 우선) */
        new Promise<void>((resolve) => setTimeout(resolve, 72)),
      ]);
      this.pendingFlushDone = null;
    }
    const merged = concatUint8(this.chunks);
    const out = merged.byteLength > 0 ? uint8ToBase64Chunked(merged) : "";
    this.chunks = [];
    this.stop(true);
    return out;
  }

  stop(keepStream = true) {
    const handleStop = () => {
      this.started = false;
      const src = this.source;
      if (src) {
        try {
          if (this.recordingWorklet) src.disconnect(this.recordingWorklet);
        } catch {
          // ignore
        }
        try {
          if (this.volumeWorklet) src.disconnect(this.volumeWorklet);
        } catch {
          // ignore
        }
        if (this.ownsMediaSource) {
          try {
            src.disconnect();
          } catch {
            // ignore
          }
        }
      }
      this.recordingWorklet = null;
      this.volumeWorklet = null;
      this.source = null;
      this.onRms = null;
      if (!keepStream) {
        try {
          this.stream?.getTracks?.().forEach((t) => t.stop());
        } catch {
          // ignore
        }
        this.stream = null;
        this.ctx?.close().catch(() => undefined);
        this.ctx = null;
      }
      this.ownsMediaSource = true;
    };

    if (this.starting) {
      this.starting.then(handleStop).catch(handleStop);
      return;
    }
    handleStop();
  }
}
