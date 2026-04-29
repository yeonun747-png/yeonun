"use client";

function base64ToUint8(base64: string) {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out;
}

function pcm16leBase64ToFloat32(base64: string) {
  const u8 = base64ToUint8(base64);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = Math.floor(u8.byteLength / 2);
  const f32 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = dv.getInt16(i * 2, true);
    f32[i] = Math.max(-1, Math.min(1, s / 32768));
  }
  return f32;
}

/**
 * 서버에서 내려오는 PCM16LE(base64)를 브라우저에서 끊김 없이 이어 재생한다.
 * - 버퍼 큐를 쌓고 AudioBufferSourceNode를 예약 재생한다.
 * - interrupted 수신 시 stop()으로 즉시 중단 가능.
 */
export type VoiceLiveAudioStreamerOpts = {
  onActiveChange?: (active: boolean) => void;
  onOutputLevel?: (level: number) => void;
  /**
   * 스트리밍 TTS에서 청크 사이 네트워크 공백(ms). 모바일·셀룰러에서 짧으면 재생 중인데도 active가 꺼져 VAD/UI가 "내 턴"으로 오인함.
   * @default 360
   */
  streamingGapGraceMs?: number;
};

export class VoiceLiveAudioStreamer {
  private ctx: AudioContext;
  private gain: GainNode;
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array | null = null;
  private levelRaf: number | null = null;
  private nextStartAt = 0;
  private alive = true;
  private active = false;
  private nodes = new Set<AudioBufferSourceNode>();
  private onActiveChange: ((active: boolean) => void) | null = null;
  private onOutputLevel: ((level: number) => void) | null = null;
  private streamingGapGraceMs: number;
  /** 청크 사이 NDJSON 지연 동안 onActiveChange(false)가 잠깐 나가 VAD/UI가 흔들리지 않게 함 */
  /** 브라우저: setTimeout 핸들은 number (Node의 Timeout 타입과 구분) */
  private pendingInactiveTimer: number | null = null;
  /** 이번 재생 세션 첫 AudioBufferSource의 startAt(스케줄된 큐 길이·남은 비율 계산용) */
  private playbackAnchorAt: number | null = null;

  constructor(ctx: AudioContext, opts?: VoiceLiveAudioStreamerOpts) {
    this.ctx = ctx;
    this.onActiveChange = opts?.onActiveChange ?? null;
    this.onOutputLevel = opts?.onOutputLevel ?? null;
    this.streamingGapGraceMs = Math.max(120, Math.min(900, Number(opts?.streamingGapGraceMs ?? 360)));
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1.25; // 체감 볼륨(기기별 편차 보정)
    if (this.onOutputLevel) {
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.38;
      this.levelBuf = new Float32Array(this.analyser.fftSize);
      this.gain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.startOutputLevelLoop();
    } else {
      this.gain.connect(this.ctx.destination);
    }
    this.nextStartAt = Math.max(this.ctx.currentTime + 0.03, this.nextStartAt);
  }

  private startOutputLevelLoop() {
    if (!this.onOutputLevel || !this.analyser || !this.levelBuf) return;
    let lastSent = -1;
    const tick = () => {
      if (!this.alive) return;
      this.levelRaf = requestAnimationFrame(tick);
      const a = this.analyser!;
      const buf = this.levelBuf!;
      (a as any).getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i];
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.max(0, Math.min(1, rms * 4.2));
      if (Math.abs(level - lastSent) > 0.012 || (level < 0.025 && lastSent >= 0.03)) {
        lastSent = level;
        this.onOutputLevel?.(level);
      }
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  private setActive(active: boolean) {
    if (this.active === active) return;
    this.active = active;
    this.onActiveChange?.(active);
  }

  private cancelPendingInactive() {
    if (this.pendingInactiveTimer != null) {
      clearTimeout(this.pendingInactiveTimer);
      this.pendingInactiveTimer = null;
    }
  }

  isActive() {
    return this.active;
  }

  /**
   * 스케줄된 PCM 큐 기준 남은 재생 비율(1=막 시작·전부 남음, 0=큐 끝까지 타임라인 소진).
   * 스트리밍으로 청크가 늘면 분모가 커져 막대가 잠깐 길어질 수 있음(아직 도착 안 한 음성 반영).
   */
  getTtsRemainingFraction(): number | null {
    if (!this.alive || this.playbackAnchorAt == null) return null;
    const span = this.nextStartAt - this.playbackAnchorAt;
    if (span < 0.018) return null;
    const elapsed = Math.max(0, this.ctx.currentTime - this.playbackAnchorAt);
    const played = Math.min(1, elapsed / span);
    return Math.max(0, Math.min(1, 1 - played));
  }

  pushPcm16Base64(base64: string, sampleRate?: number) {
    if (!this.alive) return;
    this.cancelPendingInactive();
    const sr = Number(sampleRate || 24000);
    const f32 = pcm16leBase64ToFloat32(base64);
    if (f32.length <= 0) return;
    try {
      // autoplay 정책/일시정지에서 복귀
      this.ctx.resume?.();
    } catch {
      // ignore
    }

    const buf = this.ctx.createBuffer(1, f32.length, sr);
    buf.copyToChannel(f32, 0, 0);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.gain);
    this.nodes.add(src);
    this.setActive(true);
    src.onended = () => {
      this.nodes.delete(src);
      if (this.nodes.size === 0) {
        this.cancelPendingInactive();
        const waitMs = Math.max(64, Math.ceil(Math.max(0, this.nextStartAt - this.ctx.currentTime) * 1000) + 88);
        this.pendingInactiveTimer = window.setTimeout(() => {
          this.pendingInactiveTimer = null;
          if (this.alive && this.nodes.size === 0 && this.ctx.currentTime >= this.nextStartAt - 0.03) {
            this.setActive(false);
          }
        }, waitMs + this.streamingGapGraceMs);
      }
    };

    const startAt = Math.max(this.ctx.currentTime + 0.01, this.nextStartAt);
    if (this.playbackAnchorAt == null) {
      this.playbackAnchorAt = startAt;
    }
    src.start(startAt);
    this.nextStartAt = startAt + buf.duration;
  }

  stop() {
    this.alive = false;
    this.playbackAnchorAt = null;
    this.cancelPendingInactive();
    if (this.levelRaf != null) {
      try {
        cancelAnimationFrame(this.levelRaf);
      } catch {
        // ignore
      }
      this.levelRaf = null;
    }
    this.onOutputLevel?.(0);
    for (const n of Array.from(this.nodes)) {
      try {
        n.stop();
      } catch {
        // ignore
      }
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    }
    this.nodes.clear();
    this.setActive(false);
    try {
      this.analyser?.disconnect();
    } catch {
      // ignore
    }
    try {
      this.gain.disconnect();
    } catch {
      // ignore
    }
    this.analyser = null;
    this.levelBuf = null;
    // 재생 재시작 시 타임라인을 현재로 리셋
    this.nextStartAt = Math.max(this.ctx.currentTime + 0.03, 0);
  }
}

