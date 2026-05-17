import { supabaseServer } from "@/lib/supabase/server";

export type LlmErrorService = "chat" | "voice" | "fortune";

/** 실패 이벤트 기록 (테이블 없으면 무시) */
export async function logLlmErrorEvent(service: LlmErrorService): Promise<void> {
  try {
    const sb = supabaseServer();
    await sb.from("llm_error_events").insert({ service });
  } catch {
    /* 집계 보조 — 본 요청 실패를 막지 않음 */
  }
}
