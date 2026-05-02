/** 보관함 UI 필터 — 클라이언트에서도 안전하게 import (Supabase/env 무관) */

export const LIBRARY_CHARACTER_FILTER_ORDER = [
  { key: "yeon", label: "연화" },
  { key: "byeol", label: "별하" },
  { key: "yeo", label: "여연" },
  { key: "un", label: "운서" },
] as const;

export type LibraryCharacterFilterKey = (typeof LIBRARY_CHARACTER_FILTER_ORDER)[number]["key"];

export function normalizeLibraryCharacterKey(characterKey: string | null | undefined): LibraryCharacterFilterKey | "" {
  const v = String(characterKey ?? "").trim();
  if (v === "yeon" || v === "byeol" || v === "yeo" || v === "un") return v;
  return "";
}
