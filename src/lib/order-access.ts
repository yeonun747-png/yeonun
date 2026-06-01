import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { isLoggedInUserId } from "@/lib/credit-server";
import { optionalMyUserId } from "@/lib/my-route-auth";
import { supabaseServer } from "@/lib/supabase/server";

import { ORDER_ACCESS_TOKEN_HEADER } from "@/lib/order-access-constants";

export { ORDER_ACCESS_TOKEN_HEADER };

function hmacSecret(): string {
  const dedicated = process.env.ORDER_ACCESS_HMAC_SECRET?.trim();
  if (dedicated) return dedicated;
  if (process.env.NODE_ENV === "production") return "";
  return (
    process.env.CLOUDWAYS_PROXY_SECRET?.trim() ||
    process.env.FORTUNE_COMPLETE_SECRET?.trim() ||
    ""
  );
}

export function mintOrderAccessToken(orderNo: string): string | null {
  const secret = hmacSecret();
  const oid = String(orderNo ?? "").trim();
  if (!secret || !oid) return null;
  return createHmac("sha256", secret).update(oid).digest("base64url");
}

export function verifyOrderAccessToken(orderNo: string, token: string): boolean {
  const expected = mintOrderAccessToken(orderNo);
  const got = String(token ?? "").trim();
  if (!expected || !got) return false;
  try {
    const a = Buffer.from(got, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readOrderAccessTokenFromRequest(request: Request): string {
  return request.headers.get(ORDER_ACCESS_TOKEN_HEADER)?.trim() ?? "";
}

type OrderRow = {
  id: string;
  order_no: string;
  status: string;
  user_ref: string | null;
  product_slug: string | null;
};

export async function loadOrderByNo(orderNo: string): Promise<OrderRow | null> {
  const oid = String(orderNo ?? "").trim();
  if (!oid) return null;
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("orders")
    .select("id,order_no,status,user_ref,product_slug")
    .eq("order_no", oid)
    .maybeSingle();
  return (data as OrderRow | null) ?? null;
}

/** 주문 소유권: JWT uid 일치 또는 checkout 시 발급 HMAC 토큰 */
export async function assertOrderCallerAccess(
  request: Request,
  orderNo: string,
): Promise<{ ok: true; order: OrderRow } | { ok: false; response: NextResponse }> {
  const order = await loadOrderByNo(orderNo);
  if (!order) {
    return { ok: false, response: NextResponse.json({ error: "order_not_found" }, { status: 404 }) };
  }

  const token = readOrderAccessTokenFromRequest(request);
  if (verifyOrderAccessToken(orderNo, token)) {
    return { ok: true, order };
  }

  const uid = await optionalMyUserId(request);
  if (uid && isLoggedInUserId(uid) && order.user_ref === uid) {
    return { ok: true, order };
  }

  return { ok: false, response: NextResponse.json({ error: "order_forbidden" }, { status: 403 }) };
}

/** 점사 LLM: paid(또는 pending+토큰) + 소유권 */
export async function assertPaidFortuneStreamAccess(
  request: Request,
  orderNo: string,
): Promise<{ ok: true; order: OrderRow } | { ok: false; response: NextResponse }> {
  const access = await assertOrderCallerAccess(request, orderNo);
  if (!access.ok) return access;

  const status = String(access.order.status ?? "");
  if (status === "paid") return access;

  const token = readOrderAccessTokenFromRequest(request);
  if (status === "pending" && verifyOrderAccessToken(orderNo, token)) {
    return access;
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "order_not_paid" }, { status: 402 }),
  };
}
