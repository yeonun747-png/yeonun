import { NextResponse } from "next/server";

import { logLlmErrorEvent } from "@/lib/llm-error-log";

export const dynamic = "force-dynamic";

/** 클라이언트 스트림 실패 시 집계용 (본문 없음) */
export async function POST() {
  await logLlmErrorEvent("chat");
  return NextResponse.json({ ok: true });
}
