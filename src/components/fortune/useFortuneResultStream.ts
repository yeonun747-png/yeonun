"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FortuneResultState } from "@/components/fortune/fortuneFlowTypes";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";
import { readFortunePrefetch, type FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import { runFortunePrefetch } from "@/lib/fortune-ux/runFortunePrefetch";

export type FortuneResultStreamPhase = "idle" | "cache" | "streaming" | "done" | "error";

export function fortuneResultFromPrefetch(
  prefetch: FortunePrefetchV1 | null,
  profile: DemoProfile,
  orderNo: string | null,
  allowPartial = false,
): FortuneResultState | null {
  if (!prefetch) return null;
  const hasSections = Object.keys(prefetch.sectionHtml).length > 0;
  const hasClaude = prefetch.claudeStreamHtml.trim().length > 0;
  if (!prefetch.complete && !allowPartial) return null;
  if (!hasSections && !hasClaude) return null;
  return {
    toc: prefetch.toc.length ? prefetch.toc : demoTocSections(profile),
    tocGroups: prefetch.toc_groups,
    sectionHtml: prefetch.sectionHtml,
    claudeHtml: prefetch.claudeStreamHtml,
    claudeMode: prefetch.claudeStreamMode,
    complete: prefetch.complete,
    orderNo,
  };
}

export function useFortuneResultStream(args: {
  enabled: boolean;
  productSlug: string;
  title: string;
  characterKey: string;
  profile: DemoProfile;
  orderNo: string | null;
  onPatch?: (prefetch: FortunePrefetchV1) => void;
}) {
  const { enabled, productSlug, title, characterKey, profile, orderNo, onPatch } = args;
  const [phase, setPhase] = useState<FortuneResultStreamPhase>("idle");
  const [result, setResult] = useState<FortuneResultState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runKeyRef = useRef("");

  const start = useCallback(() => {
    if (!enabled || !productSlug.trim()) return;
    const runKey = `${productSlug}:${profile}:${orderNo ?? ""}`;
    if (runKeyRef.current === runKey && (phase === "streaming" || phase === "done")) return;
    runKeyRef.current = runKey;
    setError(null);

    const cached = readFortunePrefetch(productSlug);
    const cachedResult = fortuneResultFromPrefetch(cached, profile, orderNo, true);
    if (cachedResult?.complete) {
      setResult(cachedResult);
      setPhase("done");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("streaming");
    setResult(null);

    void runFortunePrefetch({
      productSlug,
      title,
      characterKey,
      profile,
      orderNo,
      signal: ac.signal,
      onPatch: (prefetch) => {
        onPatch?.(prefetch);
        const next = fortuneResultFromPrefetch(prefetch, profile, orderNo, true);
        if (next) {
          setResult(next);
          setPhase(next.complete ? "done" : "streaming");
          if (next.complete) return;
        }
      },
    })
      .then(() => {
        if (ac.signal.aborted) return;
        const finalCached = readFortunePrefetch(productSlug);
        const finalResult = fortuneResultFromPrefetch(finalCached, profile, orderNo);
        if (finalResult) {
          setResult(finalResult);
          setPhase("done");
          return;
        }
        setError("풀이 스트림이 완료되지 않았습니다. 다시 불러와 주세요.");
        setPhase("error");
      })
      .catch((e) => {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : "풀이 스트림 연결에 실패했습니다.");
      setPhase("error");
    });
  }, [characterKey, enabled, onPatch, orderNo, phase, productSlug, profile, title]);

  useEffect(() => {
    if (enabled) start();
    return () => abortRef.current?.abort();
  }, [enabled, start]);

  return { phase, result, error, start };
}
