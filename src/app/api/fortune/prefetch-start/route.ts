import { after, NextResponse } from "next/server";

import type { FortuneMenuStreamClientBody } from "@/lib/fortune-menu-stream-payload";
import {
  createFortuneServerPrefetchJob,
  runFortuneServerPrefetchJob,
} from "@/lib/fortune-server-prefetch";
import { gateFortunePrefetchStream } from "@/lib/llm-stream-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** Tank drain — Pro 800초 */
export const maxDuration = 800;

export async function POST(request: Request) {
  const denied = await gateFortunePrefetchStream(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as FortuneMenuStreamClientBody;
  const created = await createFortuneServerPrefetchJob(body);
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  const request_id = created.request_id;
  after(async () => {
    await runFortuneServerPrefetchJob(request_id);
  });

  return NextResponse.json({
    request_id,
    prefetch_access_token: created.prefetch_access_token,
    status: "streaming",
  });
}
