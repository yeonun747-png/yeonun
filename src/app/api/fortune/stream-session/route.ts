import { NextResponse } from "next/server";

import { normalizeCloudwaysBaseUrl } from "@/lib/cloudways-base-url";
import {
  buildFortuneMenuCloudwaysBody,
  type FortuneMenuStreamClientBody,
} from "@/lib/fortune-menu-stream-payload";
import { createFortuneStreamToken } from "@/lib/fortune-stream-direct-token";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as FortuneMenuStreamClientBody;
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

  const publicUrl = normalizeCloudwaysBaseUrl(String(process.env.NEXT_PUBLIC_CLOUDWAYS_URL || ""));
  const stream_token = createFortuneStreamToken();

  if (publicUrl && stream_token) {
    return NextResponse.json({
      mode: "direct",
      request_id,
      stream_url: publicUrl,
      stream_token,
      upstream_body: upstream,
    });
  }

  return NextResponse.json({
    mode: "proxy",
    request_id,
    upstream_body: upstream,
  });
}
