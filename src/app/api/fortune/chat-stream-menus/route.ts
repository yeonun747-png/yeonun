import { NextResponse } from "next/server";

import {
  buildFortuneMenuCloudwaysBody,
  type FortuneMenuStreamClientBody,
} from "@/lib/fortune-menu-stream-payload";
import { proxyFortuneMenuSseToResponse } from "@/lib/fortune-menu-stream-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** reunionf82 stream-proxy 폴백 — Pro 800초, Hobby는 플랫폼 상한 */
export const maxDuration = 800;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as FortuneMenuStreamClientBody;
  const built = await buildFortuneMenuCloudwaysBody(body);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  return proxyFortuneMenuSseToResponse(built.upstream, { clientSignal: request.signal });
}
