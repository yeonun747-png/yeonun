/**
 * 오늘의 기록 — 로컬 카탈로그(향후 Supabase user_id 연동 시 동기화).
 */

import { formatKstDateKey } from "@/lib/datetime/kst";

export type DailyNoteCategory = "dream" | "resolution" | "feeling" | "event" | "other";

export type DailyNoteEntry = {
  id: string;
  kst_date: string;
  body: string;
  category: DailyNoteCategory;
  updated_at: string;
};

const CATALOG_KEY = "yeonun_daily_notes_catalog_v1";
const PENDING_KEY = "yeonun_daily_notes_pending_v1";

function randomId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `dn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function loadAllNotes(): DailyNoteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    const j = JSON.parse(raw) as DailyNoteEntry[];
    return Array.isArray(j) ? j.filter((x) => x && typeof x.kst_date === "string") : [];
  } catch {
    return [];
  }
}

function persistAll(list: DailyNoteEntry[]) {
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getNoteByKstDate(kstDate: string): DailyNoteEntry | null {
  const list = loadAllNotes();
  return list.find((n) => n.kst_date === kstDate) ?? null;
}

export function getTodayNote(now: Date = new Date()): DailyNoteEntry | null {
  return getNoteByKstDate(formatKstDateKey(now));
}

export function upsertDailyNote(
  kstDate: string,
  body: string,
  category: DailyNoteCategory,
): DailyNoteEntry {
  const list = loadAllNotes();
  const trimmed = body.slice(0, 200);
  const nowIso = new Date().toISOString();
  const existing = list.findIndex((n) => n.kst_date === kstDate);
  if (existing >= 0) {
    const row: DailyNoteEntry = {
      ...list[existing],
      body: trimmed,
      category,
      updated_at: nowIso,
    };
    list[existing] = row;
    persistAll(list);
    return row;
  }
  const row: DailyNoteEntry = {
    id: randomId(),
    kst_date: kstDate,
    body: trimmed,
    category,
    updated_at: nowIso,
  };
  list.push(row);
  persistAll(list);
  return row;
}

export function deleteDailyNoteById(id: string): void {
  const list = loadAllNotes().filter((n) => n.id !== id);
  persistAll(list);
}

export function groupNotesByKstMonth(list: DailyNoteEntry[]): { key: string; label: string; items: DailyNoteEntry[] }[] {
  const byMonth = new Map<string, DailyNoteEntry[]>();
  for (const n of list) {
    const k = n.kst_date.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(n);
  }
  const keys = [...byMonth.keys()].sort((a, b) => b.localeCompare(a));
  return keys.map((key) => {
    const items = (byMonth.get(key) ?? []).sort((a, b) => b.kst_date.localeCompare(a.kst_date));
    const [y, m] = key.split("-");
    return { key, label: `${y}년 ${Number(m)}월`, items };
  });
}

export type PendingNotePayload = { kst_date: string; body: string; category: DailyNoteCategory };

export function queuePendingNote(p: PendingNotePayload) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function takePendingNote(): PendingNotePayload | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as PendingNotePayload;
  } catch {
    return null;
  }
}
