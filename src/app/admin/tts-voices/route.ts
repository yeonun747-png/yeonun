import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const external_id = String(form.get("external_id") ?? "").trim();
  const gender = String(form.get("gender") ?? "other").trim();
  const sort_order = Number(form.get("sort_order") ?? 0);
  const is_active = String(form.get("is_active") ?? "true") === "true";

  if (!label || !external_id) return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);

  const provider = String(form.get("provider") ?? "openai_realtime").trim() || "openai_realtime";
  const row = {
    ...(id ? { id } : {}),
    provider,
    label,
    external_id,
    gender: gender === "female" || gender === "male" ? gender : "other",
    sort_order: Number.isFinite(sort_order) ? sort_order : 0,
    is_active,
  };

  await supabaseServer().from("tts_voices").upsert(row, { onConflict: "provider,external_id" });
  return NextResponse.redirect(new URL("/admin#admin-tts-voices", request.url), 303);
}
