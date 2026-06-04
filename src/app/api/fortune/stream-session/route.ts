import { NextResponse } from "next/server";

import {
  buildFortuneMenuCloudwaysBody,
  type FortuneMenuStreamClientBody,
} from "@/lib/fortune-menu-stream-payload";
import { createFortuneStreamToken } from "@/lib/fortune-stream-direct-token";
import { gateFortuneOrderStream } from "@/lib/llm-stream-gate";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as FortuneMenuStreamClientBody;
  const denied = await gateFortuneOrderStream(request, body.order_no);
  if (denied) return denied;

  const built = await buildFortuneMenuCloudwaysBody(body);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  const { upstream, product_slug, profile } = built;
  let request_id: string | null = null;

  try {
    const supabase = supabaseServer();
    const { data } = await supabase
      .from("fortune_requests")
      .insert({
        product_slug,
        status: "streaming",
        model: String(upstream.model ?? "claude-sonnet-4-6"),
        payload: {
          cloudways_upstream: upstream,
          profile,
          client_body: body,
        },
      })
      .select("id")
      .maybeSingle();
    request_id = data?.id ? String(data.id) : null;
  } catch {
    /* fortune_requests 없어도 스트림은 진행 */
  }

  // 브라우저 → Cloudways 직접 /chat 은 CORS 때문에 실패하는 경우가 많음. Next stream-proxy 경유가 기본.
  // stream_pass: 여기서 결제/소유권 게이트를 통과했음을 증명 → stream-proxy가 IP 레이트리밋을 건너뛰게 함.
  return NextResponse.json({
    mode: "proxy",
    request_id,
    stream_pass: createFortuneStreamToken(),
    upstream_body: upstream,
  });
}
