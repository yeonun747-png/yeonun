/**
 * Cloudways Node: Anthropic Claude 스트림 → 연운 FortuneStreamModal 계약(SSE).
 * POST /chat 본문: { system, user, model?, max_tokens?, temperature?, order_no? }
 * 환경: ANTHROPIC_API_KEY (필수), PORT, CLOUDWAYS_PROXY_SECRET (선택, 있으면 Bearer 검증)
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
app.timeout = 0;
app.use(
  cors({
    origin: "*",
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "50mb" }));

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(204);
});

function stripCodeFences(input) {
  let html = String(input ?? "").trim();
  const htmlBlockMatch = html.match(/```html\s*([\s\S]*?)\s*```/i);
  if (htmlBlockMatch) return htmlBlockMatch[1].trim();
  const codeBlockMatch = html.match(/```\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  return html;
}

function normalizeHtmlBasics(html) {
  let out = String(html ?? "");
  out = out.replace(/(<\/h3>)\s+(<div class="subtitle-content">)/g, "$1$2");
  out = out.replace(/(<\/h3[^>]*>)\s+(<div[^>]*class="subtitle-content"[^>]*>)/g, "$1$2");
  out = out.replace(/(<br\s*\/?>\s*){2,}/gi, "<br>");
  out = out
    .replace(/([>])\s*(\n\s*)+(\s*<table[^>]*>)/g, "$1$3")
    .replace(/(\n\s*)+(\s*<table[^>]*>)/g, "$2")
    .replace(/([^>\s])\s+(\s*<table[^>]*>)/g, "$1$2")
    .replace(/(<\/(?:p|div|h[1-6]|span|li|td|th)>)\s*(\n\s*)+(\s*<table[^>]*>)/gi, "$1$3")
    .replace(/(>)\s*(\n\s*){2,}(\s*<table[^>]*>)/g, "$1$3");
  out = out.replace(/\*\*/g, "");
  return out;
}

function requireProxySecret(req, res, next) {
  const secret = String(process.env.CLOUDWAYS_PROXY_SECRET || "").trim();
  if (!secret) return next();
  const auth = String(req.headers.authorization || "");
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", engine: "claude", timestamp: new Date().toISOString() });
});

