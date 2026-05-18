"use client";

import { readFortunePrefetch, type FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { runFortunePrefetch, type RunFortunePrefetchArgs } from "@/lib/fortune-ux/runFortunePrefetch";

type Listener = (prefetch: FortunePrefetchV1) => void;

type ActiveRun = {
  ac: AbortController;
  promise: Promise<void>;
  listeners: Set<Listener>;
};

const activeBySlug = new Map<string, ActiveRun>();

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

/** 컴포넌트 언마운트·결제 팝업에도 끊기지 않는 백그라운드 점사 스트림 */
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
  const promise = runFortunePrefetch({
    ...args,
    signal: ac.signal,
    onPatch: (prefetch) => {
      for (const fn of listeners) fn(prefetch);
    },
  }).finally(() => {
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
