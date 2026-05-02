import { cache } from "react";

import { approxVisibleCharsFromFortuneHtml } from "@/lib/fortune-saved-html-toc";
import { parseTocSnapshotFromPayload } from "@/lib/library-toc-snapshot";
import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";
import { supabaseServer } from "@/lib/supabase/server";

export type FortuneLibraryPayload = {
  title?: string | null;
  character_key?: string | null;
  profile?: string;
  source?: string;
};

export type FortuneLibraryListRow = {
  request_id: string;
  result_id: string;
  created_at: string;
  completed_at: string | null;
  product_slug: string | null;
  payload: FortuneLibraryPayload;
  summary: string | null;
  /** 저장 HTML 기준 가시 문자 수(목록 요약용) */
  visible_char_count: number;
};

const CHAR_KO: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

export function fortuneLibraryCharLabel(characterKey: string | null | undefined): string {
  if (!characterKey) return "연운";
  return CHAR_KO[characterKey] ?? characterKey;
}

export function stripScriptsFromStoredFortuneHtml(html: string): string {
  return String(html || "").replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function parsePayload(raw: unknown): FortuneLibraryPayload {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    title: typeof o.title === "string" ? o.title : null,
    character_key: typeof o.character_key === "string" ? o.character_key : null,
    profile: o.profile === "pair" ? "pair" : "single",
    source: typeof o.source === "string" ? o.source : undefined,
  };
}

type RequestRowWithResults = {
  id: string;
  created_at: string;
  product_slug: string | null;
  payload: unknown;
  fortune_results:
    | {
        id: string;
        summary: string | null;
        voice_consult_summary?: string | null;
        completed_at: string | null;
        html?: string | null;
      }[]
    | {
        id: string;
        summary: string | null;
        voice_consult_summary?: string | null;
        completed_at: string | null;
        html?: string | null;
      }
    | null;
};

function firstResult(row: RequestRowWithResults) {
  const fr = row.fortune_results;
  if (Array.isArray(fr)) return fr[0] ?? null;
  return fr ?? null;
}

export const listFortuneLibraryItems = cache(async (): Promise<FortuneLibraryListRow[]> => {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("fortune_requests")
    .select("id, created_at, product_slug, payload, fortune_results ( id, summary, completed_at, html )")
    .eq("status", "completed")
    .contains("payload", { source: "fortune_stream_modal" })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  const rows: FortuneLibraryListRow[] = [];
  for (const raw of data ?? []) {
    const row = raw as RequestRowWithResults;
    const fr = firstResult(row);
    if (!fr?.id) continue;
    const htmlRaw = String((fr as { html?: string | null }).html ?? "");
    const visible_char_count = approxVisibleCharsFromFortuneHtml(stripScriptsFromStoredFortuneHtml(htmlRaw));
    rows.push({
      request_id: row.id,
      result_id: fr.id,
      created_at: row.created_at,
      completed_at: fr.completed_at ?? null,
      product_slug: row.product_slug,
      payload: parsePayload(row.payload),
      summary: fr.summary ?? null,
      visible_char_count,
    });
  }
  return rows;
});

export type FortuneLibraryDetail = {
  request_id: string;
  result_id: string;
  created_at: string;
  completed_at: string | null;
  product_slug: string | null;
  payload: FortuneLibraryPayload;
  summary: string | null;
  /** 음성 상담 시스템 프롬프트용 점사 요약(DB 저장, 본문과 별도) */
  voice_consult_summary: string | null;
  html: string;
  /** 보관함 저장 시점 목차(평면) — 점사 SSE `sections`와 동일 */
  toc_sections: FortuneTocItem[] | null;
  /** 대메뉴·소메뉴 그룹 — 있으면 목차 UI가 그룹형(번호 원 없음) */
  toc_groups: FortuneTocMainGroup[] | null;
};

export const getFortuneLibraryDetail = cache(async (requestId: string): Promise<FortuneLibraryDetail | null> => {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("fortune_requests")
    .select("id, created_at, product_slug, payload, fortune_results ( id, summary, voice_consult_summary, completed_at, html )")
    .eq("id", requestId)
    .eq("status", "completed")
    .maybeSingle();

  if (error || !data) return null;

  const row = data as RequestRowWithResults & { fortune_results: unknown };
  const payload = parsePayload(row.payload);
  if (payload.source !== "fortune_stream_modal") return null;

  const frRaw = row.fortune_results;
  const fr = Array.isArray(frRaw) ? frRaw[0] : frRaw;
  if (!fr || typeof fr !== "object") return null;
  const html = String((fr as { html?: string }).html ?? "").trim();
  if (!html) return null;

  const tocSnap = parseTocSnapshotFromPayload(row.payload);

  return {
    request_id: row.id,
    result_id: String((fr as { id: string }).id),
    created_at: row.created_at,
    completed_at: (fr as { completed_at?: string | null }).completed_at ?? null,
    product_slug: row.product_slug,
    payload,
    summary: (fr as { summary?: string | null }).summary ?? null,
    voice_consult_summary: (fr as { voice_consult_summary?: string | null }).voice_consult_summary ?? null,
    html: stripScriptsFromStoredFortuneHtml(html),
    toc_sections: tocSnap.toc_sections,
    toc_groups: tocSnap.toc_groups,
  };
});

export function isUuidRequestId(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || "").trim());
}

export type { LibraryCharacterFilterKey } from "./library-character-filters";
export { LIBRARY_CHARACTER_FILTER_ORDER, normalizeLibraryCharacterKey } from "./library-character-filters";
