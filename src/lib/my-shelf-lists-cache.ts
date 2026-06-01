import type { LibraryListItemVm } from "@/lib/library-list-vm";
import type { VoiceCallHistoryRowVm } from "@/lib/voice-call-history-public";

export type VoiceHistoryGroupedBlock = { monthLabel: string; rows: VoiceCallHistoryRowVm[] };

const FORTUNE_KEY_PREFIX = "yeonun:my-shelf-fortune-list.v1";
const VOICE_KEY_PREFIX = "yeonun:my-shelf-voice-list.v1";

function fortuneKey(userId: string) {
  return `${FORTUNE_KEY_PREFIX}:${userId}`;
}

function voiceKey(userId: string) {
  return `${VOICE_KEY_PREFIX}:${userId}`;
}

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

export function readFortuneListCache(userId: string): LibraryListItemVm[] | null {
  if (memFortune?.items) return memFortune.items;
  const j = readJson<FortuneCacheV1>(fortuneKey(userId));
  if (j?.v !== 1 || !Array.isArray(j.items)) return null;
  memFortune = j;
  return j.items;
}

export function writeFortuneListCache(userId: string, items: LibraryListItemVm[]) {
  const payload: FortuneCacheV1 = { v: 1, items, updatedAt: Date.now() };
  memFortune = payload;
  writeJson(fortuneKey(userId), payload);
}

export function readVoiceListCache(userId: string): VoiceHistoryGroupedBlock[] | null {
  if (memVoice?.grouped) return memVoice.grouped;
  const j = readJson<VoiceCacheV1>(voiceKey(userId));
  if (j?.v !== 1 || !Array.isArray(j.grouped)) return null;
  memVoice = j;
  return j.grouped;
}

export function writeVoiceListCache(userId: string, grouped: VoiceHistoryGroupedBlock[]) {
  const payload: VoiceCacheV1 = { v: 1, grouped, updatedAt: Date.now() };
  memVoice = payload;
  writeJson(voiceKey(userId), payload);
}

/** 종료 후 Haiku 부제목 생성 완료 시 목록 캐시·UI 동기화 */
export function patchVoiceListCacheSubtitle(userId: string, sessionId: string, subtitle: string) {
  const grouped = readVoiceListCache(userId);
  if (!grouped) return;
  const next = grouped.map((block) => ({
    ...block,
    rows: block.rows.map((row) =>
      row.id === sessionId ? { ...row, subtitle: subtitle.trim() || null } : row,
    ),
  }));
  writeVoiceListCache(userId, next);
}

export function invalidateFortuneListCache(userId: string) {
  const uid = String(userId ?? "").trim();
  if (!uid) return;
  memFortune = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(fortuneKey(uid));
    } catch {
      // ignore
    }
  }
}

export function clearMyShelfListsCache() {
  memFortune = null;
  memVoice = null;
  if (typeof window === "undefined") return;
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(FORTUNE_KEY_PREFIX) || k?.startsWith(VOICE_KEY_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
}

/** 스냅샷이 아직 loading이어도 로컬 캐시가 있으면 즉시 settled로 복원 */
export function fortuneSnapshotWithCache<T extends { items: LibraryListItemVm[]; loadError: string | null; settled: boolean }>(
  snapshot: T,
  userId: string,
): T {
  if (snapshot.settled) return snapshot;
  const items = readFortuneListCache(userId);
  if (!items) return snapshot;
  return { ...snapshot, items, loadError: null, settled: true };
}

export function voiceSnapshotWithCache<T extends { grouped: VoiceHistoryGroupedBlock[]; loadError: string | null; settled: boolean }>(
  snapshot: T,
  userId: string,
): T {
  if (snapshot.settled) return snapshot;
  const grouped = readVoiceListCache(userId);
  if (!grouped) return snapshot;
  return { ...snapshot, grouped, loadError: null, settled: true };
}
