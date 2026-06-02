"use client";

import {
  clearFortunePrefetchProduct,
  inferFortunePrefetchComplete,
  normalizeFortunePrefetchSnapshot,
  readFortunePrefetch,
  readFortunePrefetchContextKey,
  readServerPrefetchAccessToken,
  readServerPrefetchRequestId,
  writeFortunePrefetch,
  writeServerPrefetchCredentials,
  type FortunePrefetchV1,
} from "@/lib/fortune-prefetch-storage";
import { buildFortunePrefetchStreamBody } from "@/lib/fortune-prefetch-stream-body";
import { runFortunePrefetch, type RunFortunePrefetchArgs } from "@/lib/fortune-ux/runFortunePrefetch";

type Listener = (prefetch: FortunePrefetchV1) => void;

type ActiveRun = {
  ac: AbortController;
  promise: Promise<void>;
  listeners: Set<Listener>;
};

const activeBySlug = new Map<string, ActiveRun>();

const SERVER_PREFETCH_POLL_MS = 1200;
/** 서버 `after()` Tank가 안 돌거나 Cloudways 연결 실패 시 이 시간 후 브라우저 스트림으로 폴백 */
const SERVER_PREFETCH_STALL_MS = 25_000;

function useServerTankPrefetch(): boolean {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_FORTUNE_SERVER_PREFETCH === "0") {
    return false;
  }
  return true;
}

export function isFortunePrefetchActive(productSlug: string): boolean {
  const slug = productSlug.trim();
  if (!slug) return false;
  const run = activeBySlug.get(slug);
  return Boolean(run && !run.ac.signal.aborted);
}

export function subscribeFortunePrefetch(productSlug: string, listener: Listener): () => void {
  const slug = productSlug.trim();
  const run = activeBySlug.get(slug);
  if (!run) {
    const cached = readFortunePrefetch(slug);
    if (cached) listener(cached);
    return () => {};
  }
  run.listeners.add(listener);
  const cached = readFortunePrefetch(slug);
  if (cached) listener(cached);
  return () => {
    run.listeners.delete(listener);
  };
}

