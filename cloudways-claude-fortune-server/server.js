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
function cloudwaysAllowedOrigins() {
  const raw = String(process.env.CLOUDWAYS_CORS_ORIGINS ?? "").trim();
  const fromEnv = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["https://www.yeonun.com", "https://yeonun.com"];
  if (process.env.NODE_ENV !== "production") {
    fromEnv.push("http://localhost:3000", "http://127.0.0.1:3000");
  }
  return [...new Set(fromEnv)];
}

const allowedOrigins = cloudwaysAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"));
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "50mb" }));

app.options("*", (req, res) => {
  const origin = String(req.headers.origin ?? "");
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
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

function verifyFortuneStreamToken(token) {
  const crypto = require("crypto");
  const secret = String(process.env.CLOUDWAYS_PROXY_SECRET || "").trim();
  if (!secret || !token) return false;
  const parts = String(token).trim().split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    return typeof payload.exp === "number" && Date.now() <= payload.exp;
  } catch {
    return false;
  }
}

function requireProxySecret(req, res, next) {
  const secret = String(process.env.CLOUDWAYS_PROXY_SECRET || "").trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "CLOUDWAYS_PROXY_SECRET is not configured" });
    }
    return next();
  }
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer === secret || verifyFortuneStreamToken(bearer)) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

/** @param {unknown} raw */
function coerceAnthropicSystem(raw) {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s.length ? s : null;
  }
  if (Array.isArray(raw)) {
    return raw.length ? raw : null;
  }
  const s = String(raw).trim();
  return s.length ? s : null;
}

/** 데스크톱 server.js와 동일: 프롬프트 캐시 + output 300k. 400 시 `ANTHROPIC_BETA=prompt-caching-2024-07-31` 만 설정 */
function anthropicBetaHeader() {
  const env = String(process.env.ANTHROPIC_BETA ?? "").trim();
  if (env) return env;
  const parts = ["prompt-caching-2024-07-31", "output-300k-2026-03-24"];
  return parts.join(",");
}

function systemCharsForLog(system) {
  if (typeof system === "string") return system.length;
  if (!Array.isArray(system)) return 0;
  return system.reduce((n, b) => {
    if (b && typeof b === "object" && typeof b.text === "string") return n + b.text.length;
    return n;
  }, 0);
}

