import { NextResponse } from "next/server";

import { CREDIT_CHAT_PER_USER_MESSAGE } from "@/lib/credit-policy";
import { ageGateToNextResponse, assertUserAge14Plus } from "@/lib/age-policy";
import { assertPaidFortuneStreamAccess } from "@/lib/order-access";
import { optionalMyUserId } from "@/lib/my-route-auth";
import { checkRateLimitAsync, clientIpFromRequest } from "@/lib/rate-limit";

/** order_no 없는 prefetch — IP rate limit만 */
export async function gateFortunePrefetchStream(request: Request): Promise<NextResponse | null> {
  const ip = clientIpFromRequest(request);
  if (!(await checkRateLimitAsync(`fortune-prefetch:${ip}`, 40, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  return null;
}

export async function gateFortuneOrderStream(
  request: Request,
  orderNo: string | null | undefined,
): Promise<NextResponse | null> {
  const oid = String(orderNo ?? "").trim();
  if (!oid) return gateFortunePrefetchStream(request);

  const denied = await assertPaidFortuneStreamAccess(request, oid);
  if (!denied.ok) return denied.response;
  return null;
}

export async function gateConsultStream(
  request: Request,
): Promise<{ ok: true; userId: string | null } | { ok: false; response: NextResponse }> {
  const uid = await optionalMyUserId(request);
  if (uid) {
    const ageGate = await assertUserAge14Plus(uid);
    const denied = ageGateToNextResponse(ageGate);
    if (denied) return { ok: false, response: denied };
    return { ok: true, userId: uid };
  }

  const ip = clientIpFromRequest(request);
  if (!(await checkRateLimitAsync(`consult-anon:${ip}`, 8, 60 * 60 * 1000))) {
    return { ok: false, response: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
  }
  return { ok: true, userId: null };
}

export { CREDIT_CHAT_PER_USER_MESSAGE };
