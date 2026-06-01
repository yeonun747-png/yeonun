import { NextResponse } from "next/server";

import { collectConsultOwnerRefs, textChatSessionAccessibleBy } from "@/lib/consult-session-access";
import { optionalMyUserId } from "@/lib/my-route-auth";
import { getTextChatSessionDetail } from "@/lib/text-chat-history";
import { isUuidSessionId } from "@/lib/text-chat-history-public";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteCtx) {
  const { sessionId: raw } = await context.params;
  const sessionId = decodeURIComponent(String(raw ?? "").trim());
  if (!isUuidSessionId(sessionId)) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });
  }

  const userId = await optionalMyUserId(request);
  const ownerRefs = await collectConsultOwnerRefs(request, userId);
  if (!ownerRefs.length) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!(await textChatSessionAccessibleBy(sessionId, ownerRefs))) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const detail = await getTextChatSessionDetail(sessionId);
  if (!detail) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, detail });
}