/** @param {Record<string, unknown>} evt */
function tryLogPromptCacheUsage(evt, opts) {
  const { onceRef } = opts || {};
  if (!evt || typeof evt !== "object") return;
  const u =
    "usage" in evt && evt.usage && typeof evt.usage === "object"
      ? evt.usage
      : "message" in evt && evt.message && typeof evt.message === "object" && "usage" in evt.message
        ? evt.message.usage
        : null;
  if (!u || typeof u !== "object") return;
  const cr = u.cache_read_input_tokens;
  if (typeof cr !== "number" || cr <= 0) return;
  if (onceRef && onceRef.logged) return;
  if (onceRef) onceRef.logged = true;
  const cc = u.cache_creation_input_tokens;
  console.log(
    `[fortune-claude-cache] cache_read_input_tokens=${cr}` +
      (typeof cc === "number" ? ` cache_creation_input_tokens=${cc}` : "") +
      (typeof u.input_tokens === "number" ? ` input_tokens=${u.input_tokens}` : ""),
  );
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

/** 메뉴 단일 패스(마커 샤딩) — reunionf82와 동일 65536. temperature는 `resolveClaudeParams`(기본 0.7) 유지 */
function resolveMenuSinglePassMaxOutputTokens() {
  const fromEnv = Number(
    process.env.FORTUNE_MENU_SINGLE_PASS_MAX_OUTPUT_TOKENS ??
      process.env.FORTUNE_SINGLE_PASS_MAX_OUTPUT ??
      0,
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(65_536, Math.max(4096, Math.floor(fromEnv)));
  }
  return 65_536;
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
      `[fortune-ttft ${reqId}] [0] request_start ms=${ms()} model=${model} max_tokens=${maxTokens} temp=${temperature} system_chars=${systemCharsForLog(system)} user_chars=${user.length}`,
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
        "anthropic-beta": anthropicBetaHeader(),
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

async function readClaudeSseToHtml(reader, { onTextDelta, ttftCtx, cacheLogOnceRef }) {
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulatedText = "";
  let streamError = null;
  let firstUpstreamDataLineLogged = false;
  let firstProxyChunkLogged = false;
  /** 스트림 종료 직전 `message_delta` 등에 포함되는 usage (prompt caching 포함) */
  let lastUsage = null;
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
        tryLogPromptCacheUsage(evt, { onceRef: cacheLogOnceRef });
        if (evt && typeof evt === "object" && evt.usage && typeof evt.usage === "object") {
          lastUsage = evt.usage;
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
  return { html: cleanHtml, streamError, usage: lastUsage };
}

function countHangulChars(html) {
  const text = String(html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length;
}

/** 프롬프트 캐시(system 블록 배열) 실패 시 평문 system으로 재시도 */
function plainSystemFromMenuCached(menuCachedSystem, sec) {
  if (Array.isArray(menuCachedSystem) && menuCachedSystem.length > 0) {
    return menuCachedSystem
      .map((b) => String(b?.text ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  const s = sec?.system;
  if (typeof s === "string") return s.trim();
  if (Array.isArray(s))
    return s
      .map((b) => String(b?.text ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
  return "";
}

/** Anthropic system(문자열 또는 캐시 블록 배열) → Gemini systemInstruction 평문 */
function anthropicSystemToPlainText(systemPayload) {
  if (typeof systemPayload === "string") return String(systemPayload).trim();
  if (Array.isArray(systemPayload)) {
    return systemPayload
      .map((b) => String(b?.text ?? "").trim())
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

/**
 * cachedContents.create 응답의 name 정규화.
 * AI Studio는 `cachedContents/{id}` 형태가 흔하고, 일부 응답은 `projects/.../cachedContents/{id}` 등 긴 경로일 수 있음.
 */
function geminiNormalizeCacheResourceName(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const marker = "cachedContents/";
  const idx = s.indexOf(marker);
  if (idx >= 0) return s.slice(idx);
  if (/^[a-zA-Z0-9_-]+$/.test(s)) return `${marker}${s}`;
  return null;
}

/**
 * Gemini 명시적 컨텍스트 캐시: 메뉴 공통 system만 저장 (generativelanguage v1beta).
 * @returns {Promise<{ name: string | null, error: string | null }>}
 * @see https://ai.google.dev/api/caching — 모델·최소 토큰 조건 미달 시 create 실패 → 호출부에서 비캐시 경로로 폴백.
 */
async function geminiCreateMenuCache(apiKey, menuModel, systemPlainText) {
  const text = String(systemPlainText ?? "").trim();
  if (!text) return { name: null, error: "empty_system" };
  const modelId = String(menuModel ?? "").trim() || "gemini-2.5-pro";
  const ttlRaw = String(process.env.GEMINI_MENU_CACHE_TTL ?? "600s").trim() || "600s";
  const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${encodeURIComponent(apiKey)}`;
  const body = {
    model: `models/${modelId}`,
    displayName: `yeonun_menu_${Date.now().toString(36)}`,
    systemInstruction: { parts: [{ text }] },
    ttl: ttlRaw,
  };
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { name: null, error: e instanceof Error ? e.message : String(e) };
  }
  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    let detail = raw.slice(0, 600);
    try {
      const ej = JSON.parse(raw);
      const m = ej?.error?.message || ej?.message;
      if (typeof m === "string" && m.trim()) detail = m.trim().slice(0, 600);
    } catch {
      /* keep raw */
    }
    return { name: null, error: `HTTP ${res.status}: ${detail}` };
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { name: null, error: "cache_create_json_parse" };
  }
  const name = geminiNormalizeCacheResourceName(json?.name);
  const tok = json?.usageMetadata?.totalTokenCount;
  if (name) {
    console.log(
      `[gemini-menu-cache] created_ok name=${name}` +
        (typeof tok === "number" ? ` cached_total_token_count=${tok}` : "") +
        ` system_chars=${text.length}`,
    );
    return { name, error: null };
  }
  const rawName = typeof json?.name === "string" ? json.name.slice(0, 200) : "";
  return {
    name: null,
    error: rawName ? `cache_create_bad_name:${rawName}` : "cache_create_no_name",
  };
}

/** 캐시 리소스 삭제(비용·쿼터 정리). 실패해도 무시. */
function geminiDeleteCachedContent(apiKey, cacheName) {
  const n = geminiNormalizeCacheResourceName(cacheName);
  if (!n || !/^cachedContents\//.test(n)) return Promise.resolve();
  const url = `https://generativelanguage.googleapis.com/v1beta/${n}?key=${encodeURIComponent(apiKey)}`;
  return fetch(url, { method: "DELETE" }).catch(() => {});
}

/** Gemini 스트림 JSON 1개에서 텍스트 델타·차단 사유 추출 */
function extractGeminiStreamChunk(json) {
  const out = { text: "", blockError: null, finishError: null };
  const fb = json?.promptFeedback;
  if (fb?.blockReason) {
    out.blockError = `Gemini blocked: ${fb.blockReason}`;
  }
  const cand = json?.candidates?.[0];
  const fr = cand?.finishReason;
  if (fr && fr !== "STOP" && fr !== "MAX_TOKENS" && fr !== "LENGTH" && fr !== "FINISH_REASON_UNSPECIFIED") {
    if (fr === "SAFETY" || fr === "RECITATION") {
      out.finishError = `Gemini finish: ${fr}`;
    }
  }
  const parts = cand?.content?.parts;
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (typeof p?.text === "string" && p.text.length) out.text += p.text;
    }
  }
  return out;
}

/** `token` 접두가 버퍼 끝에 잘려 있을 수 있으면 true — 잘린 마커 앞까지만 chunk로보냄 */
function geminiBufferMayEndWithPartialPrefix(buf, token) {
  const s = String(buf ?? "");
  const t = String(token ?? "");
  if (!s.length || !t.length) return false;
  const max = Math.min(s.length, t.length - 1);
  for (let k = max; k >= 1; k--) {
    if (s.endsWith(t.slice(0, k))) return true;
  }
  return false;
}

function geminiMenuOpenMarker(i) {
  return `<!-- YEONUN_SEC:${i} -->`;
}

function geminiMenuCloseMarker(i) {
  return `<!-- /YEONUN_SEC:${i} -->`;
}

/**
 * reunionf82 스타일: Gemini 1회 streamGenerateContent → 마커로 쪼개 기존 메뉴 SSE(section_start/chunk/section_replace/section_end) 재생.
 */
function buildGeminiMenuSinglePassUserText(menuSections) {
  return buildGeminiMenuSinglePassUserTextOffset(menuSections, 0);
}

/** `markerStartIdx`부터 연속 마커(YEONUN_SEC)로 슬라이스 구간 출력 */
function buildGeminiMenuSinglePassUserTextOffset(menuSections, markerStartIdx) {
  const n = menuSections.length;
  const parts = [];
  const lastG = markerStartIdx + n - 1;
  parts.push(
    `다음 ${n}개 구간을 **인덱스 ${markerStartIdx} → ${lastG} 순서대로** 한 번에 연속 출력하세요.`,
    `각 구간은 **오직** 아래 마커 쌍 사이에만 HTML을 두세요. 마커 바깥에 설명 문장·서문을 쓰지 마세요.`,
    `각 구간 HTML은 **하나**의 \`<div class="subtitle-section">...\` 블록만 포함합니다.`,
    `마커 철자·형식은 **아래 예시와 완전히 동일**해야 합니다(공백 포함).`,
    "",
    `형식 예시(구간 번호만 바꿉니다):\n${geminiMenuOpenMarker(markerStartIdx)}\n<div class="subtitle-section">…</div>\n${geminiMenuCloseMarker(markerStartIdx)}`,
    "",
  );
  for (let i = 0; i < n; i++) {
    const g = markerStartIdx + i;
    parts.push(`\n[구간 ${g} — 작성 지시]\n${String(menuSections[i]?.user ?? "").trim()}\n`);
  }
  parts.push(
    `\n이제 **구간 ${markerStartIdx}**부터 위 형식대로 \`${geminiMenuOpenMarker(markerStartIdx)}\` 로 시작해 모든 구간을 끝까지 출력하세요.`,
  );
  return parts.join("\n");
}

/**
 * @returns {{ push: (d: string) => void, finalize: (upstreamErr: string | null) => number }}
 */
function createGeminiMenuSingleStreamSharder(writeSse, nSections, startIdx = 0) {
  let buf = "";
  let idx = startIdx;
  const endIdx = startIdx + nSections;
  /** seek_open | in_body */
  let mode = "seek_open";
  let bodyStart = 0;
  let emitPos = 0;
  let totalChars = 0;

  const errHtml = (i) =>
    `<div class="subtitle-section"><h3 class="subtitle-title">섹션 ${i + 1}</h3><div class="subtitle-content"><p>이 구간 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.</p></div></div>`;

  function emitChunksUntil(absEndExclusive) {
    if (absEndExclusive > emitPos) {
      const chunk = buf.slice(emitPos, absEndExclusive);
      if (chunk) writeSse({ type: "chunk", index: idx, html: chunk });
      emitPos = absEndExclusive;
    }
  }

  function closeSection(closeIdx) {
    emitChunksUntil(closeIdx);
    const rawSec = buf.slice(bodyStart, closeIdx);
    const safe =
      normalizeHtmlBasics(stripCodeFences(rawSec)).trim() ||
      '<div class="subtitle-section"><h3 class="subtitle-title"></h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>';
    writeSse({ type: "section_replace", index: idx, html: safe });
    totalChars += Math.max(countHangulChars(safe), 1);
    writeSse({ type: "section_end", index: idx });
    const o = geminiMenuCloseMarker(idx);
    buf = buf.slice(closeIdx + o.length);
    emitPos = 0;
    bodyStart = 0;
    mode = "seek_open";
    idx += 1;
  }

  function push(delta) {
    buf += delta;
    while (idx < endIdx) {
      if (mode === "seek_open") {
        const tag = geminiMenuOpenMarker(idx);
        const p = buf.indexOf(tag);
        if (p === -1) {
          if (geminiBufferMayEndWithPartialPrefix(buf, tag)) return;
          return;
        }
        writeSse({ type: "section_start", index: idx });
        mode = "in_body";
        bodyStart = p + tag.length;
        emitPos = bodyStart;
        continue;
      }
      if (mode === "in_body") {
        const ctag = geminiMenuCloseMarker(idx);
        const c = buf.indexOf(ctag, bodyStart);
        if (c === -1) {
          let emitEnd = buf.length;
          if (geminiBufferMayEndWithPartialPrefix(buf, ctag)) {
            emitEnd = Math.max(bodyStart, buf.length - ctag.length);
          }
          emitChunksUntil(emitEnd);
          return;
        }
        closeSection(c);
        continue;
      }
      return;
    }
  }

  function finalize(upstreamErr) {
    const missingIndices = [];
    if (upstreamErr) {
      writeSse({ type: "error", message: upstreamErr });
    }
    if (mode === "in_body" && idx < endIdx) {
      emitChunksUntil(buf.length);
      const rawSec = buf.slice(bodyStart);
      const safe =
        normalizeHtmlBasics(stripCodeFences(rawSec)).trim() ||
        '<div class="subtitle-section"><h3 class="subtitle-title"></h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>';
      writeSse({ type: "section_replace", index: idx, html: safe });
      totalChars += Math.max(countHangulChars(safe), 1);
      writeSse({ type: "section_end", index: idx });
      idx += 1;
      buf = "";
      mode = "seek_open";
      emitPos = 0;
      bodyStart = 0;
    }
    while (idx < endIdx) {
      missingIndices.push(idx);
      writeSse({ type: "section_start", index: idx });
      writeSse({ type: "section_replace", index: idx, html: errHtml(idx) });
      totalChars += 40;
      writeSse({ type: "section_end", index: idx });
      idx += 1;
    }
    return { charCount: Math.max(totalChars, 120), missingIndices };
  }

  return { push, finalize };
}

/**
 * 임의 streamGenerateContent 본문으로 SSE 스트림 소비 → 텍스트 델타만 콜백.
 * @returns {Promise<{ accumulated: string, streamError: string | null }>}
 */
async function geminiConsumeStreamGenerateContent(apiKey, model, streamBody, onTextDelta, signal) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent` +
    `?key=${encodeURIComponent(apiKey)}&alt=sse`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(streamBody),
      signal: signal && !signal.aborted ? signal : undefined,
    });
  } catch (e) {
    if (signal?.aborted) return { accumulated: "", streamError: null };
    return { accumulated: "", streamError: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok || !res.body) {
    const rawText = await res.text().catch(() => "");
    return { accumulated: "", streamError: `Gemini HTTP ${res.status}: ${rawText.slice(0, 800)}` };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let streamError = null;

  const consumeJson = (json) => {
    if (!json || typeof json !== "object") return;
    const { text, blockError, finishError } = extractGeminiStreamChunk(json);
    if (blockError) streamError = blockError;
    if (finishError && !streamError) streamError = finishError;
    if (text) {
      accumulated += text;
      if (onTextDelta) onTextDelta(text);
    }
  };

  try {
    for (;;) {
      if (signal?.aborted) {
        await reader.cancel().catch(() => {});
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        const t = line.trim();
        if (!t) continue;
        let json = null;
        if (t.startsWith("data:")) {
          const payload = t.slice(5).trimStart();
          if (!payload || payload === "[DONE]") continue;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }
        } else if (t.startsWith("{")) {
          try {
            json = JSON.parse(t);
          } catch {
            continue;
          }
        }
        if (json) consumeJson(json);
      }
    }
    const tail = buffer.trim();
    if (tail) {
      let json = null;
      if (tail.startsWith("data:")) {
        const payload = tail.slice(5).trimStart();
        if (payload && payload !== "[DONE]") {
          try {
            json = JSON.parse(payload);
          } catch {
            /* ignore */
          }
        }
      } else if (tail.startsWith("{")) {
        try {
          json = JSON.parse(tail);
        } catch {
          /* ignore */
        }
      }
      if (json) consumeJson(json);
    }
  } catch (e) {
    if (signal?.aborted) {
      return { accumulated, streamError };
    }
    streamError = streamError || (e instanceof Error ? e.message : String(e));
  }

  return { accumulated, streamError };
}

/**
 * Gemini 메뉴 점사 — 단일 스트림 + 마커 샤딩(reunionf82 유사).
 * @returns {Promise<{ streamError: string | null, charCount: number }>}
 */
async function geminiRunMenuSinglePassStream({
  apiKey,
  model,
  systemText,
  combinedUser,
  menuSectionCount,
  reqBody,
  writeSse,
  sectionIndexOffset = 0,
  signal,
}) {
  const { temperature } = resolveClaudeParams(reqBody);
  const singleCap = resolveMenuSinglePassMaxOutputTokens();
  const streamBody = {
    contents: [{ role: "user", parts: [{ text: String(combinedUser) }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: singleCap,
    },
  };
  if (String(systemText ?? "").trim()) {
    streamBody.systemInstruction = { parts: [{ text: String(systemText).trim() }] };
  }
  const sharder = createGeminiMenuSingleStreamSharder(writeSse, menuSectionCount, sectionIndexOffset);
  const { streamError } = await geminiConsumeStreamGenerateContent(apiKey, model, streamBody, (d) =>
    sharder.push(d),
    signal,
  );
  const finalizeUpstream = signal?.aborted ? null : streamError;
  const fin = sharder.finalize(finalizeUpstream);
  return { streamError, charCount: fin.charCount, missingIndices: fin.missingIndices };
}

/** 30구간·5만자급: 단일 패스 출력 한도(약 65k 토큰) 초과 시 후반 마커 누락 방지 */
function fortuneMenuSinglePassBatchSize(sectionCount) {
  const fromEnv = Number(
    process.env.FORTUNE_MENU_SINGLE_PASS_BATCH_SIZE ?? process.env.GEMINI_MENU_SINGLE_PASS_BATCH_SIZE ?? 0,
  );
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(sectionCount, Math.max(1, Math.floor(fromEnv)));
  }
  if (sectionCount <= 14) return sectionCount;
  return 10;
}

/**
 * 마커 단일 패스 실패 구간을 소제목별 1회 스트림으로 재시도.
 * @returns {Promise<number>} 추가 반영 글자 수
 */
async function retryMenuSectionsIndividually({
  indices,
  menuSections,
  menuCachedSystem,
  useGemini,
  apiKey,
  geminiModel,
  anthropicKey,
  reqBody,
  writeSse,
  geminiMenuCacheName,
}) {
  if (!indices?.length) return 0;
  let added = 0;
  const usesCachedArray = Array.isArray(menuCachedSystem) && menuCachedSystem.length > 0;
  for (const i of indices) {
    const sec = menuSections[i];
    const user = String(sec?.user ?? "").trim();
    const subtitleTitle = String(sec?.subtitle_title ?? "").trim() || `섹션 ${i + 1}`;
    const system =
      usesCachedArray && menuCachedSystem.length > 0 ? menuCachedSystem : sec?.system;
    const systemOk =
      (typeof system === "string" && system.trim().length > 0) ||
      (Array.isArray(system) && system.length > 0);
    if (!systemOk || !user) continue;
    console.warn(`[fortune-menu-section-retry] index=${i} title=${subtitleTitle.slice(0, 40)}`);
    writeSse({ type: "section_start", index: i });
    try {
      let html = "";
      let streamError = null;
      if (useGemini) {
        const r = await geminiStreamSectionHtml(
          apiKey,
          geminiModel,
          system,
          user,
          reqBody,
          { onTextDelta: (delta) => writeSse({ type: "chunk", index: i, html: delta }) },
          { cachedContent: geminiMenuCacheName && usesCachedArray ? geminiMenuCacheName : null },
        );
        html = r.html;
        streamError = r.streamError;
      } else {
        const claudeRes = await anthropicMessagesStreamResponse(anthropicKey, reqBody, system, user, null);
        const cacheLogOnceRef = { logged: false };
        const r = await readClaudeSseToHtml(claudeRes.body.getReader(), {
          onTextDelta: (delta) => writeSse({ type: "chunk", index: i, html: delta }),
          cacheLogOnceRef,
        });
        html = r.html;
        streamError = r.streamError;
      }
      if (streamError) writeSse({ type: "error", message: streamError });
      const safe =
        normalizeHtmlBasics(stripCodeFences(html)).trim() ||
        `<div class="subtitle-section"><h3 class="subtitle-title">${subtitleTitle}</h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>`;
      writeSse({ type: "section_replace", index: i, html: safe });
      added += Math.max(countHangulChars(safe), 1);
    } catch (e) {
      writeSse({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
    writeSse({ type: "section_end", index: i });
  }
  return added;
}

async function geminiRunMenuSinglePassStreamBatched(opts) {
  const { menuSections, sectionIndexOffset = 0, signal, ...rest } = opts;
  const batchSize = fortuneMenuSinglePassBatchSize(menuSections.length);
  if (batchSize >= menuSections.length) {
    return geminiRunMenuSinglePassStream({ ...rest, menuSectionCount: menuSections.length, sectionIndexOffset, combinedUser: buildGeminiMenuSinglePassUserTextOffset(menuSections, sectionIndexOffset), signal });
  }
  let totalChars = 0;
  let streamError = null;
  const allMissing = [];
  console.log(
    `[gemini-menu-single-batch] sections=${menuSections.length} batch_size=${batchSize} offset=${sectionIndexOffset}`,
  );
  for (let b = 0; b < menuSections.length; b += batchSize) {
    if (signal?.aborted) break;
    const slice = menuSections.slice(b, b + batchSize);
    const off = sectionIndexOffset + b;
    const res = await geminiRunMenuSinglePassStream({
      ...rest,
      combinedUser: buildGeminiMenuSinglePassUserTextOffset(slice, off),
      menuSectionCount: slice.length,
      sectionIndexOffset: off,
      signal,
    });
    totalChars += res.charCount;
    if (res.streamError) streamError = res.streamError;
    if (res.missingIndices?.length) allMissing.push(...res.missingIndices);
  }
  return { streamError, charCount: totalChars, missingIndices: allMissing };
}

async function claudeRunMenuSinglePassStreamBatched(opts) {
  const { menuSections, menuCachedSystem, sectionIndexOffset = 0, ...rest } = opts;
  const batchSize = fortuneMenuSinglePassBatchSize(menuSections.length);
  if (batchSize >= menuSections.length) {
    return claudeRunMenuSinglePassStream({
      ...rest,
      menuCachedSystem,
      combinedUser: buildGeminiMenuSinglePassUserTextOffset(menuSections, sectionIndexOffset),
      menuSectionCount: menuSections.length,
      sectionIndexOffset,
    });
  }
  let totalChars = 0;
  let streamError = null;
  const allMissing = [];
  console.log(
    `[claude-menu-single-batch] sections=${menuSections.length} batch_size=${batchSize} offset=${sectionIndexOffset}`,
  );
  for (let b = 0; b < menuSections.length; b += batchSize) {
    const slice = menuSections.slice(b, b + batchSize);
    const off = sectionIndexOffset + b;
    const res = await claudeRunMenuSinglePassStream({
      ...rest,
      menuCachedSystem,
      combinedUser: buildGeminiMenuSinglePassUserTextOffset(slice, off),
      menuSectionCount: slice.length,
      sectionIndexOffset: off,
    });
    totalChars += res.charCount;
    if (res.streamError) streamError = res.streamError;
    if (res.missingIndices?.length) allMissing.push(...res.missingIndices);
  }
  return { streamError, charCount: totalChars, missingIndices: allMissing };
}

/** 메뉴 단일 패스(마커 샤딩)용 max_tokens — Claude도 65536 */
function fortuneMenuSinglePassReqBody(reqBody) {
  return { ...reqBody, max_tokens: resolveMenuSinglePassMaxOutputTokens() };
}

/**
 * Claude 메뉴 점사 — 단일 스트림 + YEONUN_SEC 마커 샤딩(Gemini 단일 패스와 동일 프로토콜).
 * @returns {Promise<{ streamError: string | null, charCount: number }>}
 */
async function claudeRunMenuSinglePassStream({
  anthropicKey,
  menuCachedSystem,
  combinedUser,
  menuSectionCount,
  reqBody,
  writeSse,
  sectionIndexOffset = 0,
}) {
  const bodyForPass = fortuneMenuSinglePassReqBody(reqBody);
  const sharder = createGeminiMenuSingleStreamSharder(writeSse, menuSectionCount, sectionIndexOffset);
  const claudeRes = await anthropicMessagesStreamResponse(
    anthropicKey,
    bodyForPass,
    menuCachedSystem,
    combinedUser,
    null,
  );
  const cacheLogOnceRef = { logged: false };
  const { streamError } = await readClaudeSseToHtml(claudeRes.body.getReader(), {
    onTextDelta: (d) => sharder.push(d),
    cacheLogOnceRef,
  });
  const fin = sharder.finalize(streamError);
  return { streamError, charCount: fin.charCount, missingIndices: fin.missingIndices };
}

/**
 * Gemini streamGenerateContent(SSE 또는 줄 단위 JSON) → Claude 메뉴와 동일하게 chunk 델타 전달.
 * @param {{ onTextDelta?: (t: string) => void }} callbacks
 * @param {{ cachedContent?: string | null }} [streamOpts] — 명시적 캐시 사용 시 systemInstruction 생략, 본문은 user 턴만.
 * @returns {Promise<{ html: string, streamError: string | null }>}
 */
async function geminiStreamSectionHtml(apiKey, model, systemPayload, userText, reqBody, callbacks, streamOpts) {
  const onTextDelta = typeof callbacks?.onTextDelta === "function" ? callbacks.onTextDelta : null;
  const cachedContent =
    streamOpts?.cachedContent && String(streamOpts.cachedContent).trim()
      ? String(streamOpts.cachedContent).trim()
      : null;
  const { maxTokens, temperature } = resolveClaudeParams(reqBody);
  const systemText = cachedContent ? "" : anthropicSystemToPlainText(systemPayload);
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent` +
    `?key=${encodeURIComponent(apiKey)}&alt=sse`;
  const body = {
    contents: [{ role: "user", parts: [{ text: String(userText) }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };
  if (cachedContent) {
    body.cachedContent = cachedContent;
  } else if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { html: "", streamError: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok || !res.body) {
    const rawText = await res.text().catch(() => "");
    return { html: "", streamError: `Gemini HTTP ${res.status}: ${rawText.slice(0, 800)}` };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let streamError = null;

  const consumeJson = (json) => {
    if (!json || typeof json !== "object") return;
    const { text, blockError, finishError } = extractGeminiStreamChunk(json);
    if (blockError) streamError = blockError;
    if (finishError && !streamError) streamError = finishError;
    if (text) {
      accumulated += text;
      if (onTextDelta) onTextDelta(text);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, "");
        const t = line.trim();
        if (!t) continue;
        let json = null;
        if (t.startsWith("data:")) {
          const payload = t.slice(5).trimStart();
          if (!payload || payload === "[DONE]") continue;
          try {
            json = JSON.parse(payload);
          } catch {
            continue;
          }
        } else if (t.startsWith("{")) {
          try {
            json = JSON.parse(t);
          } catch {
            continue;
          }
        }
        if (json) consumeJson(json);
      }
    }
    const tail = buffer.trim();
    if (tail) {
      let json = null;
      if (tail.startsWith("data:")) {
        const payload = tail.slice(5).trimStart();
        if (payload && payload !== "[DONE]") {
          try {
            json = JSON.parse(payload);
          } catch {
            /* ignore */
          }
        }
      } else if (tail.startsWith("{")) {
        try {
          json = JSON.parse(tail);
        } catch {
          /* ignore */
        }
      }
      if (json) consumeJson(json);
    }
  } catch (e) {
    streamError = streamError || (e instanceof Error ? e.message : String(e));
  }

  const html = normalizeHtmlBasics(stripCodeFences(accumulated));
  return { html, streamError };
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

  const anthropicKey = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const geminiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "").trim();

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
    const menuModel =
      String(req.body?.model || process.env.FORTUNE_CLOUDWAYS_MODEL || "claude-sonnet-4-6").trim() || "claude-sonnet-4-6";
    const useGemini = /^gemini-/i.test(menuModel);
    const streamStrategy = String(menuMeta?.fortune_stream_strategy ?? "").trim() || null;
    const modelGeminiMenu =
      String(req.body?.model_gemini_for_menu ?? "gemini-2.5-pro").trim() || "gemini-2.5-pro";

    if (streamStrategy === "claude_only" || streamStrategy === "hybrid") {
      if (!anthropicKey) {
        return res.status(503).json({
          error: "ANTHROPIC_API_KEY not configured",
          message: "Cloudways Application Settings에 ANTHROPIC_API_KEY를 설정하세요.",
        });
      }
    } else if (useGemini) {
      if (!geminiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY not configured",
          message: "GEMINI_API_KEY 또는 GOOGLE_AI_API_KEY를 설정하세요.",
        });
      }
    } else if (!anthropicKey) {
      return res.status(503).json({
        error: "ANTHROPIC_API_KEY not configured",
        message: "Cloudways Application Settings에 ANTHROPIC_API_KEY를 설정하세요.",
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

    const menuCachedSystem = req.body?.fortune_menu_cached_system;
    let geminiMenuCacheName = null;

    try {
      writeSse(menuMeta);
      writeSse(menuToc);

      const n = menuSections.length;
      let totalChars = 0;
      let allUsersOk = true;
      for (const sec of menuSections) {
        if (!String(sec?.user ?? "").trim()) allUsersOk = false;
      }
      const systemTextSingle = anthropicSystemToPlainText(menuCachedSystem);
      const cachedSysOk = Array.isArray(menuCachedSystem) && menuCachedSystem.length > 0;

      const runLegacyMenuStream = async () => {
        const geminiSingle =
          useGemini &&
          String(process.env.GEMINI_MENU_SINGLE_STREAM ?? "1").trim() !== "0" &&
          cachedSysOk;

        let didGeminiSingle = false;

        if (geminiSingle) {
          if (allUsersOk && systemTextSingle.length > 0 && geminiKey) {
            console.log(`[gemini-menu-single] one-shot sections=${menuSections.length}`);
            const singleRes = await geminiRunMenuSinglePassStreamBatched({
              apiKey: geminiKey,
              model: menuModel,
              systemText: systemTextSingle,
              menuSections,
              reqBody: req.body,
              writeSse,
              sectionIndexOffset: 0,
            });
            totalChars = singleRes.charCount;
            if (singleRes.missingIndices?.length) {
              totalChars += await retryMenuSectionsIndividually({
                indices: singleRes.missingIndices,
                menuSections,
                menuCachedSystem,
                useGemini: true,
                apiKey: geminiKey,
                geminiModel: menuModel,
                anthropicKey,
                reqBody: req.body,
                writeSse,
                geminiMenuCacheName: null,
              });
            }
            didGeminiSingle = true;
          }
        }

        if (!didGeminiSingle) {
          if (useGemini && cachedSysOk) {
            const systemForCache = anthropicSystemToPlainText(menuCachedSystem);
            if (systemForCache.length > 0 && geminiKey) {
              const cr = await geminiCreateMenuCache(geminiKey, menuModel, systemForCache);
              if (cr.name) {
                geminiMenuCacheName = cr.name;
              } else {
                console.warn(
                  `[gemini-menu-cache] disabled system_chars=${systemForCache.length}: ${cr.error || "unknown"}`,
                );
              }
            }
          }

          for (let i = 0; i < menuSections.length; i++) {
            const sec = menuSections[i];
            const system =
              Array.isArray(menuCachedSystem) && menuCachedSystem.length > 0 ? menuCachedSystem : sec?.system;
            const user = String(sec?.user ?? "").trim();
            const subtitleTitle = String(sec?.subtitle_title ?? "").trim() || `섹션 ${i + 1}`;
            const systemOk =
              (typeof system === "string" && system.trim().length > 0) ||
              (Array.isArray(system) && system.length > 0);
            if (!systemOk || !user) {
              writeSse({
                type: "error",
                message: "Invalid menu section: system and user are required.",
              });
              const errHtml = `<div class="subtitle-section"><h3 class="subtitle-title">${subtitleTitle}</h3><div class="subtitle-content"><p>이 구간 요청 형식이 올바르지 않습니다.</p></div></div>`;
              writeSse({ type: "section_replace", index: i, html: errHtml });
              totalChars += 40;
              writeSse({ type: "section_end", index: i });
              continue;
            }
            writeSse({ type: "section_start", index: i });
            const plainFallback = plainSystemFromMenuCached(menuCachedSystem, sec);
            const usesCachedArray = Array.isArray(menuCachedSystem) && menuCachedSystem.length > 0;

            const streamOneMenuSection = async (systemPayload, sectionStreamOpts = {}) => {
              const bypassGem = Boolean(sectionStreamOpts?.bypassGeminiCache);
              const geminiCached =
                useGemini &&
                geminiMenuCacheName &&
                !bypassGem &&
                usesCachedArray &&
                Array.isArray(systemPayload)
                  ? geminiMenuCacheName
                  : null;
              if (useGemini) {
                return geminiStreamSectionHtml(
                  geminiKey,
                  menuModel,
                  systemPayload,
                  user,
                  req.body,
                  {
                    onTextDelta: (delta) => writeSse({ type: "chunk", index: i, html: delta }),
                  },
                  { cachedContent: geminiCached },
                );
              }
              const claudeRes = await anthropicMessagesStreamResponse(anthropicKey, req.body, systemPayload, user, null);
              const cacheLogOnceRef = { logged: false };
              return readClaudeSseToHtml(claudeRes.body.getReader(), {
                onTextDelta: (delta) => writeSse({ type: "chunk", index: i, html: delta }),
                ttftCtx: null,
                cacheLogOnceRef,
              });
            };

            try {
              let { html, streamError } = await streamOneMenuSection(system);

              const thin = !html || html.trim().length < 40;
              const errHeavy = Boolean(streamError) && html.trim().length < 120;
              if (thin || errHeavy) {
                if (usesCachedArray && plainFallback.length > 0 && Array.isArray(system)) {
                  console.warn(
                    `[fortune-menu-retry] section_index=${i} thin=${thin ? "1" : "0"} stream_err=${streamError ? String(streamError).slice(0, 200) : ""}`,
                  );
                  try {
                    const second = await streamOneMenuSection(plainFallback, { bypassGeminiCache: true });
                    if (second.html.trim().length >= html.trim().length) {
                      html = second.html;
                      streamError = second.streamError;
                    }
                  } catch (retryErr) {
                    console.warn(
                      `[fortune-menu-retry-fail] section_index=${i} ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
                    );
                  }
                }
              }

              if (streamError) {
                writeSse({ type: "error", message: streamError });
              }
              const safe =
                html.trim() ||
                '<div class="subtitle-section"><h3 class="subtitle-title"></h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>';
              writeSse({ type: "section_replace", index: i, html: safe });
              totalChars += Math.max(countHangulChars(safe), 1);
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (usesCachedArray && plainFallback.length > 0) {
                try {
                  console.warn(`[fortune-menu-fallback-plain] section_index=${i} err=${msg.slice(0, 240)}`);
                  const { html: h2, streamError: se2 } = await streamOneMenuSection(plainFallback, {
                    bypassGeminiCache: true,
                  });
                  if (se2) writeSse({ type: "error", message: se2 });
                  const safe2 =
                    h2.trim() ||
                    '<div class="subtitle-section"><h3 class="subtitle-title"></h3><div class="subtitle-content"><p>응답이 비었습니다.</p></div></div>';
                  writeSse({ type: "section_replace", index: i, html: safe2 });
                  totalChars += Math.max(countHangulChars(safe2), 1);
                } catch (e2) {
                  writeSse({
                    type: "error",
                    message: e2 instanceof Error ? e2.message : String(e2),
                  });
                  const errHtml = `<div class="subtitle-section"><h3 class="subtitle-title">${subtitleTitle}</h3><div class="subtitle-content"><p>이 구간 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.</p></div></div>`;
                  writeSse({ type: "section_replace", index: i, html: errHtml });
                  totalChars += 40;
                }
              } else {
                writeSse({
                  type: "error",
                  message: msg,
                });
                const errHtml = `<div class="subtitle-section"><h3 class="subtitle-title">${subtitleTitle}</h3><div class="subtitle-content"><p>이 구간 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.</p></div></div>`;
                writeSse({ type: "section_replace", index: i, html: errHtml });
                totalChars += 40;
              }
            }
            writeSse({ type: "section_end", index: i });
          }
        }
      };

      if (streamStrategy === "claude_only") {
        if (!allUsersOk || !cachedSysOk || !systemTextSingle.length) {
          await runLegacyMenuStream();
        } else {
          let headRes = await claudeRunMenuSinglePassStreamBatched({
            anthropicKey,
            menuCachedSystem,
            menuSections,
            reqBody: req.body,
            writeSse,
            sectionIndexOffset: 0,
          }).catch((e) => ({
            streamError: e instanceof Error ? e.message : String(e),
            charCount: 0,
            missingIndices: [],
          }));
          if (headRes.streamError && geminiKey) {
            console.warn(`[fortune-menu] claude_only fallback_gemini err=${String(headRes.streamError).slice(0, 400)}`);
            const gr = await geminiRunMenuSinglePassStreamBatched({
              apiKey: geminiKey,
              model: modelGeminiMenu,
              systemText: systemTextSingle,
              menuSections,
              reqBody: req.body,
              writeSse,
              sectionIndexOffset: 0,
            });
            totalChars = gr.charCount;
            if (gr.missingIndices?.length) {
              totalChars += await retryMenuSectionsIndividually({
                indices: gr.missingIndices,
                menuSections,
                menuCachedSystem,
                useGemini: true,
                apiKey: geminiKey,
                geminiModel: modelGeminiMenu,
                anthropicKey,
                reqBody: req.body,
                writeSse,
                geminiMenuCacheName: null,
              });
            }
            if (gr.streamError) writeSse({ type: "error", message: gr.streamError });
          } else {
            totalChars = headRes.charCount;
            if (headRes.missingIndices?.length) {
              totalChars += await retryMenuSectionsIndividually({
                indices: headRes.missingIndices,
                menuSections,
                menuCachedSystem,
                useGemini: false,
                apiKey: geminiKey,
                geminiModel: modelGeminiMenu,
                anthropicKey,
                reqBody: req.body,
                writeSse,
                geminiMenuCacheName: null,
              });
            }
            if (headRes.streamError) writeSse({ type: "error", message: headRes.streamError });
          }
        }
      } else if (streamStrategy === "hybrid") {
        const hybridSplitRaw = Math.max(0, Math.floor(Number(menuMeta?.hybrid_claude_section_count ?? 0)));
        const split = hybridSplitRaw > 0 ? Math.min(n, hybridSplitRaw) : n;
        if (!allUsersOk || !cachedSysOk || !systemTextSingle.length) {
          await runLegacyMenuStream();
        } else if (!geminiKey || split >= n) {
          const cr = await claudeRunMenuSinglePassStreamBatched({
            anthropicKey,
            menuCachedSystem,
            menuSections,
            reqBody: req.body,
            writeSse,
            sectionIndexOffset: 0,
          }).catch((e) => ({
            streamError: e instanceof Error ? e.message : String(e),
            charCount: 0,
            missingIndices: [],
          }));
          totalChars = cr.charCount;
          if (cr.missingIndices?.length) {
            totalChars += await retryMenuSectionsIndividually({
              indices: cr.missingIndices,
              menuSections,
              menuCachedSystem,
              useGemini: false,
              apiKey: geminiKey,
              geminiModel: modelGeminiMenu,
              anthropicKey,
              reqBody: req.body,
              writeSse,
              geminiMenuCacheName: null,
            });
          }
          if (cr.streamError) writeSse({ type: "error", message: cr.streamError });
        } else {
          const rest = menuSections.slice(split);
          const gemAc = new AbortController();
          const gemP = geminiRunMenuSinglePassStreamBatched({
            apiKey: geminiKey,
            model: modelGeminiMenu,
            systemText: systemTextSingle,
            menuSections: rest,
            reqBody: req.body,
            writeSse,
            sectionIndexOffset: split,
            signal: gemAc.signal,
          });

          let headRes = await claudeRunMenuSinglePassStreamBatched({
            anthropicKey,
            menuCachedSystem,
            menuSections: menuSections.slice(0, split),
            reqBody: req.body,
            writeSse,
            sectionIndexOffset: 0,
          }).catch((e) => ({
            streamError: e instanceof Error ? e.message : String(e),
            charCount: 0,
            missingIndices: [],
          }));

          if (headRes.streamError) {
            gemAc.abort();
            await gemP.catch(() => {});
            if (geminiKey) {
              console.warn(`[hybrid] claude_head_fail_full_gemini err=${String(headRes.streamError).slice(0, 400)}`);
              const fullG = await geminiRunMenuSinglePassStreamBatched({
                apiKey: geminiKey,
                model: modelGeminiMenu,
                systemText: systemTextSingle,
                menuSections,
                reqBody: req.body,
                writeSse,
                sectionIndexOffset: 0,
              });
              totalChars = fullG.charCount;
              if (fullG.missingIndices?.length) {
                totalChars += await retryMenuSectionsIndividually({
                  indices: fullG.missingIndices,
                  menuSections,
                  menuCachedSystem,
                  useGemini: true,
                  apiKey: geminiKey,
                  geminiModel: modelGeminiMenu,
                  anthropicKey,
                  reqBody: req.body,
                  writeSse,
                  geminiMenuCacheName: null,
                });
              }
              if (fullG.streamError) writeSse({ type: "error", message: fullG.streamError });
            } else {
              writeSse({ type: "error", message: headRes.streamError });
              totalChars = headRes.charCount;
            }
          } else {
            totalChars += headRes.charCount;
            if (headRes.missingIndices?.length) {
              totalChars += await retryMenuSectionsIndividually({
                indices: headRes.missingIndices,
                menuSections,
                menuCachedSystem,
                useGemini: false,
                apiKey: geminiKey,
                geminiModel: modelGeminiMenu,
                anthropicKey,
                reqBody: req.body,
                writeSse,
                geminiMenuCacheName: null,
              });
            }
            let gOut;
            try {
              gOut = await gemP;
            } catch (ge) {
              gOut = {
                streamError: ge instanceof Error ? ge.message : String(ge),
                charCount: 0,
                missingIndices: [],
              };
            }
            if (gOut.streamError) {
              console.warn(`[hybrid] gemini_tail_fail_claude_tail err=${String(gOut.streamError).slice(0, 400)}`);
              const tail = await claudeRunMenuSinglePassStreamBatched({
                anthropicKey,
                menuCachedSystem,
                menuSections: rest,
                reqBody: req.body,
                writeSse,
                sectionIndexOffset: split,
              }).catch((e) => ({
                streamError: e instanceof Error ? e.message : String(e),
                charCount: 0,
                missingIndices: [],
              }));
              totalChars += tail.charCount;
              if (tail.missingIndices?.length) {
                totalChars += await retryMenuSectionsIndividually({
                  indices: tail.missingIndices,
                  menuSections,
                  menuCachedSystem,
                  useGemini: false,
                  apiKey: geminiKey,
                  geminiModel: modelGeminiMenu,
                  anthropicKey,
                  reqBody: req.body,
                  writeSse,
                  geminiMenuCacheName: null,
                });
              }
              if (tail.streamError) writeSse({ type: "error", message: tail.streamError });
            } else {
              totalChars += gOut.charCount;
              if (gOut.missingIndices?.length) {
                totalChars += await retryMenuSectionsIndividually({
                  indices: gOut.missingIndices,
                  menuSections,
                  menuCachedSystem,
                  useGemini: true,
                  apiKey: geminiKey,
                  geminiModel: modelGeminiMenu,
                  anthropicKey,
                  reqBody: req.body,
                  writeSse,
                  geminiMenuCacheName: null,
                });
              }
            }
          }
        }
      } else {
        await runLegacyMenuStream();
      }

      writeSse({ type: "done", charCount: Math.max(totalChars, 120) });
    } catch (e) {
      writeSse({
        type: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      if (geminiMenuCacheName) {
        await geminiDeleteCachedContent(geminiKey, geminiMenuCacheName);
        geminiMenuCacheName = null;
      }
    }
    res.end();
    return;
  }

  if (!anthropicKey) {
    return res.status(503).json({
      error: "ANTHROPIC_API_KEY not configured",
      message: "Cloudways Application Settings에 ANTHROPIC_API_KEY를 설정하세요.",
    });
  }

  const system = coerceAnthropicSystem(req.body?.system);
  const user = String(req.body?.user ?? "").trim();
  if (!system || !user) {
    return res.status(400).json({ error: "Invalid request", message: "system and user are required." });
  }

  let claudeRes;
  try {
    claudeRes = await anthropicMessagesStreamResponse(anthropicKey, req.body, system, user, { ttftDebug, reqId, ms });
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
  const cacheLogOnceRef = { logged: false };
  const { html: cleanHtml, streamError, usage: singleUsage } = await readClaudeSseToHtml(claudeRes.body.getReader(), {
    onTextDelta: (t) => {
      accLen += t.length;
      writeSse({ type: "chunk", text: t, accumulatedLength: accLen });
    },
    ttftCtx: { ttftDebug, reqId, ms, writeSse },
    cacheLogOnceRef,
  });
  const singleCr = singleUsage?.cache_read_input_tokens;
  if (typeof singleCr === "number" && singleCr > 0 && !cacheLogOnceRef.logged) {
    console.log(`[fortune-claude-cache] single_chat cache_read_input_tokens=${singleCr}`);
  }

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
