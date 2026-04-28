import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

const TABLES = new Set(["orders", "payments", "voice_sessions", "fortune_requests", "fortune_prompt_versions", "webhook_events"]);

export async function POST(request: Request) {
  const form = await request.formData();
  const table = String(form.get("table") ?? "").trim();
  const id = String(form.get("id") ?? "").trim();
  const status = String(form.get("status") ?? "").trim();
  const hash = String(form.get("hash") ?? "").trim() || "dashboard";

  if (!TABLES.has(table) || !id || !status) return NextResponse.redirect(new URL(`/admin#${hash}`, request.url));

  const payload: Record<string, unknown> = { status };
  if (table === "orders" || table === "payments" || table === "voice_sessions" || table === "fortune_requests") {
    payload.updated_at = new Date().toISOString();
  }
  if (table === "payments" && status === "paid") payload.paid_at = new Date().toISOString();
  if (table === "webhook_events" && status === "processed") payload.processed_at = new Date().toISOString();

  await supabaseServer().from(table).update(payload).eq("id", id);
  return NextResponse.redirect(new URL(`/admin#${hash}`, request.url));
}

