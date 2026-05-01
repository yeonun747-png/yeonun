/** 점사 결과 모달과 `/api/fortune/stream`(Cloudways 프록시) 간 SSE 계약 */

import type { FortuneTocMainGroup } from "@/lib/product-fortune-menu";

export type FortuneTocItem = {
  id: string;
  /** 소메뉴명 (목차·본문 소제목) */
  title: string;
  /** 대메뉴명 — 본문에서 소제목 위에 표시 */
  main_title?: string;
  /** 대메뉴 썸네일 — 첫 소제목 블록에서 대제목 아래 */
  main_image_url?: string;
  main_video_thumb_url?: string;
  /** 소메뉴 썸네일 — 소제목(h3) 아래 */
  image_url?: string;
  video_thumb_url?: string;
};

export type FortuneStreamEvt =
  | { type: "meta"; product_slug: string; profile: string; manse_context_included?: boolean; manse_context_chars?: number }
  | { type: "toc"; sections: FortuneTocItem[]; toc_groups?: FortuneTocMainGroup[] }
  | { type: "section_start"; index: number }
  | { type: "chunk"; index: number; html: string }
  /** 스트리밍 델타 누적 후 `stripCodeFences` 등으로 확정된 본문으로 교체 */
  | { type: "section_replace"; index: number; html: string }
  | { type: "section_end"; index: number }
  | { type: "done"; charCount: number }
  | { type: "error"; message?: string };

/**
 * Cloudways/프록시가 보내는 한 건의 JSON을 모달용 이벤트로 정규화한다.
 * 데모 라우트(`two-stage-demo`)와 동일한 형식이면 그대로 통과한다.
 */
export function normalizeFortuneSsePayload(raw: unknown): FortuneStreamEvt[] {
  if (raw == null || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const type = o.type;

  if (type === "toc") {
    const sections = o.sections;
    if (!Array.isArray(sections)) return [];
    const mapped: FortuneTocItem[] = sections.map((s: unknown, i: number) => {
      if (s && typeof s === "object" && "title" in (s as object)) {
        const x = s as Record<string, unknown>;
        const img = typeof x.image_url === "string" ? x.image_url.trim() : "";
        const vid = typeof x.video_thumb_url === "string" ? x.video_thumb_url.trim() : "";
        const mt = typeof x.main_title === "string" ? x.main_title.trim() : "";
        const mimg = typeof x.main_image_url === "string" ? x.main_image_url.trim() : "";
        const mvid = typeof x.main_video_thumb_url === "string" ? x.main_video_thumb_url.trim() : "";
        return {
          id: String(x.id ?? `s${i + 1}`),
          title: String(x.title ?? ""),
          ...(mt ? { main_title: mt } : {}),
          ...(mimg ? { main_image_url: mimg } : {}),
          ...(mvid ? { main_video_thumb_url: mvid } : {}),
          ...(img ? { image_url: img } : {}),
          ...(vid ? { video_thumb_url: vid } : {}),
        };
      }
      return { id: `s${i + 1}`, title: String(s) };
    });
    const rawGroups = o.toc_groups;
    let toc_groups: FortuneTocMainGroup[] | undefined;
    if (Array.isArray(rawGroups)) {
      toc_groups = [];
      for (const g of rawGroups) {
        if (!g || typeof g !== "object") continue;
        const gr = g as Record<string, unknown>;
        const subsRaw = gr.subs;
        if (!Array.isArray(subsRaw)) continue;
        const subs: FortuneTocMainGroup["subs"] = [];
        for (const su of subsRaw) {
          if (!su || typeof su !== "object") continue;
          const u = su as Record<string, unknown>;
          const sectionIndex = Number(u.sectionIndex ?? u.section_index ?? 0);
          const img = typeof u.image_url === "string" ? u.image_url.trim() : "";
          const vid = typeof u.video_thumb_url === "string" ? u.video_thumb_url.trim() : "";
          subs.push({
            id: String(u.id ?? ""),
            title: String(u.title ?? ""),
            sectionIndex: Number.isFinite(sectionIndex) ? sectionIndex : 0,
            ...(img ? { image_url: img } : {}),
            ...(vid ? { video_thumb_url: vid } : {}),
          });
        }
        const gImg = typeof gr.image_url === "string" ? gr.image_url.trim() : "";
        const gVid = typeof gr.video_thumb_url === "string" ? gr.video_thumb_url.trim() : "";
        toc_groups.push({
          main_id: String(gr.main_id ?? gr.mainId ?? ""),
          main_title: String(gr.main_title ?? gr.mainTitle ?? ""),
          ...(gImg ? { image_url: gImg } : {}),
          ...(gVid ? { video_thumb_url: gVid } : {}),
          subs,
        });
      }
      if (toc_groups.length === 0) toc_groups = undefined;
    }
    return [{ type: "toc", sections: mapped, ...(toc_groups ? { toc_groups } : {}) }];
  }

  if (type === "section_start") {
    const index = Number(o.index ?? o.section_index ?? 0);
    return [{ type: "section_start", index }];
  }

  if (type === "section_end") {
    const index = Number(o.index ?? o.section_index ?? 0);
    return [{ type: "section_end", index }];
  }

  if (type === "chunk") {
    const index = Number(o.index ?? o.section_index ?? 0);
    const html = String(o.html ?? o.delta ?? o.text ?? "");
    if (!html) return [];
    return [{ type: "chunk", index, html }];
  }

  if (type === "section_replace") {
    const index = Number(o.index ?? o.section_index ?? 0);
    const html = String(o.html ?? "");
    return [{ type: "section_replace", index, html }];
  }

  if (type === "done") {
    const charCount = Number(o.charCount ?? o.char_count ?? o.total_chars ?? 0);
    return [{ type: "done", charCount: Number.isFinite(charCount) ? charCount : 0 }];
  }

  if (type === "meta") {
    return [
      {
        type: "meta",
        product_slug: String(o.product_slug ?? ""),
        profile: String(o.profile ?? "single"),
        ...(typeof o.manse_context_included === "boolean" ? { manse_context_included: o.manse_context_included } : {}),
        ...(typeof o.manse_context_chars === "number" ? { manse_context_chars: o.manse_context_chars } : {}),
      },
    ];
  }

  if (type === "error") {
    return [{ type: "error", message: typeof o.message === "string" ? o.message : undefined }];
  }

  return [];
}

/** SSE 블록(\n\n 구분)에서 `data:` 줄 파싱 — 한 블록에 data 줄이 여러 개일 수 있음 */
export function parseFortuneSseBlock(block: string): unknown[] {
  const out: unknown[] = [];
  for (const line of block.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const json = t.slice(5).trim();
    if (!json || json === "[DONE]") continue;
    try {
      out.push(JSON.parse(json));
    } catch {
      /* ignore malformed chunk */
    }
  }
  return out;
}
