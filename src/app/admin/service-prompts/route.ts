import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const wantsJson = request.headers.get("accept")?.includes("application/json");
  const form = await request.formData();
  const key = String(form.get("key") ?? "yeonun_common_system").trim();
  const title = String(form.get("title") ?? "").trim();
  const prompt = String(form.get("prompt") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "true") === "true";

  const hash =
    key === "yeonun_common_system"
      ? "voice"
      : key === "yeonun_fortune_text_system"
        ? "fortune"
        : key === "yeonun_chat_text_system"
          ? "chat"
          : "dashboard";
  if (!key || !title || !prompt) {
    if (wantsJson) return NextResponse.json({ ok: false as const, error: "필수 항목을 채워 주세요." }, { status: 400 });
    return NextResponse.redirect(new URL(`/admin#${hash}`, request.url), 303);
  }

  await supabaseServer().from("service_prompts").upsert({ key, title, prompt, is_active }, { onConflict: "key" });
  if (wantsJson) return NextResponse.json({ ok: true as const });
  return NextResponse.redirect(new URL(`/admin#${hash}`, request.url), 303);
}

