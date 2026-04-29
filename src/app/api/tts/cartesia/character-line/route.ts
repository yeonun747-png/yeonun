import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["yeon", "byeol", "yeo", "un"]);
const MAX_LEN = 600;

/** 보이스 UUID는 자주 바뀌지 않음 — 반복 클릭 시 Supabase 왕복 제거 */
const voiceIdMemo = new Map<string, { id: string; at: number }>();
const VOICE_MEMO_MS = 10 * 60 * 1000;

function pickVoiceExternalFromRow(data: unknown): string {
  const row = data as { tts_voices?: { external_id?: string } | { external_id?: string }[] | null } | null;
  const v = row?.tts_voices;
  if (!v) return "";
  const id = Array.isArray(v) ? v[0]?.external_id : v.external_id;
  return String(id ?? "").trim();
}

async function resolveVoiceExternalId(character_key: string): Promise<string | null> {
  const now = Date.now();
  const hit = voiceIdMemo.get(character_key);
  if (hit && now - hit.at < VOICE_MEMO_MS) return hit.id;

  const envDefault = String(process.env.CARTESIA_DEFAULT_VOICE_EXTERNAL_ID ?? "").trim();
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("character_mode_prompts")
    .select("tts_voices(external_id)")
    .eq("character_key", character_key)
    .eq("mode", "voice")
    .maybeSingle();

  if (error) {
    if (envDefault) voiceIdMemo.set(character_key, { id: envDefault, at: now });
    return envDefault || null;
  }

  const ext = pickVoiceExternalFromRow(data);
  const voice_external_id = ext || envDefault;
  if (voice_external_id) voiceIdMemo.set(character_key, { id: voice_external_id, at: now });
  return voice_external_id || null;
}

export async function POST(request: Request) {
  const apiKey = String(process.env.CARTESIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json({ error: "CARTESIA_API_KEY is not configured" }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    character_key?: string;
    transcript?: string;
  };
  const character_key = String(body.character_key ?? "").trim();
  const transcriptRaw = String(body.transcript ?? "").trim();

  if (!ALLOWED.has(character_key)) {
    return NextResponse.json({ error: "invalid_character_key" }, { status: 400 });
  }
  const transcript = (transcriptRaw || "안녕하세요.").slice(0, MAX_LEN);

  const voice_external_id = await resolveVoiceExternalId(character_key);

  if (!voice_external_id) {
    return NextResponse.json(
      {
        error: "no_voice_for_character",
        hint: "Configure character_mode_prompts (voice) tts_voice_id or CARTESIA_DEFAULT_VOICE_EXTERNAL_ID.",
      },
      { status: 400 },
    );
  }

  const version = String(process.env.CARTESIA_API_VERSION || "2026-03-01").trim();
  const model_id = String(process.env.CARTESIA_TTS_MODEL || "sonic-2").trim();

  const upstream = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Cartesia-Version": version,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transcript,
      model_id,
      voice: { mode: "id", id: voice_external_id },
      output_format: {
        container: "wav",
        encoding: "pcm_s16le",
        /** 전송·디코딩 부담 감소로 체감 지연 완화 (짧은 한 마디용) */
        sample_rate: 24000,
      },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "cartesia_failed", details: detail.slice(0, 500) },
      { status: upstream.status || 502 },
    );
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "no-store",
    },
  });
}
