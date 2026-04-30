/** 점사 결과 모달과 `/api/fortune/stream`(Cloudways 프록시) 간 SSE 계약 */

export type FortuneTocItem = { id: string; title: string };

export type FortuneStreamEvt =
  | { type: "meta"; product_slug: string; profile: string; manse_context_included?: boolean; manse_context_chars?: number }
  | { type: "toc"; sections: FortuneTocItem[] }
  | { type: "section_start"; index: number }
  | { type: "chunk"; index: number; html: string }
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
        return {
          id: String(x.id ?? `s${i + 1}`),
          title: String(x.title ?? ""),
        };
      }
      return { id: `s${i + 1}`, title: String(s) };
    });
    return [{ type: "toc", sections: mapped }];
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
