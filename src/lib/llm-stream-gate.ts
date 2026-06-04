import { NextResponse } from "next/server";

import { CREDIT_CHAT_PER_USER_MESSAGE } from "@/lib/credit-policy";
import { ageGateToNextResponse, assertUserAge14Plus } from "@/lib/age-policy";
import { assertPaidFortuneStreamAccess } from "@/lib/order-access";
import { optionalMyUserId } from "@/lib/my-route-auth";
import { checkRateLimitAsync, clientIpFromRequest } from "@/lib/rate-limit";
import { verifyFortuneStreamToken } from "@/lib/fortune-stream-direct-token";

const HOUR_MS = 60 * 60 * 1000;

/**
 * 연운 절대원칙: 점사는 막히면 안 되고 시작이 빨라야 한다.
 * 레이트리밋은 "자동화 어뷰즈만 차단"이 목적이므로 실사용자가 절대 닿지 않을 만큼
 * 관대하게 두고, 의심 상황(IP 미상·인프라 장애)에서는 항상 통과(fail-open)시킨다.
 */
const FORTUNE_PREFETCH_HOURLY_LIMIT = 240;
const FORTUNE_STREAM_HOURLY_LIMIT = 240;

const FORTUNE_STREAM_PASS_HEADER = "x-fortune-stream-pass";

/**
 * stream-session에서 결제/소유권 게이트를 통과한 호출자에게 발급한 단기 토큰.
 * 보유 시 stream-proxy 등 후속 단계의 IP 레이트리밋을 건너뛴다(이중 차감·재검증 제거).
 */
export function hasValidFortuneStreamPass(request: Request): boolean {
  const pass = request.headers.get(FORTUNE_STREAM_PASS_HEADER)?.trim() ?? "";
  if (!pass) return false;
  return verifyFortuneStreamToken(pass);
}

/** IP 기반 관대 레이트리밋. IP 미상·인프라 오류면 통과(fail-open). */
async function allowByIp(request: Request, bucketPrefix: string, limit: number): Promise<boolean> {
  const ip = clientIpFromRequest(request);
  if (!ip || ip === "unknown") return true;
  try {
    return await checkRateLimitAsync(`${bucketPrefix}:${ip}`, limit, HOUR_MS);
  } catch {
    return true;
  }
}

/** order_no 없는 prefetch/워밍 — 관대한 IP 레이트리밋만(fail-open) */
export async function gateFortunePrefetchStream(request: Request): Promise<NextResponse | null> {
  if (await allowByIp(request, "fortune-prefetch", FORTUNE_PREFETCH_HOURLY_LIMIT)) return null;
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}

/**
 * stream-proxy 전용 게이트.
 * 유효한 stream pass가 있으면(= stream-session에서 이미 게이트 통과) 즉시 통과시켜
 * IP 레이트리밋 이중 차감과 재검증 지연을 없앤다. pass가 없을 때만 관대 IP 게이트 적용.
 */
export async function gateFortuneStreamProxy(request: Request): Promise<NextResponse | null> {
  if (hasValidFortuneStreamPass(request)) return null;
  if (await allowByIp(request, "fortune-stream", FORTUNE_STREAM_HOURLY_LIMIT)) return null;
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}

export async function gateFortuneOrderStream(
  request: Request,
  orderNo: string | null | undefined,
): Promise<NextResponse | null> {
  const oid = String(orderNo ?? "").trim();
  if (!oid) return gateFortunePrefetchStream(request);

  // 결제·소유권 검증은 절대원칙에도 불구하고 유지(무결성·과금 보호). IP 레이트리밋은 부과하지 않음.
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
  if (ip && ip !== "unknown") {
    let allowed = true;
    try {
      allowed = await checkRateLimitAsync(`consult-anon:${ip}`, 8, HOUR_MS);
    } catch {
      allowed = true;
    }
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "rate_limited" }, { status: 429 }) };
    }
  }
  return { ok: true, userId: null };
}

export { CREDIT_CHAT_PER_USER_MESSAGE };
