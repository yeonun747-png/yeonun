import { NextResponse } from "next/server";

import { optionalMyUserId } from "@/lib/my-route-auth";
import { checkRateLimitAsync, clientIpFromRequest } from "@/lib/rate-limit";
import { createUserInquiry } from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await optionalMyUserId(request);
  const ip = clientIpFromRequest(request);
  const rateKey = userId ? `inquiry:user:${userId}` : `inquiry:ip:${ip}`;
  const rateLimit = userId ? 20 : 8;

  if (!(await checkRateLimitAsync(rateKey, rateLimit, 60 * 60 * 1000))) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const p = body as Record<string, unknown>;
  const name = String(p.name ?? "");
  const email = String(p.email ?? "");
  const phone = String(p.phone ?? "");
  const content = String(p.body ?? p.content ?? "");

  try {
    const row = await createUserInquiry({
      userId,
      name,
      email,
      phone,
      body: content,
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "submit_failed";
    const status = msg.includes("입력") || msg.includes("이메일") || msg.includes("전화") || msg.includes("문의") ? 400 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
