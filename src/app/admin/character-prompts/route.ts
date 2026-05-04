import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const form = await request.formData();
  const character_key = String(form.get("character_key") ?? "").trim();
  const mode = String(form.get("mode") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const prompt = String(form.get("prompt") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "true") === "true";
  const tts_voice_raw = String(form.get("tts_voice_id") ?? "").trim();
  const tts_voice_id = mode === "voice" && tts_voice_raw ? tts_voice_raw : null;

  const hash = mode === "voice" ? "voice" : mode === "fortune_text" ? "fortune" : mode === "chat_text" ? "chat" : "dashboard";
  if (!["voice", "fortune_text", "chat_text"].includes(mode)) {
    if (wantsJson) return NextResponse.json({ ok: false as const, error: "지원하지 않는 모드입니다." }, { status: 400 });
    return NextResponse.redirect(new URL("/admin#dashboard", request.url), 303);
  }
  if (!character_key || !mode || !title || !prompt) {
    if (wantsJson) return NextResponse.json({ ok: false as const, error: "필수 항목을 채워 주세요." }, { status: 400 });
    return NextResponse.redirect(new URL(`/admin#${hash}`, request.url), 303);
  }

  await supabaseServer()
    .from("character_mode_prompts")
    .upsert({ character_key, mode, title, prompt, is_active, tts_voice_id }, { onConflict: "character_key,mode" });

  if (wantsJson) return NextResponse.json({ ok: true as const });
  return NextResponse.redirect(new URL(`/admin#${hash}`, request.url), 303);
}

