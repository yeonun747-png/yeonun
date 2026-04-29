/* eslint-disable no-console */
/**
 * Yeonun Cloudways WS proxy (Gemini Live ONLY).
 *
 * 목적:
 * - 기존 Nginx 설정: location /voice-mvp-ws -> 127.0.0.1:4001 (WS upgrade)
 * - 기존 reunionf82의 client<->proxy 메시지 스키마 유지:
 *   inbound:  {type:"init", model, region?, config?, resumptionHandle?}
 *             {type:"audio", data, mimeType?}
 *             {type:"text", text}
 *             {type:"ping"} {type:"disconnect"}
 *   outbound: {type:"ready"} {type:"audio",data} {type:"text",text}
 *             {type:"transcript",role,text} {type:"interrupted"}
 *             {type:"sessionResumptionUpdate",newHandle,resumable}
 *             {type:"goAway",timeLeft} {type:"error",message,...}
 *
 * 주의:
 * - 이 파일은 "다른 서비스"의 Gemini Live 동작을 보장하기 위한 드롭인 대체물입니다.
 * - OpenAI/xAI/Hume 라우팅은 제거했습니다.
 */

const path = require("path");
const fs = require("fs");
const WebSocket = require("ws");
const { Server: WebSocketServer } = WebSocket;
const { GoogleGenAI } = require("@google/genai");

function loadEnvFile(filename) {
  const envPath = path.join(__dirname, "..", filename);
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const idx = trimmed.indexOf("=");
      if (idx <= 0) return;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = val;
    });
  } catch (e) {
    console.warn("[vertex-live-proxy][gemini-only] loadEnv", filename, e?.message);
  }
}

// 로컬/프로덕션 공통: .env.local 우선
loadEnvFile(".env.local");
loadEnvFile(".env");

const PORT = Number(process.env.VERTEX_LIVE_PROXY_PORT || 4001);
const PROJECT = String(process.env.GOOGLE_CLOUD_PROJECT || "").trim();
const LOCATION = String(process.env.GOOGLE_CLOUD_LOCATION || "asia-northeast3").trim();

if (!PROJECT) {
  console.error("[vertex-live-proxy][gemini-only] GOOGLE_CLOUD_PROJECT 환경 변수가 필요합니다.");
  process.exit(1);
}

// 기본 모델(다른 서비스 호환 보장)
const GEMINI_DEFAULT_MODEL = "gemini-live-2.5-flash-native-audio";
const GEMINI_UNSUPPORTED_LIVE_MODELS = new Set(["gemini-2.0-flash-exp"]);

