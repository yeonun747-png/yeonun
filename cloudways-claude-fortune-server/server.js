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
  const maxTokens = Math.min(
    200_000,
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

  let claudeRes;
  try {
    claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(claudeBody),
    });
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
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders?.();

  const writeSse = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
  };

  writeSse({ type: "start" });

  const reader = claudeRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let streamError = null;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
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
  res.end();
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT);
