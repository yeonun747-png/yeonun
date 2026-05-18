"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FortuneResultState } from "@/components/fortune/fortuneFlowTypes";
import { fortunePrefetchStorageKey, readFortunePrefetch, type FortunePrefetchV1 } from "@/lib/fortune-prefetch-storage";
import {
  abortFortunePrefetch,
  isFortunePrefetchActive,
  runFortunePrefetchDetached,
  subscribeFortunePrefetch,
} from "@/lib/fortune-prefetch-runner";
import { demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

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
  const runKeyRef = useRef("");
  const phaseRef = useRef<FortuneResultStreamPhase>("idle");
  const onPatchRef = useRef(onPatch);

  onPatchRef.current = onPatch;

  const setPhaseTracked = useCallback((next: FortuneResultStreamPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const applyPrefetch = useCallback(
    (prefetch: FortunePrefetchV1) => {
      onPatchRef.current?.(prefetch);
      const next = fortuneResultFromPrefetch(prefetch, profile, orderNo, true);
      if (next) {
        setResult(next);
        setPhaseTracked(next.complete ? "done" : "streaming");
      } else if (!prefetch.complete) {
        setPhaseTracked("streaming");
      }
    },
    [orderNo, profile, setPhaseTracked],
  );

  const startFresh = useCallback(() => {
    if (!productSlug.trim()) return;
    setError(null);
    try {
      sessionStorage.removeItem(fortunePrefetchStorageKey(productSlug));
    } catch {
      /* ignore */
    }
    abortFortunePrefetch(productSlug);
    const runKey = `${productSlug}:${profile}:${orderNo ?? ""}`;
    runKeyRef.current = runKey;
    setResult(null);
    setPhaseTracked("streaming");

    void runFortunePrefetchDetached({
      productSlug,
      title,
      characterKey,
      profile,
      orderNo,
      onPatch: applyPrefetch,
    })
      .then(() => {
        if (phaseRef.current === "error") return;
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
        if (phaseRef.current === "error") return;
        setError(e instanceof Error ? e.message : "풀이 스트림 연결에 실패했습니다.");
        setPhaseTracked("error");
      });
  }, [applyPrefetch, characterKey, orderNo, productSlug, profile, setPhaseTracked, title]);

  useEffect(() => {
    if (!enabled || !productSlug.trim()) {
      phaseRef.current = "idle";
      return;
    }

    const runKey = `${productSlug}:${profile}:${orderNo ?? ""}`;
    const cached = readFortunePrefetch(productSlug);
    const cachedResult = fortuneResultFromPrefetch(cached, profile, orderNo, true);

    if (cachedResult?.complete) {
      runKeyRef.current = runKey;
      setResult(cachedResult);
      setPhaseTracked("done");
      return;
    }

    /** STEP6 백그라운드 스트림이 살아 있으면 재요청 없이 이어받기 */
    if (isFortunePrefetchActive(productSlug)) {
      runKeyRef.current = runKey;
      setError(null);
      if (cachedResult) setResult(cachedResult);
      else setResult(null);
      setPhaseTracked(cachedResult ? "streaming" : "streaming");

      const unsub = subscribeFortunePrefetch(productSlug, applyPrefetch);
      return unsub;
    }

    if (runKeyRef.current === runKey && (phaseRef.current === "streaming" || phaseRef.current === "done")) {
      return;
    }

    runKeyRef.current = runKey;
    setError(null);
    if (cachedResult) {
      setResult(cachedResult);
      setPhaseTracked("streaming");
    } else {
      setResult(null);
      setPhaseTracked("streaming");
    }

    void runFortunePrefetchDetached({
      productSlug,
      title,
      characterKey,
      profile,
      orderNo,
      onPatch: applyPrefetch,
    })
      .then(() => {
        if (phaseRef.current === "error") return;
        const finalCached = readFortunePrefetch(productSlug);
        const finalResult = fortuneResultFromPrefetch(finalCached, profile, orderNo);
        if (finalResult) {
          setResult(finalResult);
          setPhaseTracked("done");
          return;
        }
        if (cached && !cached.complete) {
          setError("풀이 스트림이 완료되지 않았습니다. 다시 불러와 주세요.");
          setPhaseTracked("error");
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "풀이 스트림 연결에 실패했습니다.");
        setPhaseTracked("error");
      });
  }, [applyPrefetch, characterKey, enabled, orderNo, productSlug, profile, setPhaseTracked, title]);

  const retry = useCallback(() => {
    runKeyRef.current = "";
    phaseRef.current = "idle";
    startFresh();
  }, [startFresh]);

  return { phase, result, error, start: retry };
}
