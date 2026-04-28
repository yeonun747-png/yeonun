export const PCM16_RECORDER_WORKLET = `
class Pcm16RecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._bufLen = 0;
    this._rmsSum = 0;
    this._rmsN = 0;
    // NOTE: HTTP POST로 업로드하는 A안에서는 너무 촘촘한 청크(20ms)가 과도한 요청을 만들고
    // 브라우저 메인스레드/STT에 영향을 줄 수 있다. (chunk를 크게 해서 요청 빈도 감소)
    // 입력 sampleRate는 브라우저/기기마다 달라질 수 있으므로 "샘플 수" 기준으로 완만하게 잡는다.
    this._target = 8192;
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

    // 평균 RMS도 함께 전달 (바지인 트리거 안정화)
    const rms = this._rmsN > 0 ? Math.sqrt(this._rmsSum / this._rmsN) : 0;
    this._rmsSum = 0;
    this._rmsN = 0;

    // Int16Array -> ArrayBuffer 전달 (메인 스레드에서 base64 변환)
    this.port.postMessage({ type: 'chunk', int16arrayBuffer: out.buffer, rms }, [out.buffer]);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch0 = input[0];
    if (!ch0) return true;

    // float32 [-1,1] -> int16 (+ RMS 누적)
    const n = ch0.length;
    const pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      let s = ch0[i];
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      pcm[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      this._rmsSum += s * s;
    }
    this._rmsN += n;

    this._buf.push(pcm);
    this._bufLen += pcm.length;
    if (this._bufLen >= this._target) {
      this._flush();
    }
    return true;
  }
}

// v2: 이전 워크릿 캐시를 회피하기 위해 이름을 변경
registerProcessor('pcm16-recorder-v2', Pcm16RecorderWorklet);
`;

