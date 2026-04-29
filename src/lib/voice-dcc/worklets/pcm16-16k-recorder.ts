export const PCM16_16K_RECORDER_WORKLET = `
class Pcm16Recorder16kWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inRate = sampleRate || 48000;
    this._outRate = 16000;
    this._ratio = this._inRate / this._outRate;
    this._t = 0;
    this._buf = [];
    this._bufLen = 0;
    this._rmsSum = 0;
    this._rmsN = 0;
    this._target = 8192;

    this.port.onmessage = (ev) => {
      try {
        const t = ev?.data?.type;
        if (t === 'flush') this._flush();
      } catch (_) {}
    };
  }

  _flush() {
    if (this._bufLen <= 0) return;
    const out = new Int16Array(this._bufLen);
    let off = 0;
    for (let i = 0; i < this._buf.length; i++) {
      out.set(this._buf[i], off);
      off += this._buf[i].length;
    }
    this._buf = [];
    this._bufLen = 0;
    const rms = this._rmsN > 0 ? Math.sqrt(this._rmsSum / this._rmsN) : 0;
    this._rmsSum = 0;
    this._rmsN = 0;
    this.port.postMessage({ type: 'chunk', int16arrayBuffer: out.buffer, rms }, [out.buffer]);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];
    if (!ch0) return true;

    // downsample float32 -> int16 @16k
    const inN = ch0.length;
    const outN = Math.max(0, Math.floor((inN - 1 - this._t) / this._ratio));
    if (outN <= 0) return true;
    const pcm = new Int16Array(outN);
    for (let i = 0; i < outN; i++) {
      const idx = this._t + i * this._ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(inN - 1, i0 + 1);
      const frac = idx - i0;
      const s = (1 - frac) * ch0[i0] + frac * ch0[i1];
      let v = s;
      if (v > 1) v = 1;
      else if (v < -1) v = -1;
      pcm[i] = v < 0 ? Math.round(v * 32768) : Math.round(v * 32767);
      this._rmsSum += v * v;
    }
    this._rmsN += outN;

    // carry fractional position into next block
    this._t = (this._t + inN) % this._ratio;

    this._buf.push(pcm);
    this._bufLen += pcm.length;
    if (this._bufLen >= this._target) this._flush();
    return true;
  }
}

registerProcessor('pcm16-16k-recorder-v1', Pcm16Recorder16kWorklet);
`;

