import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_COOKIE = "yeonun_admin";

async function requireAdminPreview(): Promise<boolean> {
  if (!process.env.ADMIN_PASSWORD) return true;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === "1";
}

export async function POST(request: Request) {
  if (!(await requireAdminPreview())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = String(process.env.CARTESIA_API_KEY ?? "").trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "CARTESIA_API_KEY is not configured",
      },
      { status: 501 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    voice_external_id?: string;
    transcript?: string;
  };
  const voice_external_id = String(body.voice_external_id ?? "").trim();
  const transcript = String(body.transcript ?? "안녕하세요. 연운 음성 미리듣기입니다.").trim() || "안녕하세요.";

  if (!voice_external_id) {
    return NextResponse.json({ error: "voice_external_id is required" }, { status: 400 });
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
        sample_rate: 44100,
      },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "Cartesia TTS request failed", details: detail.slice(0, 500) },
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
