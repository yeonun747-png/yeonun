import { NextResponse } from "next/server";

import { isLoggedInUserId } from "@/lib/credit-server";
import { assertOrderCallerAccess } from "@/lib/order-access";
import { supabaseServer } from "@/lib/supabase/server";

import type { FortuneRequestPrefetchPayload } from "@/lib/fortune-server-prefetch";

function readPayload(raw: unknown): FortuneRequestPrefetchPayload {
  if (!raw || typeof raw !== "object") return {};
  return raw as FortuneRequestPrefetchPayload;
}

/** prefetch snapshot / stream-proxy 접근 — access token + (주문 있으면) order gate */
export async function assertFortunePrefetchAccess(
  request: Request,
  requestId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const id = String(requestId ?? "").trim();
  const token = String(accessToken ?? "").trim();
  if (!id || !token) {
    return { ok: false, response: NextResponse.json({ error: "prefetch_forbidden" }, { status: 403 }) };
  }

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return { ok: false, response: NextResponse.json({ error: "server_misconfigured" }, { status: 503 }) };
  }

  const { data, error } = await sb
    .from("fortune_requests")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, response: NextResponse.json({ error: "prefetch_not_found" }, { status: 404 }) };
  }

  const payload = readPayload(data.payload);
  const expected = String(payload.prefetch_access_token ?? "").trim();
  if (!expected || expected !== token) {
    return { ok: false, response: NextResponse.json({ error: "prefetch_forbidden" }, { status: 403 }) };
  }

  const orderNo = String(payload.order_no ?? "").trim();
  if (orderNo) {
    const orderGate = await assertOrderCallerAccess(request, orderNo);
    if (!orderGate.ok) return { ok: false, response: orderGate.response };
  }

  return { ok: true };
}

export async function collectConsultOwnerRefs(
  request: Request,
  userId: string | null,
): Promise<string[]> {
  const refs: string[] = [];
  if (userId && isLoggedInUserId(userId)) refs.push(userId);
  const visitor = request.headers.get("x-yeonun-visitor-ref")?.trim();
  if (visitor?.startsWith("visitor_")) refs.push(visitor);
  return refs;
}

export async function voiceSessionAccessibleBy(
  sessionId: string,
  ownerRefs: string[],
): Promise<boolean> {
  if (!ownerRefs.length) return false;
  const id = String(sessionId ?? "").trim();
  if (!id) return false;

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return false;
  }

  const { data } = await sb.from("voice_sessions").select("user_ref").eq("id", id).maybeSingle();
  const ref = String(data?.user_ref ?? "").trim();
  if (!ref || ref.startsWith("purged_")) return false;
  return ownerRefs.includes(ref);
}

export async function textChatSessionAccessibleBy(
  sessionId: string,
  ownerRefs: string[],
): Promise<boolean> {
  if (!ownerRefs.length) return false;
  const id = String(sessionId ?? "").trim();
  if (!id) return false;

  let sb;
  try {
    sb = supabaseServer();
  } catch {
    return false;
  }

  const { data } = await sb
    .from("text_chat_sessions")
    .select("user_ref")
    .eq("id", id)
    .maybeSingle();
  const ref = String(data?.user_ref ?? "").trim();
  if (!ref || ref.startsWith("purged_")) return false;
  return ownerRefs.includes(ref);
}
