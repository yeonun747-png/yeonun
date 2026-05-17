import { NextResponse } from "next/server";

import { requireMyUserId } from "@/lib/my-route-auth";
import { groupVoiceHistoryByKstMonth, listVoiceCallHistoryRows } from "@/lib/voice-call-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  try {
    const rows = await listVoiceCallHistoryRows(auth.userId);
    const grouped = groupVoiceHistoryByKstMonth(rows);
    return NextResponse.json({ ok: true as const, grouped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
    return NextResponse.json({ ok: false as const, error: message }, { status: 500 });
  }
}
