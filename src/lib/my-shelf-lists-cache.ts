import type { LibraryListItemVm } from "@/lib/library-list-vm";
import type { VoiceCallHistoryRowVm } from "@/lib/voice-call-history-public";

export type VoiceHistoryGroupedBlock = { monthLabel: string; rows: VoiceCallHistoryRowVm[] };

const FORTUNE_KEY = "yeonun:my-shelf-fortune-list.v1";
const VOICE_KEY = "yeonun:my-shelf-voice-list.v1";

type FortuneCacheV1 = { v: 1; items: LibraryListItemVm[]; updatedAt: number };
type VoiceCacheV1 = { v: 1; grouped: VoiceHistoryGroupedBlock[]; updatedAt: number };

let memFortune: FortuneCacheV1 | null = null;
let memVoice: VoiceCacheV1 | null = null;

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota
  }
}

export function readFortuneListCache(): LibraryListItemVm[] | null {
  if (memFortune?.items) return memFortune.items;
  const j = readJson<FortuneCacheV1>(FORTUNE_KEY);
  if (j?.v !== 1 || !Array.isArray(j.items)) return null;
  memFortune = j;
  return j.items;
}

export function writeFortuneListCache(items: LibraryListItemVm[]) {
  const payload: FortuneCacheV1 = { v: 1, items, updatedAt: Date.now() };
  memFortune = payload;
  writeJson(FORTUNE_KEY, payload);
}

export function readVoiceListCache(): VoiceHistoryGroupedBlock[] | null {
  if (memVoice?.grouped) return memVoice.grouped;
  const j = readJson<VoiceCacheV1>(VOICE_KEY);
  if (j?.v !== 1 || !Array.isArray(j.grouped)) return null;
  memVoice = j;
  return j.grouped;
}

export function writeVoiceListCache(grouped: VoiceHistoryGroupedBlock[]) {
  const payload: VoiceCacheV1 = { v: 1, grouped, updatedAt: Date.now() };
  memVoice = payload;
  writeJson(VOICE_KEY, payload);
}

export function clearMyShelfListsCache() {
  memFortune = null;
  memVoice = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FORTUNE_KEY);
    sessionStorage.removeItem(VOICE_KEY);
  } catch {
    // ignore
  }
}

/** 스냅샷이 아직 loading이어도 로컬 캐시가 있으면 즉시 settled로 복원 */
export function fortuneSnapshotWithCache<T extends { items: LibraryListItemVm[]; loadError: string | null; settled: boolean }>(
  snapshot: T,
): T {
  if (snapshot.settled) return snapshot;
  const items = readFortuneListCache();
  if (!items) return snapshot;
  return { ...snapshot, items, loadError: null, settled: true };
}

export function voiceSnapshotWithCache<T extends { grouped: VoiceHistoryGroupedBlock[]; loadError: string | null; settled: boolean }>(
  snapshot: T,
): T {
  if (snapshot.settled) return snapshot;
  const grouped = readVoiceListCache();
  if (!grouped) return snapshot;
  return { ...snapshot, grouped, loadError: null, settled: true };
}
