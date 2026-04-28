import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const model = String(form.get("model") ?? "claude-4.6-sonnet").trim();
  const system_prompt = String(form.get("system_prompt") ?? "").trim();
  const is_active = String(form.get("is_active") ?? "false") === "true";

  if (!name || !model || !system_prompt) return NextResponse.redirect(new URL("/admin#fortune", request.url));

  const supabase = supabaseServer();
  const payload = { name, model, system_prompt, schema: {}, is_active };

  if (is_active) {
    await supabase.from("fortune_prompt_versions").update({ is_active: false }).neq("id", id || "00000000-0000-0000-0000-000000000000");
  }

  if (id) await supabase.from("fortune_prompt_versions").update(payload).eq("id", id);
  else await supabase.from("fortune_prompt_versions").insert(payload);

  return NextResponse.redirect(new URL("/admin#fortune", request.url));
}