app.post("/chat", requireProxySecret, async (req, res) => {
  req.setTimeout(1_800_000);
  res.setTimeout(1_800_000);

  const ttftDebug = String(process.env.FORTUNE_TTFT_DEBUG || "").trim() === "1";
  const t0 = Date.now();
  const reqId = `${t0.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const ms = () => Date.now() - t0;

  const apiKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY not configured",
      message: "Cloudways Application Settings에 ANTHROPIC_API_KEY를 설정하세요.",
    });
  }

  const system = String(req.body?.system ?? "").trim();
  const user = String(req.body?.user ?? "").trim();
  if (!system || !user) {
    return res.status(400).json({ error: "Invalid request", message: "system and user are required." });
  }

  const model =
    String(req.body?.model || process.env.FORTUNE_CLOUDWAYS_MODEL || "claude-sonnet-4-6").trim() ||
    "claude-sonnet-4-6";
  // 점사 본문이 길더라도 max_tokens를 과도하게 크게 잡으면 비용/시간이 급격히 증가할 수 있음.
  // Cloudways 환경변수에 9만 같은 값이 들어가도 안전 상한으로 제한한다.
  const MAX_TOKENS_HARD_CAP = Math.max(4096, Number(process.env.FORTUNE_MAX_TOKENS_HARD_CAP ?? 24_000) || 24_000);
  const maxTokens = Math.min(
    MAX_TOKENS_HARD_CAP,
    Math.max(1024, Number(req.body?.max_tokens ?? process.env.FORTUNE_MAX_OUTPUT_TOKENS ?? 16_384) || 16_384),
  );
  const temperature =
    typeof req.body?.temperature === "number" && Number.isFinite(req.body.temperature)
      ? req.body.temperature
      : Number(process.env.FORTUNE_TEMPERATURE ?? 0.7) || 0.7;

  const claudeBody = {
    model,
    max_tokens: maxTokens,
    stream: true,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  };

  if (ttftDebug) {
    console.log(
      `[fortune-ttft ${reqId}] [0] request_start ms=${ms()} model=${model} max_tokens=${maxTokens} temp=${temperature} system_chars=${system.length} user_chars=${user.length}`,
    );
  }

  let claudeRes;
  try {
    const tFetchStart = Date.now();
    // 긴 출력(예: 5만자 근처) 시 출력 상한 확장 — https://docs.anthropic.com/claude/docs/beta-headers
    claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "output-300k-2026-03-24",
      },
      body: JSON.stringify(claudeBody),
    });
    if (ttftDebug) {
      console.log(
        `[fortune-ttft ${reqId}] [1] upstream_headers ms=${ms()} fetch_ms=${Date.now() - tFetchStart} status=${claudeRes.status}`,
      );
    }
  } catch (e) {
    return res.status(502).json({
      error: "Claude request failed",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (!claudeRes.ok || !claudeRes.body) {
    const text = await claudeRes.text().catch(() => "");
    return res.status(claudeRes.status || 502).json({
      error: "Claude API error",
      details: text.slice(0, 2000),
    });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  // 중간 프록시(Nginx 등) 버퍼링/변환 방지
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders?.();

  const writeSse = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    // Express가 가진 flush(있으면)로 즉시 네트워크로 밀어냄
    res.flush?.();
  };

  writeSse({ type: "start" });
  if (ttftDebug) {
    writeSse({ type: "debug_timing", id: reqId, phase: "proxy_start", ms: ms() });
  }

  const reader = claudeRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let streamError = null;
  let firstUpstreamDataLineLogged = false;
  let firstProxyChunkLogged = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        if (ttftDebug && !firstUpstreamDataLineLogged) {
          firstUpstreamDataLineLogged = true;
          console.log(`[fortune-ttft ${reqId}] [2] first_upstream_data_line ms=${ms()}`);
          writeSse({ type: "debug_timing", id: reqId, phase: "first_upstream_data_line", ms: ms() });
        }
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;
        let evt;
        try {
          evt = JSON.parse(data);
        } catch {
          continue;
        }
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
          const t = evt.delta.text;
          accumulatedText += t;
          if (ttftDebug && !firstProxyChunkLogged && t.length > 0) {
            firstProxyChunkLogged = true;
            console.log(`[fortune-ttft ${reqId}] [3] first_proxy_chunk ms=${ms()} chunk_len=${t.length}`);
            writeSse({ type: "debug_timing", id: reqId, phase: "first_proxy_chunk", ms: ms(), chunk_len: t.length });
          }
          writeSse({ type: "chunk", text: t, accumulatedLength: accumulatedText.length });
        }
        if (evt.type === "error") {
          streamError = evt.error?.message || JSON.stringify(evt.error || evt);
        }
      }
    }
  } catch (e) {
    streamError = e instanceof Error ? e.message : String(e);
  }

  let cleanHtml = normalizeHtmlBasics(stripCodeFences(accumulatedText));
  const donePayload = {
    type: "done",
    html: cleanHtml,
    isTruncated: false,
    finishReason: "STOP",
  };
  if (streamError) {
    donePayload.streamError = streamError;
  }
  writeSse(donePayload);
  if (ttftDebug) {
    console.log(
      `[fortune-ttft ${reqId}] [4] done ms=${ms()} out_chars=${String(cleanHtml ?? "").length} accumulated_chars=${accumulatedText.length} stream_error=${streamError ? "1" : "0"}`,
    );
    writeSse({
      type: "debug_timing",
      id: reqId,
      phase: "done",
      ms: ms(),
      out_chars: String(cleanHtml ?? "").length,
      accumulated_chars: accumulatedText.length,
      stream_error: Boolean(streamError),
    });
  }
  res.end();
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT);
