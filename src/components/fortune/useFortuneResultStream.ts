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
    doneIdx: [...prefetch.doneIdx],
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
  const phaseRef = useRef<FortuneResultStreamPhase>("idle");
  const onPatchRef = useRef(onPatch);

  onPatchRef.current = onPatch;

  const setPhaseTracked = useCallback((next: FortuneResultStreamPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const start = useCallback(() => {
    if (!enabled || !productSlug.trim()) return;
    const runKey = `${productSlug}:${profile}:${orderNo ?? ""}`;
    if (runKeyRef.current === runKey && (phaseRef.current === "streaming" || phaseRef.current === "done")) {
      return;
    }
    runKeyRef.current = runKey;
    setError(null);

    const cached = readFortunePrefetch(productSlug);
    const cachedResult = fortuneResultFromPrefetch(cached, profile, orderNo, true);
    if (cachedResult?.complete) {
      setResult(cachedResult);
      setPhaseTracked("done");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhaseTracked("streaming");
    if (cachedResult) setResult(cachedResult);
    else setResult(null);

    void runFortunePrefetch({
      productSlug,
      title,
      characterKey,
      profile,
      orderNo,
      signal: ac.signal,
      onPatch: (prefetch) => {
        onPatchRef.current?.(prefetch);
        const next = fortuneResultFromPrefetch(prefetch, profile, orderNo, true);
        if (next) {
          setResult(next);
          setPhaseTracked(next.complete ? "done" : "streaming");
        }
      },
    })
      .then(() => {
        if (ac.signal.aborted) return;
        const finalCached = readFortunePrefetch(productSlug);
        const finalResult = fortuneResultFromPrefetch(finalCached, profile, orderNo);
        if (finalResult) {
          setResult(finalResult);
          setPhaseTracked("done");
          return;
        }
        setError("풀이 스트림이 완료되지 않았습니다. 다시 불러와 주세요.");
        setPhaseTracked("error");
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "풀이 스트림 연결에 실패했습니다.");
        setPhaseTracked("error");
      });
  }, [characterKey, enabled, orderNo, productSlug, profile, setPhaseTracked, title]);

  useEffect(() => {
    if (!enabled) {
      phaseRef.current = "idle";
      return;
    }
    start();
    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, start]);

  const retry = useCallback(() => {
    runKeyRef.current = "";
    phaseRef.current = "idle";
    start();
  }, [start]);

  return { phase, result, error, start: retry };
}
