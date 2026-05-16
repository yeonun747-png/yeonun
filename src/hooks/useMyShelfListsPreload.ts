import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { LibraryListItemVm } from "@/lib/library-list-vm";
import {
  clearMyShelfListsCache,
  readFortuneListCache,
  readVoiceListCache,
  writeFortuneListCache,
  writeVoiceListCache,
  type VoiceHistoryGroupedBlock,
} from "@/lib/my-shelf-lists-cache";
import { registerMyShelfListsWarm } from "@/lib/my-shelf-lists-preload-bus";

export type { VoiceHistoryGroupedBlock };

export type MyFortuneListSnapshot = {
  items: LibraryListItemVm[];
  loadError: string | null;
  settled: boolean;
};

export type MyVoiceListSnapshot = {
  grouped: VoiceHistoryGroupedBlock[];
  loadError: string | null;
  settled: boolean;
};

type SliceStatus = "idle" | "loading" | "ready" | "error";

type FortuneSlice = {
  items: LibraryListItemVm[];
  loadError: string | null;
  status: SliceStatus;
};

type VoiceSlice = {
  grouped: VoiceHistoryGroupedBlock[];
  loadError: string | null;
  status: SliceStatus;
};

const emptyFortune: FortuneSlice = { items: [], loadError: null, status: "idle" };
const emptyVoice: VoiceSlice = { grouped: [], loadError: null, status: "idle" };

function fortuneSliceFromCache(): FortuneSlice {
  const items = readFortuneListCache();
  if (!items) return emptyFortune;
  return { items, loadError: null, status: "ready" };
}

function voiceSliceFromCache(): VoiceSlice {
  const grouped = readVoiceListCache();
  if (!grouped) return emptyVoice;
  return { grouped, loadError: null, status: "ready" };
}

function snapshotFortune(s: FortuneSlice): MyFortuneListSnapshot {
  return {
    items: s.items,
    loadError: s.loadError,
    settled: s.status === "ready" || s.status === "error",
  };
}

function snapshotVoice(s: VoiceSlice): MyVoiceListSnapshot {
  return {
    grouped: s.grouped,
    loadError: s.loadError,
    settled: s.status === "ready" || s.status === "error",
  };
}

export function useMyShelfListsPreload(member: boolean) {
  const [fortune, setFortune] = useState<FortuneSlice>(fortuneSliceFromCache);
  const [voice, setVoice] = useState<VoiceSlice>(voiceSliceFromCache);
  const acRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);
  const fortuneRef = useRef(fortune);
  fortuneRef.current = fortune;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const load = useCallback(() => {
    if (!member) return;
    const f = fortuneRef.current;
    const v = voiceRef.current;
    if (f.status === "loading" || v.status === "loading") return;

    const needFortune = f.status !== "ready";
    const needVoice = v.status !== "ready";
    if (!needFortune && !needVoice) return;

    const gen = ++genRef.current;
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;

    /** 캐시로 이미 ready이면 스켈레톤 없이 유지 */
    if (needFortune) setFortune((cur) => ({ ...cur, status: "loading", loadError: null }));
    if (needVoice) setVoice((cur) => ({ ...cur, status: "loading", loadError: null }));

    if (needFortune) void (async () => {
      try {
        const r = await fetch("/api/my/fortune-library-list", { method: "GET", cache: "no-store", signal: ac.signal });
        const j = (await r.json()) as
          | { ok: true; items: LibraryListItemVm[] }
          | { ok: false; error?: string };
        if (gen !== genRef.current || ac.signal.aborted) return;
        if (!j.ok) {
          setFortune({
            items: [],
            loadError: typeof j.error === "string" ? j.error : "목록을 불러오지 못했습니다.",
            status: "error",
          });
          return;
        }
        const items = Array.isArray(j.items) ? j.items : [];
        writeFortuneListCache(items);
        setFortune({
          items,
          loadError: null,
          status: "ready",
        });
      } catch (e) {
        if (gen !== genRef.current || ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setFortune({
          items: [],
          loadError: "목록을 불러오지 못했습니다.",
          status: "error",
        });
      }
    })();

    if (needVoice) void (async () => {
      try {
        const r = await fetch("/api/my/voice-call-history", { method: "GET", cache: "no-store", signal: ac.signal });
        const j = (await r.json()) as
          | { ok: true; grouped: VoiceHistoryGroupedBlock[] }
          | { ok: false; error?: string };
        if (gen !== genRef.current || ac.signal.aborted) return;
        if (!j.ok) {
          setVoice({
            grouped: [],
            loadError: typeof j.error === "string" ? j.error : "목록을 불러오지 못했습니다.",
            status: "error",
          });
          return;
        }
        const grouped = Array.isArray(j.grouped) ? j.grouped : [];
        writeVoiceListCache(grouped);
        setVoice({
          grouped,
          loadError: null,
          status: "ready",
        });
      } catch (e) {
        if (gen !== genRef.current || ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
        setVoice({
          grouped: [],
          loadError: "목록을 불러오지 못했습니다.",
          status: "error",
        });
      }
    })();
  }, [member]);

  useLayoutEffect(() => {
    if (!member) {
      registerMyShelfListsWarm(null);
      genRef.current += 1;
      acRef.current?.abort();
      acRef.current = null;
      clearMyShelfListsCache();
      setFortune(emptyFortune);
      setVoice(emptyVoice);
      return;
    }
    const cachedFortune = fortuneSliceFromCache();
    const cachedVoice = voiceSliceFromCache();
    if (cachedFortune.status === "ready") setFortune(cachedFortune);
    if (cachedVoice.status === "ready") setVoice(cachedVoice);
    registerMyShelfListsWarm(load);
    load();
    return () => {
      registerMyShelfListsWarm(null);
    };
  }, [member, load]);

  return useMemo(
    () => ({
      fortuneSnapshot: snapshotFortune(fortune),
      voiceSnapshot: snapshotVoice(voice),
    }),
    [fortune, voice],
  );
}
