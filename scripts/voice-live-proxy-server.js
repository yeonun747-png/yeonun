/**
 * Yeonun voice live proxy (Cloudways/Node).
 *
 * 역할:
 * - 브라우저(AudioWorklet)에서 오는 PCM16(base64)을 WebSocket으로 수신
 * - 서버 측 간단 VAD로 "사용자 발화 시작"을 감지
 * - 클라이언트가 "AI가 말하는 중"이라고 알려준 상태(ai_speaking=true)일 때
 *   발화 시작을 감지하면 { type: "interrupted" } 를 클라로 전송
 *
 * NOTE:
 * - reunionf82의 Live 모델처럼 "모델이 interrupt를 판정"하는 수준은 아니고,
 *   서버에서 확정적으로 VAD 판정 후 신호를 내려주는 구조로 바지인 품질을 끌어올린다.
 */

const http = require("http");
const { WebSocketServer } = require("ws");

function nowIso() {
  return new Date().toISOString();
}

function rmsFromPcm16le(buf) {
  // buf: Buffer (little-endian int16)
  const len = Math.floor(buf.length / 2);
  if (len <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const s = buf.readInt16LE(i * 2);
    const v = s / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / len);
}

function createVad() {
  // 아주 단순하지만 안정적인 히스테리시스 + hold 방식
  let speech = false;
  let aboveCount = 0;
  let belowCount = 0;
  let lastSpeechStartAt = 0;

  // 튜닝 포인트 (Cloudways/마이크 환경에 따라 조절)
  const THRESH_ON = Number(process.env.VOICE_VAD_ON || "0.018"); // RMS
  const THRESH_OFF = Number(process.env.VOICE_VAD_OFF || "0.012");
  const FRAMES_ON = Number(process.env.VOICE_VAD_FRAMES_ON || "3"); // 연속 프레임
  const FRAMES_OFF = Number(process.env.VOICE_VAD_FRAMES_OFF || "10");
  const MIN_GAP_MS = Number(process.env.VOICE_VAD_MIN_GAP_MS || "900"); // interrupted 스팸 방지

  return {
    get speech() {
      return speech;
    },
    feed(rms) {
      const t = Date.now();
      if (!speech) {
        if (rms >= THRESH_ON) {
          aboveCount += 1;
          if (aboveCount >= FRAMES_ON) {
            aboveCount = 0;
            belowCount = 0;
            speech = true;
            const canFire = t - lastSpeechStartAt >= MIN_GAP_MS;
            if (canFire) lastSpeechStartAt = t;
            return canFire ? "speech_start" : null;
          }
        } else {
          aboveCount = 0;
        }
      } else {
        if (rms <= THRESH_OFF) {
          belowCount += 1;
          if (belowCount >= FRAMES_OFF) {
            belowCount = 0;
            aboveCount = 0;
            speech = false;
            return "speech_end";
          }
        } else {
          belowCount = 0;
        }
      }
      return null;
    },
  };
}

const PORT = Number(process.env.VOICE_LIVE_PROXY_PORT || "8787");
const PATH = String(process.env.VOICE_LIVE_PROXY_PATH || "/voice-live").trim() || "/voice-live";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("yeonun voice live proxy ok\n");
});

const wss = new WebSocketServer({ server, path: PATH });

wss.on("connection", (ws, req) => {
  const vad = createVad();
  let aiSpeaking = false;

  ws.send(JSON.stringify({ type: "ready", t: nowIso() }));

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw || "{}"));
    } catch {
      return;
    }

    if (msg?.type === "ai_speaking") {
      aiSpeaking = !!msg?.value;
      return;
    }

    if (msg?.type === "audio" && typeof msg?.data === "string") {
      let buf;
      try {
        buf = Buffer.from(msg.data, "base64");
      } catch {
        return;
      }
      const rms = rmsFromPcm16le(buf);
      const ev = vad.feed(rms);
      if (ev === "speech_start" && aiSpeaking) {
        ws.send(JSON.stringify({ type: "interrupted", reason: "vad_speech_start", rms, t: nowIso() }));
      }
      return;
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[voice-live-proxy] listening on :${PORT}${PATH}`);
});

