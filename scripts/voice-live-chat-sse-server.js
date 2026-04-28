/**
 * Yeonun voice "interrupted" SSE server (Cloudways Node:3000 behind /chat proxy).
 *
 * 목표:
 * - Cloudways에서 이미 프록시된 `/chat` 경로만 활용 (추가 Nginx 설정 없이)
 * - 브라우저는 SSE로 interrupted 이벤트를 수신
 * - 브라우저는 AudioWorklet로 마이크 PCM16(base64)을 HTTP POST로 업로드
 *
 * Endpoints (all under /chat to reuse existing proxy):
 * - GET  /chat/voice/events?session_id=...   (SSE)
 * - POST /chat/voice/audio                  (JSON: {session_id, data(base64 pcm16le), ai_speaking?: boolean})
 * - POST /chat/voice/ai_speaking            (JSON: {session_id, value: boolean})
 *
 * NOTE:
 * - 이 서버는 "모델 기반 interrupt"가 아니라 서버 VAD 기반 interrupt를 제공합니다.
 * - Cloudways 프록시가 SSE는 지원하지만 WS upgrade가 없을 때를 대비한 설계입니다.
 */

const http = require("http");
const { URL } = require("url");

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += String(c)));
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function nowIso() {
  return new Date().toISOString();
}

function rmsFromPcm16le(buf) {
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
  let speech = false;
  let above = 0;
  let below = 0;
  let lastFireAt = 0;

  const THRESH_ON = Number(process.env.VOICE_VAD_ON || "0.018");
  const THRESH_OFF = Number(process.env.VOICE_VAD_OFF || "0.012");
  const FRAMES_ON = Number(process.env.VOICE_VAD_FRAMES_ON || "3");
  const FRAMES_OFF = Number(process.env.VOICE_VAD_FRAMES_OFF || "10");
  const MIN_GAP_MS = Number(process.env.VOICE_VAD_MIN_GAP_MS || "900");

  return {
    feed(rms) {
      const t = Date.now();
      if (!speech) {
        if (rms >= THRESH_ON) {
          above += 1;
          if (above >= FRAMES_ON) {
            above = 0;
            below = 0;
            speech = true;
            if (t - lastFireAt >= MIN_GAP_MS) {
              lastFireAt = t;
              return "speech_start";
            }
          }
        } else {
          above = 0;
        }
      } else {
        if (rms <= THRESH_OFF) {
          below += 1;
          if (below >= FRAMES_OFF) {
            below = 0;
            above = 0;
            speech = false;
            return "speech_end";
          }
        } else {
          below = 0;
        }
      }
      return null;
    },
  };
}

// session_id -> { res: ServerResponse, aiSpeaking: boolean, vad }
const sessions = new Map();

function sseSend(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

const PORT = Number(process.env.PORT || process.env.VOICE_LIVE_HTTP_PORT || "3000");

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const path = u.pathname;

  if (path === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }

  if (req.method === "GET" && path === "/chat/voice/events") {
    const sessionId = String(u.searchParams.get("session_id") || "").trim();
    if (!sessionId) return json(res, 400, { error: "session_id is required" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    sseSend(res, { type: "ready", t: nowIso() });

    const prev = sessions.get(sessionId);
    if (prev?.res && prev.res !== res) {
      try {
        sseSend(prev.res, { type: "bye", reason: "replaced" });
        prev.res.end();
      } catch {
        /* ignore */
      }
    }
    sessions.set(sessionId, { res, aiSpeaking: false, vad: createVad() });

    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* ignore */
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(ping);
      const cur = sessions.get(sessionId);
      if (cur?.res === res) sessions.delete(sessionId);
    });
    return;
  }

  if (req.method === "POST" && path === "/chat/voice/ai_speaking") {
    const body = await readJson(req);
    const sessionId = String(body.session_id || "").trim();
    const value = !!body.value;
    const s = sessions.get(sessionId);
    if (s) s.aiSpeaking = value;
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && path === "/chat/voice/audio") {
    const body = await readJson(req);
    const sessionId = String(body.session_id || "").trim();
    const data = typeof body.data === "string" ? body.data : "";
    const aiSpeaking = body.ai_speaking != null ? !!body.ai_speaking : null;
    const s = sessions.get(sessionId);
    if (s && aiSpeaking != null) s.aiSpeaking = aiSpeaking;
    if (!s || !s.res) return json(res, 200, { ok: true, ignored: true });

    let buf;
    try {
      buf = Buffer.from(data, "base64");
    } catch {
      return json(res, 200, { ok: true, ignored: true });
    }
    const rms = rmsFromPcm16le(buf);
    const ev = s.vad.feed(rms);
    if (ev === "speech_start" && s.aiSpeaking) {
      try {
        sseSend(s.res, { type: "interrupted", reason: "vad_speech_start", rms, t: nowIso() });
      } catch {
        /* ignore */
      }
    }
    return json(res, 200, { ok: true });
  }

  // 다른 기존 /chat 라우트와 충돌하지 않도록 여기서는 404 처리.
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("not found");
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[voice-chat-sse] listening on :${PORT} (SSE: /chat/voice/events)`);
});

