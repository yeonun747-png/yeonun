import { proxyFortuneMenuSseToResponse } from "@/lib/fortune-menu-stream-proxy";
import type { FortuneMenuCloudwaysBody } from "@/lib/fortune-menu-stream-payload";
import { assertFortunePrefetchAccess } from "@/lib/consult-session-access";
import { gateFortuneStreamProxy } from "@/lib/llm-stream-gate";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** reunionf82 stream-proxy — Pro면 800초까지. Hobby는 플랫폼 상한(300초) 적용 */
export const maxDuration = 800;

type Body = {
  request_id?: string;
  prefetch_access_token?: string;
  upstream_body?: FortuneMenuCloudwaysBody;
};

export async function POST(request: Request) {
  // stream-session에서 발급한 pass가 있으면(이미 게이트 통과) IP 레이트리밋을 건너뛴다.
  // pass가 없을 때만 관대한 IP 게이트(fail-open) 적용 → 직접 호출 어뷰즈만 캡.
  const limited = await gateFortuneStreamProxy(request);
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as Body;
  let upstream = body.upstream_body;

  const requestId = String(body.request_id ?? "").trim();
  const prefetchAccess = String(body.prefetch_access_token ?? "").trim();

  if (!upstream && requestId) {
    const gate = await assertFortunePrefetchAccess(request, requestId, prefetchAccess);
    if (!gate.ok) return gate.response;
  }

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
