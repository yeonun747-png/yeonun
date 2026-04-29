import { NextResponse } from "next/server";
import WebSocket from "ws";

import { getCharacterModePrompt, getServicePrompt } from "@/lib/data/characters";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type DccTurnBody = {
  character_key?: string;
  session_id?: string;
  /** 입장 직후 캐릭터가 먼저 인사할 때 true. audio_base64·transcript 없이 호출. */
  opening_handshake?: boolean;
  /**
   * 16kHz LINEAR16(PCM16LE) base64 (권장).
   * - WAV base64를 보내도, 44바이트 헤더가 있으면 제거 후 PCM으로 취급한다.
   */
  audio_base64?: string;
  transcript?: string;
  /**
   * Cartesia voice external id (tts_voices.external_id).
   * - 없으면 캐릭터 voice 설정이 있으면 그걸 사용, 둘 다 없으면 400.
   */
  voice_external_id?: string;
  manse_context?: string;
};

/** /call-dcc CHARACTER_META.spec 과 동일 (첫 인사 시스템 지시용) */
const CHARACTER_SPEC_KO: Record<string, string> = {
  yeon: "재회 · 연애 · 궁합",
  byeol: "자미두수 · 신년운세",
  yeo: "정통 사주 · 평생운",
  un: "작명 · 택일 · 꿈해몽",
};

const VITO_AUTH_URL = "https://openapi.vito.ai/v1/authenticate";
const VITO_STREAMING_URL = "wss://openapi.vito.ai/v1/transcribe:streaming";
const VITO_SAMPLE_RATE = 16000;
const VITO_PCM_CHUNK_BYTES = 4096;

const CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket";

function requiredEnv(name: string) {
  const v = String(process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function isWav(buf: Buffer) {
  return buf.length >= 44 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
}

async function getVitoAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  const res = await fetch(VITO_AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`VITO authenticate failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const j = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!j?.access_token) throw new Error("VITO access_token missing");
  return j.access_token;
}

function transcribeWithVito(pcmBuffer: Buffer, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      sample_rate: String(VITO_SAMPLE_RATE),
      encoding: "LINEAR16",
      use_itn: "true",
      use_disfluency_filter: "true",
      use_profanity_filter: "false",
    });
    const url = `${VITO_STREAMING_URL}?${params.toString()}`;
    const vitoWs = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` } });
    const parts: string[] = [];
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try {
        vitoWs.close();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(parts.join(" ").replace(/\s+/g, " ").trim());
    };
    vitoWs.on("open", () => {
      for (let i = 0; i < pcmBuffer.length; i += VITO_PCM_CHUNK_BYTES) {
        const chunk = pcmBuffer.subarray(i, Math.min(i + VITO_PCM_CHUNK_BYTES, pcmBuffer.length));
        if (chunk.length > 0) vitoWs.send(chunk);
      }
      vitoWs.send("EOS");
    });
    vitoWs.on("message", (data: Buffer | string) => {
      try {
        const raw = typeof data === "string" ? data : data.toString("utf8");
        const result = JSON.parse(raw) as { final?: boolean; alternatives?: Array<{ text?: string }> };
        if (result?.final && result?.alternatives?.[0]?.text) parts.push(result.alternatives[0].text.trim());
      } catch {
        // ignore
      }
    });
    vitoWs.on("error", (err) => finish(err instanceof Error ? err : new Error("VITO ws error")));
    vitoWs.on("close", () => {
      if (!settled) finish();
    });
    setTimeout(() => {
      if (!settled) finish(new Error("VITO transcribe:streaming timeout"));
    }, 25000);
  });
}