async function runFortuneServerPrefetchDetached(
  args: Omit<RunFortunePrefetchArgs, "signal" | "onPatch"> & { onPatch?: (prefetch: FortunePrefetchV1) => void },
  ac: AbortController,
  listeners: Set<Listener>,
): Promise<void> {
  const slug = args.productSlug.trim();
  const streamBody = buildFortunePrefetchStreamBody(args);

  const notify = (raw: FortunePrefetchV1) => {
    const prefetch = normalizeFortunePrefetchSnapshot(raw);
    writeFortunePrefetch(slug, prefetch);
    for (const fn of listeners) fn(prefetch);
    args.onPatch?.(prefetch);
  };

  const ctxKey = readFortunePrefetchContextKey();
  if (!ctxKey) {
    clearFortunePrefetchProduct(slug);
    throw new Error("prefetch: saju context missing");
  }

  const cached = readFortunePrefetch(slug);
  if (cached?.complete) {
    notify(cached);
    return;
  }

  let requestId = readServerPrefetchRequestId(slug);
  let prefetchAccess = readServerPrefetchAccessToken(slug);

  if (requestId && !cached) {
    clearFortunePrefetchProduct(slug);
    requestId = "";
    prefetchAccess = "";
  }

  if (!requestId) {
    const startRes = await fetch("/api/fortune/prefetch-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(streamBody),
      signal: ac.signal,
    });
    if (!startRes.ok) {
      throw new Error(`prefetch-start failed: ${startRes.status}`);
    }
    const started = (await startRes.json()) as { request_id?: string; prefetch_access_token?: string };
    requestId = String(started.request_id ?? "").trim();
    prefetchAccess = String(started.prefetch_access_token ?? "").trim();
    if (!requestId || !prefetchAccess) throw new Error("prefetch-start missing credentials");
    writeServerPrefetchCredentials(slug, requestId, prefetchAccess);
  }

  if (!prefetchAccess) {
    prefetchAccess = readServerPrefetchAccessToken(slug);
  }
  if (!prefetchAccess) {
    throw new Error("prefetch access token missing — prefetch-start again");
  }

  const pollStartedAt = Date.now();
  let lastSnapshotProgressAt = pollStartedAt;

  const pollOnce = async (): Promise<"done" | "give_up" | "continue"> => {
    if (ac.signal.aborted) return "done";
    const url = `/api/fortune/prefetch-snapshot?request_id=${encodeURIComponent(requestId!)}&access_token=${encodeURIComponent(prefetchAccess!)}`;
    const res = await fetch(url, { cache: "no-store", signal: ac.signal });
    if (!res.ok) return "continue";
    const data = (await res.json()) as {
      status?: string;
      snapshot?: FortunePrefetchV1 | null;
      error?: string | null;
    };
    if (data.snapshot?.v === 1) {
      lastSnapshotProgressAt = Date.now();
      notify(data.snapshot);
      if (data.snapshot.complete || inferFortunePrefetchComplete(data.snapshot)) return "done";
    }
    const st = String(data.status ?? "");
    if (st === "completed") {
      const snap = data.snapshot?.v === 1 ? data.snapshot : readFortunePrefetch(slug);
      if (snap) {
        lastSnapshotProgressAt = Date.now();
        notify(snap);
      }
      if (snap && (snap.complete || inferFortunePrefetchComplete(snap))) return "done";
      return "continue";
    }
    /** 서버 Tank 실패 — 폴링만 멈추지 말고 브라우저 스트림 폴백으로 넘김 */
    if (st === "failed") return "give_up";

    const stalledMs = Date.now() - pollStartedAt;
    const sinceProgressMs = Date.now() - lastSnapshotProgressAt;
    if (stalledMs >= SERVER_PREFETCH_STALL_MS && sinceProgressMs >= SERVER_PREFETCH_STALL_MS) {
      return "give_up";
    }
    return "continue";
  };

  await new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const finish = (err?: unknown) => {
      if (timer) clearInterval(timer);
      ac.signal.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve();
    };

    const onAbort = () => finish();

    const tick = async () => {
      try {
        const r = await pollOnce();
        if (r === "done") finish();
        if (r === "give_up") finish(new Error("server_prefetch_stalled"));
      } catch (e) {
        if (ac.signal.aborted) finish();
        else finish(e);
      }
    };

    ac.signal.addEventListener("abort", onAbort);
    void tick();
    timer = setInterval(() => void tick(), SERVER_PREFETCH_POLL_MS);
  });
}

/** 컴포넌트 언마운트·결제 팝업에도 끊기지 않는 백그라운드 점사 — 기본은 서버 Tank + 스냅샷 폴링 */
export function runFortunePrefetchDetached(
  args: Omit<RunFortunePrefetchArgs, "signal" | "onPatch"> & { onPatch?: (prefetch: FortunePrefetchV1) => void },
): Promise<void> {
  const slug = args.productSlug.trim();
  const existing = activeBySlug.get(slug);
  if (existing && !existing.ac.signal.aborted) {
    if (args.onPatch) {
      existing.listeners.add(args.onPatch);
      const cached = readFortunePrefetch(slug);
      if (cached) args.onPatch(cached);
    }
    return existing.promise;
  }

  const listeners = new Set<Listener>();
  if (args.onPatch) listeners.add(args.onPatch);

  const ac = new AbortController();

  const promise = (async () => {
    if (useServerTankPrefetch()) {
      try {
        await runFortuneServerPrefetchDetached(args, ac, listeners);
        return;
      } catch {
        if (ac.signal.aborted) return;
        /* 서버 Tank 실패 시 브라우저 스트림 폴백 */
      }
    }

    await runFortunePrefetch({
      ...args,
      signal: ac.signal,
      onPatch: (prefetch) => {
        for (const fn of listeners) fn(prefetch);
      },
    });
  })().finally(() => {
    const cur = activeBySlug.get(slug);
    if (cur?.ac === ac) activeBySlug.delete(slug);
  });

  activeBySlug.set(slug, { ac, promise, listeners });
  return promise;
}

export function abortFortunePrefetch(productSlug: string): void {
  const slug = productSlug.trim();
  const run = activeBySlug.get(slug);
  if (!run) return;
  run.ac.abort();
  activeBySlug.delete(slug);
}

export function abortAllFortunePrefetch(): void {
  for (const slug of [...activeBySlug.keys()]) {
    abortFortunePrefetch(slug);
  }
}
