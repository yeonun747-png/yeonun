import { NextResponse } from "next/server";

import { groupVoiceHistoryByKstMonth, listVoiceCallHistoryRows } from "@/lib/voice-call-history";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await listVoiceCallHistoryRows();
    const grouped = groupVoiceHistoryByKstMonth(rows);
    return NextResponse.json({ ok: true as const, grouped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
