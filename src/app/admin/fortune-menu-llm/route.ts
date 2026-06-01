import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import {
  FORTUNE_MENU_LLM_SERVICE_KEY,
  isAllowedFortuneMenuLlmModelId,
} from "@/lib/fortune-menu-llm-model";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ ok: false as const, error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { model?: unknown };
  const model = String(body?.model ?? "").trim();
  if (!isAllowedFortuneMenuLlmModelId(model)) {
    return NextResponse.json({ ok: false as const, error: "invalid_model" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { error } = await supabase.from("service_prompts").upsert(
    {
      key: FORTUNE_MENU_LLM_SERVICE_KEY,
      title: "점사 메뉴 스트림 — LLM 모델",
      prompt: model,
      is_active: true,
    },
    { onConflict: "key" },
  );
  if (error) {
    return NextResponse.json({ ok: false as const, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true as const });
}
