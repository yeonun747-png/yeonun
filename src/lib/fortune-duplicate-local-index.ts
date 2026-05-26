"use client";

const LS_KEY = "yeonun_fortune_dup_index_v1";
const HOLD_MS = 60 * 24 * 60 * 60 * 1000;

export type FortuneDuplicateLocalEntry = {
  requestId: string;
  productSlug: string;
  sajuFingerprint: string;
  completedAt: string;
};

type IndexV1 = { v: 1; entries: FortuneDuplicateLocalEntry[] };

function readIndex(): FortuneDuplicateLocalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as IndexV1;
    if (j?.v !== 1 || !Array.isArray(j.entries)) return [];
    return j.entries;
  } catch {
    return [];
  }
}

function writeIndex(entries: FortuneDuplicateLocalEntry[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: IndexV1 = { v: 1, entries: entries.slice(0, 200) };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota
  }
}

function isValidEntry(entry: FortuneDuplicateLocalEntry): boolean {
  const t = Date.parse(entry.completedAt);
  if (!Number.isFinite(t)) return false;
  return t + HOLD_MS > Date.now();
}

export function appendFortuneDuplicateLocalEntry(entry: FortuneDuplicateLocalEntry): void {
  const next = readIndex().filter((e) => e.requestId !== entry.requestId);
  next.unshift(entry);
  writeIndex(next.filter(isValidEntry));
}

export function findFortuneDuplicateLocalEntry(
  productSlug: string,
  sajuFingerprint: string,
): FortuneDuplicateLocalEntry | null {
  const slug = productSlug.trim();
  const fp = sajuFingerprint.trim();
  if (!slug || !fp) return null;

  let best: FortuneDuplicateLocalEntry | null = null;
  let bestTime = 0;
  for (const entry of readIndex()) {
    if (!isValidEntry(entry)) continue;
    if (entry.productSlug !== slug || entry.sajuFingerprint !== fp) continue;
    const t = Date.parse(entry.completedAt);
    if (t > bestTime) {
      bestTime = t;
      best = entry;
    }
  }
  return best;
}
