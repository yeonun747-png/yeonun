import { NextResponse } from "next/server";

import { checkRateLimitAsync, clientIpFromRequest } from "@/lib/rate-limit";
import {
  countUnreadGuestInquiryRepliesByEmail,
  listGuestInquiriesByEmail,
  markGuestInquiryReplyReadByEmail,
} from "@/lib/user-inquiries-server";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) return null;
  return email;
}

async function rateLimitGuestHistory(request: Request, email: string): Promise<NextResponse | null> {
  const ip = clientIpFromRequest(request);
  const keys = [`inquiry-guest-hist:ip:${ip}`, `inquiry-guest-hist:email:${email}`];
  for (const key of keys) {
    if (!(await checkRateLimitAsync(key, 40, 60 * 60 * 1000))) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
  }
  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const p = body as Record<string, unknown>;
  const email = normalizeEmail(p.email);
  if (!email) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const limited = await rateLimitGuestHistory(request, email);
  if (limited) return limited;

  const id = String(p.id ?? "").trim();

  try {
    if (id) {
      const inquiry = await markGuestInquiryReplyReadByEmail(id, email);
      const unreadCount = await countUnreadGuestInquiryRepliesByEmail(email);
      return NextResponse.json({ ok: true, inquiry, unreadCount });
    }

    const inquiries = await listGuestInquiriesByEmail(email);
    const unreadCount = await countUnreadGuestInquiryRepliesByEmail(email);
    return NextResponse.json({ ok: true, inquiries, unreadCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "guest_history_failed";
    const status =
      msg === "forbidden" || msg === "invalid_id" || msg === "invalid_email"
        ? 403
        : msg === "not_found"
          ? 404
          : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
