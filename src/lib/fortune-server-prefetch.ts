import { randomBytes } from "node:crypto";

import { absoluteUrl } from "@/lib/site-url";
import { fetchFortuneMenuStreamUpstream } from "@/lib/fortune-menu-stream-upstream";
import {
  buildFortuneMenuCloudwaysBody,
  type FortuneMenuCloudwaysBody,
  type FortuneMenuStreamClientBody,
} from "@/lib/fortune-menu-stream-payload";
import { createFortunePrefetchPump } from "@/lib/fortune-prefetch-sse-engine";
import {
  inferFortunePrefetchComplete,
  normalizeFortunePrefetchSnapshot,
  type FortunePrefetchV1,
} from "@/lib/fortune-prefetch-storage";
import { buildFortunePrefetchContextKeyFromStreamUserInfo } from "@/lib/fortune-saju-fingerprint";
import type { DemoProfile } from "@/lib/fortune-two-stage-demo";
import { supabaseServer } from "@/lib/supabase/server";

export type FortuneRequestPrefetchPayload = {
  cloudways_upstream?: FortuneMenuCloudwaysBody;
  profile?: string;
  client_body?: FortuneMenuStreamClientBody;
  product_slug?: string;
  prefetch_snapshot?: FortunePrefetchV1;
  prefetch_error?: string;
  order_no?: string;
  prefetch_access_token?: string;
};

const DB_FLUSH_MS = 600;

function readPayload(raw: unknown): FortuneRequestPrefetchPayload {
  if (!raw || typeof raw !== "object") return {};
  return raw as FortuneRequestPrefetchPayload;
}

function snapshotFromPayload(payload: FortuneRequestPrefetchPayload): FortunePrefetchV1 | null {
  const s = payload.prefetch_snapshot;
  if (!s || s.v !== 1) return null;
  return s;
}