function extractChunk(text: string, maxChunkChars = 240) {
  if (!text) return { chunk: "", rest: "" };
  const leadTrim = text.length - text.trimStart().length;
  const trimmed = text.trimStart();
  if (!trimmed) return { chunk: "", rest: text };
  const punctIdx = trimmed.search(/[,，.。!?]/);
  if (punctIdx >= 0) {
    const len = punctIdx + 1;
    const end = leadTrim + (len <= maxChunkChars ? len : maxChunkChars);
    return { chunk: text.slice(0, end), rest: text.slice(end) };
  }
  if (trimmed.length >= 12) {
    const spaceAt = trimmed.indexOf(" ", 11);
    if (spaceAt >= 0) {
      const len = spaceAt + 1;
      const end = leadTrim + (len <= maxChunkChars ? len : maxChunkChars);
      return { chunk: text.slice(0, end), rest: text.slice(end) };
    }
  }
  if (trimmed.length > maxChunkChars) {
    return { chunk: text.slice(0, leadTrim + maxChunkChars), rest: text.slice(leadTrim + maxChunkChars) };
  }
  return { chunk: "", rest: text };
}

function buildRecentTranscript(turns: Array<{ role: string | null; text: string | null }>): string {
  const lines: string[] = [];
  for (const t of turns) {
    const role = String(t.role ?? "").trim();
    const text = String(t.text ?? "").trim();
    if (!role || !text || text === "__SILENCE_BREAK__") continue;
    const who = role === "assistant" ? "상담사" : role === "user" ? "사용자" : role;
    const clipped = text.length > 900 ? `${text.slice(0, 900)}…` : text;
    lines.push(`${who}: ${clipped}`);
  }
  return lines.join("\n").trim();
}

async function updateMemorySummary(args: {
  supabase: ReturnType<typeof supabaseServer>;
  sessionId: string;
  prevSummary: string;
  recentTranscript: string;
}) {
  const prev = String(args.prevSummary ?? "").trim();
  const recent = String(args.recentTranscript ?? "").trim();
  if (!recent) return;
  const anthropicKey = requiredEnv("ANTHROPIC_API_KEY");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: String(process.env.VOICE_LLM_MODEL || "claude-sonnet-4-6").trim(),
      max_tokens: 320,
      temperature: 0.2,
      system: [
        "당신은 상담 대화의 메모리 요약기입니다.",
        "다음 턴에서 상담사가 맥락을 잃지 않도록 핵심 정보만 유지합니다.",
        "한국어로만, 6~12줄 짧은 불릿으로 작성합니다.",
        "사실 기반으로만 작성하고 추측하지 않습니다.",
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            prev ? `[이전 메모리]\n${prev}\n` : "",
            `[최근 대화]\n${recent}\n`,
            "[요청]\n이전 메모리를 최신 대화로 갱신하세요.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    }),
  });
  if (!res.ok) return;
  const j = (await res.json().catch(() => ({}))) as { content?: Array<{ type?: string; text?: string }> };
  const nextSummary = (j.content ?? []).map((p) => (p.type === "text" ? String(p.text || "") : "")).join("").trim();
  if (!nextSummary) return;
  await args.supabase
    .from("voice_sessions")
    .update({ memory_summary: nextSummary, memory_updated_at: new Date().toISOString() })
    .eq("id", args.sessionId);
}

