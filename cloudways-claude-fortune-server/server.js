/**
 * Cloudways Node: Anthropic Claude 스트림 → 연운 FortuneStreamModal 계약(SSE).
 * POST /chat 본문: { system, user, model?, max_tokens?, temperature?, order_no? }
 * 환경: ANTHROPIC_API_KEY (필수), PORT, CLOUDWAYS_PROXY_SECRET (선택, 있으면 Bearer 검증)
 *
 * 장시간 응답: app.timeout = 0 이고, 앞단 Nginx에서 proxy_read/send_timeout 을 1800s(30분) 등으로 두는 전제.
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

function resolveClaudeParams(reqBody) {
  const model =
    String(reqBody?.model || process.env.FORTUNE_CLOUDWAYS_MODEL || "claude-sonnet-4-6").trim() ||
    "claude-sonnet-4-6";
  const MAX_TOKENS_HARD_CAP = Math.max(4096, Number(process.env.FORTUNE_MAX_TOKENS_HARD_CAP ?? 24_000) || 24_000);
  const maxTokens = Math.min(
    MAX_TOKENS_HARD_CAP,
    Math.max(1024, Number(reqBody?.max_tokens ?? process.env.FORTUNE_MAX_OUTPUT_TOKENS ?? 16_384) || 16_384),
  );
  const temperature =
    typeof reqBody?.temperature === "number" && Number.isFinite(reqBody.temperature)
      ? reqBody.temperature
      : Number(process.env.FORTUNE_TEMPERATURE ?? 0.7) || 0.7;
  return { model, maxTokens, temperature };
}

async function anthropicMessagesStreamResponse(apiKey, reqBody, system, user, ttftCtx) {
  const { model, maxTokens, temperature } = resolveClaudeParams(reqBody);
  const claudeBody = {
    model,
    max_tokens: maxTokens,
    stream: true,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  };

  const { ttftDebug, reqId, ms } = ttftCtx || {};
  if (ttftDebug && reqId) {
    console.log(
      `[fortune-ttft ${reqId}] [0] request_start ms=${ms()} model=${model} max_tokens=${maxTokens} temp=${temperature} system_chars=${system.length} user_chars=${user.length}`,
    );
  }

  let claudeRes;
  try {
    const tFetchStart = Date.now();
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
    if (ttftDebug && reqId) {
      console.log(
        `[fortune-ttft ${reqId}] [1] upstream_headers ms=${ms()} fetch_ms=${Date.now() - tFetchStart} status=${claudeRes.status}`,
      );
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }

  if (!claudeRes.ok || !claudeRes.body) {
    const text = await claudeRes.text().catch(() => "");
    throw new Error(text.slice(0, 800) || `Claude HTTP ${claudeRes.status}`);
  }

  return claudeRes;
}

async function readClaudeSseToHtml(reader, { onTextDelta, ttftCtx }) {
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let streamError = null;
  let firstUpstreamDataLineLogged = false;
  let firstProxyChunkLogged = false;
  const { ttftDebug, reqId, ms, writeSse } = ttftCtx || {};

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        if (ttftDebug && writeSse && reqId && !firstUpstreamDataLineLogged) {
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
          if (typeof onTextDelta === "function") onTextDelta(t);
          if (ttftDebug && writeSse && reqId && !firstProxyChunkLogged && t.length > 0) {
            firstProxyChunkLogged = true;
            console.log(`[fortune-ttft ${reqId}] [3] first_proxy_chunk ms=${ms()} chunk_len=${t.length}`);
            writeSse({ type: "debug_timing", id: reqId, phase: "first_proxy_chunk", ms: ms(), chunk_len: t.length });
          }
        }
        if (evt.type === "error") {
          streamError = evt.error?.message || JSON.stringify(evt.error || evt);
        }
      }
    }
  } catch (e) {
    streamError = e instanceof Error ? e.message : String(e);
  }

  const cleanHtml = normalizeHtmlBasics(stripCodeFences(accumulatedText));
  return { html: cleanHtml, streamError };
}

function countHangulChars(html) {
  const text = String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length;
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

  /** 연운 메뉴 점사: Vercel에서 섹션 루프 대신 Cloudways에서 순차 생성 → 단일 SSE (reunion stream-proxy 패턴). */
  const menuSections = req.body?.fortune_menu_sections;
  const menuMeta = req.body?.fortune_menu_meta;
  const menuToc = req.body?.fortune_menu_toc;
  if (
    Array.isArray(menuSections) &&
    menuSections.length > 0 &&
    menuMeta &&
    typeof menuMeta === "object" &&
    menuToc &&
    typeof menuToc === "object" &&
    Array.isArray(menuToc.sections)
  ) {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders?.();

    const writeSse = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
      res.flush?.();
    };

    try {
      writeSse(menuMeta);
      writeSse(menuToc);
      let totalChars = 0;
      for (let i = 0; i < menuSections.length; i++) {
        const sec = menuSections[i];
        const system = String(sec?.system ?? "").trim();
        const user = String(sec?.user ?? "").trim();
        const subtitleTitle = String(sec?.subtitle_title ?? "").trim() || `섹션 ${i + 1}`;
        writeSse({ type: "section_start", index: i });
        try {
          const claudeRes = await anthropicMessagesStreamResponse(apiKey, req.body, system, user, null);
          const { html, streamError } = await readClaudeSseToHtml(claudeRes.body.getReader(), {
            onTextDelta: (delta) => writeSse({ type: "chunk", index: i, html: delta }),
            ttftCtx: null,
          });
          if (streamError) {
            writeSse({ type: "error", message: streamError });
          }
          const safe =
            html.trim() ||
            '<div class="subtitle-section"><h3 class="subtitle-title"></h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>';
          writeSse({ type: "section_replace", index: i, html: safe });
          totalChars += Math.max(countHangulChars(safe), 1);
        } catch (e) {
          writeSse({
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          });
          const errHtml = `<div class="subtitle-section"><h3 class="subtitle-title">${subtitleTitle}</h3><div class="subtitle-content"><p>이 구간 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.</p></div></div>`;
          writeSse({ type: "section_replace", index: i, html: errHtml });
          totalChars += 40;
        }
        writeSse({ type: "section_end", index: i });
      }
      writeSse({ type: "done", charCount: Math.max(totalChars, 120) });
    } catch (e) {
      writeSse({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    res.end();
    return;
  }

  const system = String(req.body?.system ?? "").trim();
  const user = String(req.body?.user ?? "").trim();
  if (!system || !user) {
    return res.status(400).json({ error: "Invalid request", message: "system and user are required." });
  }

  let claudeRes;
  try {
    claudeRes = await anthropicMessagesStreamResponse(apiKey, req.body, system, user, { ttftDebug, reqId, ms });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({
      error: "Claude request failed",
      message: msg,
    });
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders?.();

  const writeSse = (obj) => {
    res.write(`data: ${JSON.stringify(obj)}\n\n`);
    res.flush?.();
  };

  writeSse({ type: "start" });
  if (ttftDebug) {
    writeSse({ type: "debug_timing", id: reqId, phase: "proxy_start", ms: ms() });
  }

  let accLen = 0;
  const { html: cleanHtml, streamError } = await readClaudeSseToHtml(claudeRes.body.getReader(), {
    onTextDelta: (t) => {
      accLen += t.length;
      writeSse({ type: "chunk", text: t, accumulatedLength: accLen });
    },
    ttftCtx: { ttftDebug, reqId, ms, writeSse },
  });

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
      `[fortune-ttft ${reqId}] [4] done ms=${ms()} out_chars=${String(cleanHtml ?? "").length} accumulated_chars=${accLen} stream_error=${streamError ? "1" : "0"}`,
    );
    writeSse({
      type: "debug_timing",
      id: reqId,
      phase: "done",
      ms: ms(),
      out_chars: String(cleanHtml ?? "").length,
      accumulated_chars: accLen,
      stream_error: Boolean(streamError),
    });
  }
  res.end();
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT);