async function resolveOrderId(orderNo: string | undefined): Promise<string | null> {
  const no = String(orderNo ?? "").trim();
  if (!no) return null;
  try {
    const supabase = supabaseServer();
    const { data } = await supabase.from("orders").select("id").eq("order_no", no).maybeSingle();
    return data?.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

export async function createFortuneServerPrefetchJob(
  clientBody: FortuneMenuStreamClientBody,
): Promise<
  | { ok: true; request_id: string; prefetch_access_token: string }
  | { ok: false; error: string; status: number }
> {
  const built = await buildFortuneMenuCloudwaysBody(clientBody);
  if (!built.ok) {
    return { ok: false, error: built.error, status: built.status };
  }

  const { upstream, product_slug, profile } = built;
  const order_id = await resolveOrderId(clientBody.order_no);
  const prefetch_access_token = randomBytes(24).toString("base64url");

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("fortune_requests")
    .insert({
      product_slug,
      order_id,
      status: "streaming",
      model: String(upstream.model ?? "claude-sonnet-4-6"),
      payload: {
        cloudways_upstream: upstream,
        profile,
        client_body: clientBody,
        product_slug,
        order_no: clientBody.order_no,
        prefetch_access_token,
      } satisfies FortuneRequestPrefetchPayload,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "insert fortune_requests failed",
      status: 500,
    };
  }

  return { ok: true, request_id: String(data.id), prefetch_access_token };
}

export async function readFortuneServerPrefetchSnapshot(requestId: string): Promise<{
  request_id: string;
  status: string;
  snapshot: FortunePrefetchV1 | null;
  error: string | null;
}> {
  const id = requestId.trim();
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("fortune_requests")
    .select("status,payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { request_id: id, status: "unknown", snapshot: null, error: error?.message ?? "not_found" };
  }

  const payload = readPayload(data.payload);
  const status = String(data.status ?? "unknown");
  let snapshot = snapshotFromPayload(payload);
  if (snapshot) snapshot = normalizeFortunePrefetchSnapshot(snapshot);
  return {
    request_id: id,
    status,
    snapshot,
    error: payload.prefetch_error ?? null,
  };
}

async function persistPrefetchSnapshot(
  requestId: string,
  snapshot: FortunePrefetchV1,
  prefetchError?: string,
): Promise<void> {
  const supabase = supabaseServer();
  const { data } = await supabase.from("fortune_requests").select("payload").eq("id", requestId).maybeSingle();
  const prev = readPayload(data?.payload);
  const normalized = normalizeFortunePrefetchSnapshot(snapshot);
  const status = prefetchError ? "failed" : normalized.complete ? "completed" : "streaming";
  const payload: FortuneRequestPrefetchPayload = {
    ...prev,
    prefetch_snapshot: normalized,
    ...(prefetchError ? { prefetch_error: prefetchError } : {}),
  };
  await supabase
    .from("fortune_requests")
    .update({ status, payload })
    .eq("id", requestId);
}

/** Cloudways SSE drain → `fortune_requests.payload.prefetch_snapshot` (클라이언트 signal 무시) */
export async function runFortuneServerPrefetchJob(requestId: string): Promise<void> {
  const id = requestId.trim();
  if (!id) return;

  const supabase = supabaseServer();
  const { data: row } = await supabase
    .from("fortune_requests")
    .select("status,payload")
    .eq("id", id)
    .maybeSingle();

  if (!row) return;

  const payload = readPayload(row.payload);
  const upstream = payload.cloudways_upstream;
  const clientBody = payload.client_body;
  const profile = (payload.profile ?? clientBody?.profile ?? "solo") as DemoProfile;

  if (!upstream || typeof upstream !== "object") {
    await persistPrefetchSnapshot(id, snapshotFromPayload(payload) ?? emptySnapshot(), "missing_upstream");
    return;
  }

  let lastDbFlush = 0;
  // 업스트림이 첫 이벤트를 보내기 전에 실패하면 snapshot이 null인 채로 영원히 "streaming"에 남을 수 있다.
  // 최소 스냅샷을 미리 잡아두고, 실패 시에도 DB에 기록해 상태가 전이되도록 한다.
  let pendingSnapshot: FortunePrefetchV1 | null = snapshotFromPayload(payload) ?? emptySnapshot();

  const flushDb = async (failed?: string) => {
    if (!pendingSnapshot) pendingSnapshot = emptySnapshot();
    await persistPrefetchSnapshot(id, pendingSnapshot, failed);
  };

  const throttledDbFlush = async (forceFlush: boolean) => {
    const now = Date.now();
    if (!forceFlush && now - lastDbFlush < DB_FLUSH_MS) return;
    lastDbFlush = now;
    await flushDb();
  };

  const pump = createFortunePrefetchPump({
    profile,
    initial: snapshotFromPayload(payload),
    scheduleSectionFix: false,
    contextKey: buildFortunePrefetchContextKeyFromStreamUserInfo(clientBody?.user_info) ?? null,
    onSnapshot: (snap) => {
      pendingSnapshot = normalizeFortunePrefetchSnapshot(snap);
      void throttledDbFlush(inferFortunePrefetchComplete(pendingSnapshot));
    },
  });

  if (pump.isAlreadyComplete) {
    await flushDb();
    return;
  }

  try {
    let res = await fetchFortuneMenuStreamUpstream(upstream);
    const menuStreamOk =
      res.ok &&
      res.body &&
      (res.headers.get("content-type") ?? "").toLowerCase().includes("text/event-stream");

    if (menuStreamOk && res.body) {
      await pump.pumpSseBody(res.body.getReader(), "sections");
      pump.finalizeMenuSectionsStream(false);
      if (pendingSnapshot) pendingSnapshot = normalizeFortunePrefetchSnapshot(pendingSnapshot);
      await flushDb();
      return;
    }

    if (clientBody) {
      res = await fetch(absoluteUrl("/api/fortune/chat-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(clientBody),
        cache: "no-store",
      });

      if (res.status === 501 && clientBody.product_slug) {
        res = await fetch(absoluteUrl("/api/fortune/two-stage-demo"), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            product_slug: clientBody.product_slug,
            profile,
            manse_context: clientBody.manse_ryeok_text,
            character_key: clientBody.character_key,
            order_no: clientBody.order_no,
          }),
          cache: "no-store",
        });
        if (res.ok && res.body) {
          await pump.pumpSseBody(res.body.getReader(), "sections");
          pump.finalizeMenuSectionsStream(false);
          if (pendingSnapshot) pendingSnapshot = normalizeFortunePrefetchSnapshot(pendingSnapshot);
          await flushDb();
          return;
        }
      }

      if (res.ok && res.body) {
        await pump.pumpSseBody(res.body.getReader(), "claude_html_stream");
        pump.finalizeClaudeHtmlStream(false);
        if (pendingSnapshot) pendingSnapshot = normalizeFortunePrefetchSnapshot(pendingSnapshot);
        await flushDb();
        return;
      }
    }

    await flushDb("upstream_failed");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "prefetch_job_failed";
    await flushDb(msg.slice(0, 500));
  }
}

function emptySnapshot(): FortunePrefetchV1 {
  return {
    v: 1,
    sectionsMode: true,
    complete: false,
    toc: [],
    toc_groups: null,
    sectionHtml: {},
    doneIdx: [],
    claudeStreamMode: false,
    claudeStreamHtml: "",
    updatedAt: Date.now(),
  };
}
