import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const key = String(form.get("key") ?? "yeonun_common_system").trim();
  const title = String(form.get("title") ?? "").trim();
  const prompt = String(form.get("prompt") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "true") === "true";

  const hash = key === "yeonun_common_system" ? "voice" : key === "yeonun_fortune_text_system" ? "fortune" : "dashboard";
  if (!key || !title || !prompt) return NextResponse.redirect(new URL(`/admin#${hash}`, request.url));

  await supabaseServer().from("service_prompts").upsert({ key, title, prompt, is_active }, { onConflict: "key" });
  return NextResponse.redirect(new URL(`/admin#${hash}`, request.url));
}