function normalizeConfig(cfg) {
  const responseModalities = Array.isArray(cfg?.responseModalities) ? cfg.responseModalities : ["AUDIO"];
  return {
    ...cfg,
    responseModalities,
    proactivity: cfg?.proactivity ?? { proactiveAudio: true },
    contextWindowCompression: cfg?.contextWindowCompression ?? { slidingWindow: {} },
    sessionResumption: cfg?.sessionResumption ?? {},
    outputAudioTranscription: cfg?.outputAudioTranscription ?? {},
    inputAudioTranscription: cfg?.inputAudioTranscription ?? {},
  };
}

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws) => {
  let liveSession = null;
  let connected = false;

  const send = (payload) => {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  };

  const callbacks = {
    onopen: () => {
      connected = true;
      send({ type: "ready" });
    },
    onmessage: (msg) => {
      try {
        // session resumption handle 전달
        const resumption = msg?.sessionResumptionUpdate;
        if (resumption && (resumption.newHandle || resumption.resumable === false)) {
          send({
            type: "sessionResumptionUpdate",
            newHandle: resumption.newHandle || "",
            resumable: resumption.resumable !== false,
          });
        }
        // Vertex goAway 전달
        if (msg?.goAway != null) {
          const timeLeft = msg.goAway?.time_left ?? msg.goAway?.timeLeft ?? 60;
          send({ type: "goAway", timeLeft });
        }

        const turn = msg?.serverContent?.modelTurn;
        const parts = turn?.parts || [];
        const texts = [];
        for (const part of parts) {
          if (typeof part?.text === "string") texts.push(part.text);
          const inline = part?.inlineData?.data;
          if (inline) send({ type: "audio", data: inline });
        }
        if (texts.length > 0) send({ type: "text", text: texts.join("\n") });
        if (msg?.serverContent?.interrupted) send({ type: "interrupted" });

        // 전사 전달 (assistant/user)
        const sc = msg?.serverContent;
        const outputTranscript = sc?.outputTranscription?.text || msg?.outputTranscription?.text;
        if (typeof outputTranscript === "string" && outputTranscript.trim()) {
          send({ type: "transcript", role: "assistant", text: outputTranscript.trim() });
        }
        const inputTranscript = sc?.inputTranscription?.text || msg?.inputTranscription?.text;
        if (typeof inputTranscript === "string" && inputTranscript.trim()) {
          send({ type: "transcript", role: "user", text: inputTranscript.trim() });
        }
      } catch {
        // ignore
      }
    },
    onerror: (e) => {
      console.error("[vertex-live-proxy][gemini-only] onerror:", e?.message || e);
      send({ type: "error", message: e?.message || "Live 오류" });
    },
    onclose: (evt) => {
      connected = false;
      const code = evt?.code ?? null;
      const reason = evt?.reason ?? "";
      console.log("[vertex-live-proxy][gemini-only] onclose code=%s reason=%s", code, reason);
      send({
        type: "error",
        message: "Live 연결 종료",
        code: "SESSION_END",
        hint: "세션 제한 또는 네트워크로 종료됐을 수 있습니다. 다시 연결해 주세요.",
      });
    },
  };

  ws.on("message", async (message) => {
    try {
      const parsed = JSON.parse(String(message || "{}"));

      if (parsed.type === "ping") {
        // Gemini Live는 별도 ping이 필요 없지만, 클라이언트 디버그용
        send({ type: "text", text: "pong" });
        return;
      }

      if (parsed.type === "init") {
        const requested = String(parsed.model || "").replace(/^models\//, "").trim();
        const region = String(parsed.region || "").trim() || LOCATION;
        const rawConfig = parsed.config || {};
        const config = normalizeConfig(rawConfig);
        if (String(parsed.resumptionHandle || "").trim()) {
          config.sessionResumption = { ...config.sessionResumption, handle: String(parsed.resumptionHandle).trim() };
        }

        const model = requested || GEMINI_DEFAULT_MODEL;
        const geminiModel = GEMINI_UNSUPPORTED_LIVE_MODELS.has(model) ? GEMINI_DEFAULT_MODEL : model;
        if (geminiModel !== model) {
          console.warn(`[vertex-live-proxy][gemini-only] Unsupported model "${model}" -> "${geminiModel}"`);
        }

        console.log("[vertex-live-proxy][gemini-only] init model=%s region=%s", geminiModel, region);
        try {
          const aiClient = new GoogleGenAI({ vertexai: true, project: PROJECT, location: region });
          liveSession = await aiClient.live.connect({ model: geminiModel, config, callbacks });
          console.log("[vertex-live-proxy][gemini-only] connected OK");
        } catch (err) {
          console.error("[vertex-live-proxy][gemini-only] connect error:", err?.message || err);
          send({ type: "error", message: err?.message || "Vertex 연결 실패" });
        }
        return;
      }

      if (parsed.type === "audio") {
        if (!connected || !liveSession) return;
        const mimeType = String(parsed.mimeType || "audio/pcm;rate=16000");
        const data = String(parsed.data || "");
        if (!data) return;
        if (typeof liveSession.sendRealtimeInput === "function") {
          liveSession.sendRealtimeInput({ audio: { mimeType, data } });
        } else if (typeof liveSession.send === "function") {
          // 구버전 SDK 호환
          liveSession.send({ mimeType, data });
        }
        return;
      }

      if (parsed.type === "text") {
        if (!connected || !liveSession) return;
        const text = String(parsed.text || "");
        if (!text.trim()) return;
        liveSession.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
        return;
      }

      if (parsed.type === "disconnect") {
        ws.close();
      }
    } catch (e) {
      console.error("[vertex-live-proxy][gemini-only] message error:", e?.message || e);
    }
  });

  ws.on("close", () => {
    console.log("[vertex-live-proxy][gemini-only] client closed");
    try {
      liveSession?.close?.();
    } catch {
      // ignore
    }
  });
});

console.log(`[vertex-live-proxy][gemini-only] ws server listening on :${PORT}`);