async function streamClaudeToCartesiaAndClient(args: {
  system: string;
  user: string;
  voiceExternalId: string;
  cartesiaModelId: string;
  cartesiaVersion: string;
}) {
  const anthropicKey = requiredEnv("ANTHROPIC_API_KEY");
  const cartesiaKey = requiredEnv("CARTESIA_API_KEY");

  const claudeBody = {
    model: "claude-sonnet-4-6",
    max_tokens: 1800,
    stream: true,
    temperature: 0.45,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  };

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(claudeBody),
  });
  if (!claudeRes.ok || !claudeRes.body) {
    const text = await claudeRes.text().catch(() => "");
    throw new Error(`Claude stream failed: ${claudeRes.status} ${text.slice(0, 400)}`);
  }

  const cartesiaWs = new WebSocket(CARTESIA_WS_URL, {
    headers: {
      "Cartesia-Version": args.cartesiaVersion,
      Authorization: `Bearer ${cartesiaKey}`,
    },
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamClosed = false;
      const safeClose = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      const write = (obj: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          // controller already closed (client aborted)
          streamClosed = true;
        }
      };
      const debug = (stage: string, detail: unknown) => {
        write({
          type: "debug",
          stage,
          detail: typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 800),
          ts: Date.now(),
        });
      };

      let cartesiaOpen = false;
      let cartesiaClosed = false;
      let assistantText = "";
      let pendingText = "";
      let sentAny = false;
      let sentFinal = false;
      let audioChunkCount = 0;
      let resolveCartesiaDone: (() => void) | null = null;
      const cartesiaDonePromise = new Promise<void>((resolve) => {
        resolveCartesiaDone = resolve;
      });
      /** Cartesia가 세그먼트마다 done/close를내면 Claude 스트림 도중에도 resolve되어 TTS가 잘림 → sentFinal 이후만 인정 */
      let cartesiaTurnDoneResolved = false;
      const resolveCartesiaTurnDone = (reason: string) => {
        if (cartesiaTurnDoneResolved || streamClosed) return;
        cartesiaTurnDoneResolved = true;
        debug("cartesia_turn_done", reason);
        resolveCartesiaDone?.();
      };
      const preOpenQueue: Array<{ transcript: string; isFinal: boolean }> = [];

      const baseCartesia = {
        model_id: args.cartesiaModelId,
        voice: { mode: "id" as const, id: args.voiceExternalId },
        language: "ko" as const,
        generation_config: { speed: 1, volume: 1, emotion: "calm" },
        output_format: { container: "raw" as const, encoding: "pcm_s16le" as const, sample_rate: 24000 },
        context_id: `yeonun-dcc-${Date.now()}`,
        max_buffer_delay_ms: 2800,
      };

      const sendCartesia = (transcript: string, isFinal: boolean) => {
        if (cartesiaClosed) return;
        if (!cartesiaOpen) {
          preOpenQueue.push({ transcript, isFinal });
          return;
        }
        const payload = { ...baseCartesia, transcript, continue: !isFinal };
        try {
          cartesiaWs.send(JSON.stringify(payload));
        } catch {
          // ignore
        }
      };

      const waitCartesiaOpen = () =>
        new Promise<void>((resolve, reject) => {
          if (cartesiaOpen) return resolve();
          const timer = setTimeout(() => reject(new Error("Cartesia websocket open timeout")), 8000);
          const cleanup = () => {
            try {
              clearTimeout(timer);
            } catch {
              // ignore
            }
            cartesiaWs.off("open", onOpen);
            cartesiaWs.off("error", onErr);
            cartesiaWs.off("close", onClose);
          };
          const onOpen = () => {
            cleanup();
            resolve();
          };
          const onErr = (e: unknown) => {
            cleanup();
            reject(e instanceof Error ? e : new Error("Cartesia websocket error"));
          };
          const onClose = (code: number) => {
            cleanup();
            reject(new Error(`Cartesia websocket closed before open: ${code}`));
          };
          cartesiaWs.on("open", onOpen);
          cartesiaWs.on("error", onErr);
          cartesiaWs.on("close", onClose);
        });

      cartesiaWs.on("open", () => {
        cartesiaOpen = true;
        debug("cartesia_open", { queued: preOpenQueue.length, model: args.cartesiaModelId, voice: args.voiceExternalId });
        // open 이전에 쌓인 텍스트를 flush
        if (preOpenQueue.length > 0) {
          for (const item of preOpenQueue.splice(0, preOpenQueue.length)) {
            try {
              const payload = { ...baseCartesia, transcript: item.transcript, continue: !item.isFinal };
              cartesiaWs.send(JSON.stringify(payload));
            } catch {
              // ignore
            }
          }
        }
      });
      cartesiaWs.on("message", (raw: Buffer | string) => {
        if (streamClosed || cartesiaClosed) return;
        // ws 라이브러리는 "text 프레임"도 Buffer로 넘길 수 있다.
        // Buffer면 utf8 JSON 파싱을 먼저 시도하고, 실패하면 raw pcm으로 처리한다.
        const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw || "");
        try {
          const msg = JSON.parse(text) as { type?: string; data?: string };
          if (msg.type === "chunk" && typeof msg.data === "string") {
            audioChunkCount += 1;
            write({ type: "audio", base64: msg.data, format: "pcm_s16le", sampleRate: 24000 });
            return;
          }
          if (msg.type === "done") {
            if (!sentFinal) {
              debug("cartesia_done_ignored", "before Claude final → Cartesia continue:false");
              return;
            }
            cartesiaClosed = true;
            debug("cartesia_done", "done");
            resolveCartesiaTurnDone("cartesia_json_done");
          }
        } catch {
          // JSON이 아니면 raw pcm bytes로 처리 (Buffer일 때만 의미 있음)
          if (Buffer.isBuffer(raw) && raw.length > 0) {
            debug("cartesia_binary", { bytes: raw.length });
            audioChunkCount += 1;
            write({ type: "audio", base64: raw.toString("base64"), format: "pcm_s16le", sampleRate: 24000 });
          }
        }
      });
      cartesiaWs.on("close", () => {
        if (!sentFinal) {
          debug("cartesia_close_ignored", "before final send (streaming 세그먼트 구간일 수 있음)");
          return;
        }
        cartesiaClosed = true;
        debug("cartesia_close", "closed");
        resolveCartesiaTurnDone("ws_close");
      });
      cartesiaWs.on("error", (e) => {
        cartesiaClosed = true;
        debug("cartesia_error", e instanceof Error ? e.message : String(e));
        resolveCartesiaTurnDone("ws_error");
      });

      // Claude SSE parsing
      const reader = claudeRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Cartesia가 늦게 열리면 "무음"이 되므로, open을 확실히 기다린다.
      // (Claude 스트림은 이미 시작되어도, Cartesia로 보낼 텍스트는 큐에 쌓이므로 유실되지 않는다.)
      try {
        debug("cartesia_wait_open", "start");
        await waitCartesiaOpen();
        debug("cartesia_wait_open", "ok");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        write({ type: "error", message: `Cartesia 연결 실패: ${msg}` });
        write({ type: "done" });
        safeClose();
        return;
      }

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
            try {
              const evt = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string } };
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
                const t = evt.delta.text;
                assistantText += t;
                pendingText += t;
                for (;;) {
                  const { chunk, rest } = extractChunk(pendingText);
                  if (!chunk) break;
                  pendingText = rest;
                  const trimmed = chunk.trim();
                  if (!trimmed) continue;
                  const toSend = sentAny ? ` ${trimmed}` : trimmed;
                  sentAny = true;
                  sendCartesia(toSend, false);
                }
              }
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore (client abort etc.)
      } finally {
        const finalText = pendingText.trim();
        if (cartesiaOpen && !sentFinal) {
          if (finalText) {
            const toSend = sentAny ? ` ${finalText}` : finalText;
            sendCartesia(toSend, true);
          } else {
            sendCartesia("", true);
          }
          sentFinal = true;
        }
        // final transcript 전송 직후 닫으면 Cartesia 오디오가 도착하기 전에 끊긴다.
        // Cartesia done/close를 기다리되, 무한 대기를 막기 위해 짧은 타임아웃을 둔다.
        if (cartesiaOpen) {
          const baseTailMs = audioChunkCount > 0 ? 14_000 : 18_000;
          const tailMs = Math.min(
            120_000,
            baseTailMs + assistantText.length * 50 + audioChunkCount * 120,
          );
          await Promise.race([
            cartesiaDonePromise,
            new Promise<void>((resolve) => setTimeout(resolve, tailMs)),
          ]);
          debug("cartesia_wait_done", { audioChunkCount, tailMs, assistantLen: assistantText.length });
        }
        assistantText = assistantText.trim();
        write({ type: "assistantText", text: assistantText });
        write({ type: "done" });
        try {
          cartesiaWs.close();
        } catch {
          // ignore
        }
        safeClose();
      }
    },
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DccTurnBody;
  const characterKey = String(body.character_key ?? "yeon").trim() || "yeon";
  const sessionId = String(body.session_id ?? "").trim();
  const manseContext = String(body.manse_context ?? "").trim();

  const supabase = sessionId ? supabaseServer() : null;
  let memorySummary = "";
  if (supabase && sessionId) {
    const { data: session } = await supabase
      .from("voice_sessions")
      .select("id,character_key,status,memory_summary")
      .eq("id", sessionId)
      .maybeSingle();
    if (session?.status && String(session.status) !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 409 });
    }
    memorySummary = String((session as any)?.memory_summary ?? "").trim();
  }

  const [commonPrompt, characterPrompt] = await Promise.all([
    getServicePrompt("yeonun_common_system"),
    getCharacterModePrompt(characterKey, "voice"),
  ]);

  const voiceExternalId =
    String(body.voice_external_id ?? "").trim() ||
    String(characterPrompt?.tts_voice?.external_id ?? "").trim() ||
    String(process.env.CARTESIA_DEFAULT_VOICE_EXTERNAL_ID ?? "").trim();

  if (!voiceExternalId) {
    return NextResponse.json(
      {
        error: "voice_external_id is required",
        hint: "Set CARTESIA_DEFAULT_VOICE_EXTERNAL_ID or configure character_mode_prompts.tts_voice_id for this character.",
      },
      { status: 400 },
    );
  }

  const isOpening = Boolean(body.opening_handshake);
  if (isOpening) {
    if (String(body.audio_base64 ?? "").trim()) {
      return NextResponse.json({ error: "opening_handshake must not include audio_base64" }, { status: 400 });
    }
    if (String(body.transcript ?? "").trim()) {
      return NextResponse.json({ error: "opening_handshake must not include transcript" }, { status: 400 });
    }
  }

  let userTranscript = String(body.transcript ?? "").trim();
  if (!isOpening && !userTranscript) {
    const b64 = String(body.audio_base64 ?? "").trim();
    if (!b64) return NextResponse.json({ error: "audio_base64 or transcript is required" }, { status: 400 });

    const vitoClientId = String(process.env.VITO_CLIENT_ID || process.env.RETURNZERO_VITO_CLIENT_ID || "").trim();
    const vitoClientSecret = String(process.env.VITO_CLIENT_SECRET || process.env.RETURNZERO_VITO_CLIENT_SECRET || "").trim();
    if (!vitoClientId || !vitoClientSecret) {
      return NextResponse.json(
        { error: "VITO_CLIENT_ID and VITO_CLIENT_SECRET are required for Returnzero STT" },
        { status: 501 },
      );
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(b64, "base64");
    } catch {
      return NextResponse.json({ error: "invalid base64" }, { status: 400 });
    }
    const pcm = isWav(buf) ? buf.subarray(44) : buf;
    if (pcm.length <= 0) {
      userTranscript = "";
    } else {
      try {
        const token = await getVitoAccessToken(vitoClientId, vitoClientSecret);
        userTranscript = await transcribeWithVito(pcm, token);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: "VITO STT failed", details: msg }, { status: 502 });
      }
    }
  } else if (isOpening) {
    userTranscript = "";
  }

  if (supabase && sessionId && userTranscript) {
    await supabase.from("voice_turns").insert({
      session_id: sessionId,
      role: "user",
      text: userTranscript,
    });
  }

  let recentTranscript = "";
  let recentTurnsRaw: any[] = [];
  if (supabase && sessionId) {
    const { data } = await supabase
      .from("voice_turns")
      .select("role,text,created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(10);
    recentTurnsRaw = Array.isArray(data) ? (data as any[]) : [];
    recentTranscript = buildRecentTranscript(recentTurnsRaw.reverse());
  }

  const manseBlock = manseContext ? `\n\n[사용자 사주 명식 데이터]\n${manseContext.slice(0, 4000)}` : "";
  const memoryBlock = memorySummary ? `\n\n[최근 상담 히스토리 요약]\n${memorySummary.slice(0, 2500)}` : "";
  const baseSystem =
    String(commonPrompt?.prompt ?? "").trim() +
    "\n\n" +
    String(characterPrompt?.prompt ?? "").trim() +
    manseBlock +
    memoryBlock +
    "\n\n[출력 규칙]\n- 한국어로만 답변\n- 구어체\n- 너무 길게 늘어지지 않게 문장을 나눠서 말하듯 작성";

  const specKo = CHARACTER_SPEC_KO[characterKey] || "사주·운세 상담";
  const userForLlm = isOpening
    ? [
        recentTranscript ? `[최근 대화]\n${recentTranscript}` : "",
        `[관리자 지시: 음성 상담 첫 인사]`,
        `사용자는 방금 이 음성 상담 화면에 입장했고, 아직 마이크로 말하지 않았습니다.`,
        `당신의 주특기(전문 분야)는 「${specKo}」입니다. 이 방향을 중심으로 말투와 분위기를 잡으세요.`,
        `시스템 프롬프트에 포함된 [사용자 사주 명식 데이터]와 그 안의 KST 시각이 있으면 그 맥락만 가볍게 짚어 주세요. 원문 통째 암송·과한 한자·전문용어 나열은 피합니다.`,
        `한국어 구어체로 2~4문장만 먼저 말을 건네고, 마지막에 부담 없는 질문 하나만 하세요.`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
        recentTranscript ? `[최근 대화]\n${recentTranscript}` : "",
        `[이번 입력]\n${userTranscript}`,
      ]
        .filter(Boolean)
        .join("\n\n");

  // 스트리밍 시작 전에 userTranscript를 먼저 내려줌(클라가 자막/상태를 바로 갱신)
  const encoder = new TextEncoder();

  const cartesiaModelId = String(process.env.CARTESIA_TTS_MODEL || "sonic-3").trim() || "sonic-3";
  const cartesiaVersion = String(process.env.CARTESIA_API_VERSION || "2025-04-16").trim() || "2025-04-16";

  let streamClosed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeClose = () => {
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };
      const write = (obj: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          streamClosed = true;
        }
      };
      write({ type: "userTranscript", text: userTranscript });
      if (!userTranscript && !isOpening) {
        write({ type: "assistantText", text: "" });
        write({ type: "done" });
        safeClose();
        return;
      }
      try {
        let assistantTextForMemory = "";
        const inner = await streamClaudeToCartesiaAndClient({
          system: baseSystem,
          user: userForLlm || userTranscript,
          voiceExternalId,
          cartesiaModelId,
          cartesiaVersion,
        });
        const r = inner.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await r.read();
          if (done) break;
          if (streamClosed) break;
          try {
            const chunkText = decoder.decode(value, { stream: true });
            for (const line of chunkText.split("\n")) {
              const t = line.trim();
              if (!t) continue;
              const msg = JSON.parse(t) as { type?: string; text?: string };
              if (msg.type === "assistantText") assistantTextForMemory = String(msg.text ?? "");
            }
          } catch {
            // ignore parse errors
          }
          try {
            controller.enqueue(value);
          } catch {
            streamClosed = true;
            break;
          }
        }
        if (supabase && sessionId && assistantTextForMemory) {
          await supabase.from("voice_turns").insert({
            session_id: sessionId,
            role: "assistant",
            text: assistantTextForMemory,
          });
          try {
            if (recentTurnsRaw.length >= 10) {
              await updateMemorySummary({
                supabase,
                sessionId,
                prevSummary: memorySummary,
                recentTranscript,
              });
            }
          } catch {
            // memory update is non-blocking
          }
        }
        safeClose();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        write({ type: "error", message: msg });
        write({ type: "done" });
        safeClose();
      }
    },
    cancel() {
      // client aborted
      streamClosed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

