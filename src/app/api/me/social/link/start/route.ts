import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireMyUserId } from "@/lib/my-route-auth";
import type { SocialProvider } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

const PROVIDERS = new Set<SocialProvider>(["google", "kakao", "naver"]);

function sanitizeReturnTo(raw: unknown): string {
  const v = String(raw ?? "/my").trim();
  if (!v.startsWith("/") || v.startsWith("//")) return "/my";
  return v;
}

export async function POST(request: NextRequest) {
  const auth = await requireMyUserId(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    returnTo?: string;
  };

  const provider = body.provider as SocialProvider;
  if (!PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, error: "invalid_provider" }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: false,
      error: "social_link_disabled",
      message: "Google·카카오·네이버는 각각 별도 로그인으로 이용해 주세요.",
    },
    { status: 403 },
  );
}
