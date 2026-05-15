import { proxyFortuneMenuSseToResponse } from "@/lib/fortune-menu-stream-proxy";
import type { FortuneMenuCloudwaysBody } from "@/lib/fortune-menu-stream-payload";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** reunionf82 stream-proxy — Pro면 800초까지. Hobby는 플랫폼 상한(300초) 적용 */
export const maxDuration = 800;

type Body = {
  request_id?: string;
  upstream_body?: FortuneMenuCloudwaysBody;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  let upstream = body.upstream_body;

  const requestId = String(body.request_id ?? "").trim();
  if (!upstream && requestId) {
    try {
      const supabase = supabaseServer();
      const { data } = await supabase
        .from("fortune_requests")
        .select("payload")
        .eq("id", requestId)
        .maybeSingle();
      const p = data?.payload;
      if (p && typeof p === "object" && "cloudways_upstream" in p) {
        upstream = (p as { cloudways_upstream: FortuneMenuCloudwaysBody }).cloudways_upstream;
      }
    } catch {
      /* ignore */
    }
  }

  if (!upstream || typeof upstream !== "object") {
    return Response.json({ error: "upstream_body or request_id required" }, { status: 400 });
  }

  return proxyFortuneMenuSseToResponse(upstream, { clientSignal: request.signal });
}
