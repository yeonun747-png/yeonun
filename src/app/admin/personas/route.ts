import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const character_key = String(form.get("character_key") ?? "").trim();
  if (!character_key) return NextResponse.redirect(new URL("/admin#admin-personas", request.url));

  const specialtiesRaw = String(form.get("specialties") ?? "[]").trim();
  let specialties: unknown = [];
  try {
    specialties = JSON.parse(specialtiesRaw || "[]");
  } catch {
    specialties = [];
  }

  const keywords = String(form.get("keywords") ?? "")
    .split(/[,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  const payload = {
    character_key,
    color_hex: String(form.get("color_hex") ?? "").trim() || null,
    age_impression: String(form.get("age_impression") ?? "").trim() || null,
    voice_tone: String(form.get("voice_tone") ?? "").trim() || null,
    honorific_style: String(form.get("honorific_style") ?? "").trim() || null,
    field_core: String(form.get("field_core") ?? "").trim() || null,
    emotional_distance: String(form.get("emotional_distance") ?? "").trim() || null,
    sentence_tempo: String(form.get("sentence_tempo") ?? "").trim() || null,
    endings: String(form.get("endings") ?? "").trim() || null,
    specialties,
    temperament: String(form.get("temperament") ?? "").trim() || null,
    speech_style: String(form.get("speech_style") ?? "").trim() || null,
    emotion_style: String(form.get("emotion_style") ?? "").trim() || null,
    strengths: String(form.get("strengths") ?? "").trim() || null,
    keywords,
    is_active: String(form.get("is_active") ?? "true") === "true",
  };

  await supabaseServer().from("character_personas").upsert(payload, { onConflict: "character_key" });
  return NextResponse.redirect(new URL("/admin#admin-personas", request.url));
}

