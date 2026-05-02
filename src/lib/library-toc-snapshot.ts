import type { FortuneTocItem } from "@/lib/fortune-stream-client";
import type { FortuneTocMainGroup, FortuneTocSubRef } from "@/lib/product-fortune-menu";

/** 그룹형 목차를 평면 `FortuneTocItem[]`로 — 저장 스냅샷에 toc_sections 없을 때 보정용 */
export function flattenTocGroupsToFlatItems(groups: FortuneTocMainGroup[]): FortuneTocItem[] {
  const pairs: { idx: number; item: FortuneTocItem }[] = [];
  for (const g of groups) {
    const mt = g.main_title.trim();
    for (const sub of g.subs) {
      pairs.push({
        idx: sub.sectionIndex,
        item: {
          id: sub.id,
          title: sub.title,
          ...(mt ? { main_title: mt } : {}),
          ...(sub.image_url ? { image_url: sub.image_url } : {}),
          ...(sub.video_thumb_url ? { video_thumb_url: sub.video_thumb_url } : {}),
        },
      });
    }
  }
  pairs.sort((a, b) => a.idx - b.idx);
  return pairs.map((p) => p.item);
}

function parseTocSections(raw: unknown): FortuneTocItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FortuneTocItem[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    if (!title) continue;
    const id = String(o.id ?? `s${out.length + 1}`);
    const mt = typeof o.main_title === "string" ? o.main_title.trim() : "";
    const item: FortuneTocItem = { id, title };
    if (mt) item.main_title = mt;
    const mi = typeof o.main_image_url === "string" ? o.main_image_url.trim() : "";
    const mv = typeof o.main_video_thumb_url === "string" ? o.main_video_thumb_url.trim() : "";
    const iu = typeof o.image_url === "string" ? o.image_url.trim() : "";
    const vu = typeof o.video_thumb_url === "string" ? o.video_thumb_url.trim() : "";
    if (mi) item.main_image_url = mi;
    if (mv) item.main_video_thumb_url = mv;
    if (iu) item.image_url = iu;
    if (vu) item.video_thumb_url = vu;
    out.push(item);
  }
  return out.length ? out : null;
}

function parseSubRef(raw: unknown): FortuneTocSubRef | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  const title = String(u.title ?? "").trim();
  if (!title) return null;
  const id = String(u.id ?? "");
  const sectionIndex = Number(u.sectionIndex ?? u.section_index ?? 0);
  const si = Number.isFinite(sectionIndex) ? sectionIndex : 0;
  const out: FortuneTocSubRef = { id, title, sectionIndex: si };
  const iu = typeof u.image_url === "string" ? u.image_url.trim() : "";
  const vu = typeof u.video_thumb_url === "string" ? u.video_thumb_url.trim() : "";
  if (iu) out.image_url = iu;
  if (vu) out.video_thumb_url = vu;
  return out;
}

function parseTocGroups(raw: unknown): FortuneTocMainGroup[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: FortuneTocMainGroup[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const o = g as Record<string, unknown>;
    const subsRaw = o.subs;
    if (!Array.isArray(subsRaw)) continue;
    const subs: FortuneTocSubRef[] = [];
    for (const su of subsRaw) {
      const s = parseSubRef(su);
      if (s) subs.push(s);
    }
    if (!subs.length) continue;
    const main_title = String(o.main_title ?? "").trim() || "메뉴";
    const main_id = String(o.main_id ?? `m${out.length}`);
    const giu = typeof o.image_url === "string" ? o.image_url.trim() : "";
    const gvu = typeof o.video_thumb_url === "string" ? o.video_thumb_url.trim() : "";
    const grp: FortuneTocMainGroup = { main_id, main_title, subs };
    if (giu) grp.image_url = giu;
    if (gvu) grp.video_thumb_url = gvu;
    out.push(grp);
  }
  return out.length ? out : null;
}

/** `fortune_requests.payload`에 저장된 목차 스냅샷 — 점사 모달 TOC 이벤트와 동일 구조 */
export function parseTocSnapshotFromPayload(payload: unknown): {
  toc_sections: FortuneTocItem[] | null;
  toc_groups: FortuneTocMainGroup[] | null;
} {
  if (!payload || typeof payload !== "object") {
    return { toc_sections: null, toc_groups: null };
  }
  const o = payload as Record<string, unknown>;
  return {
    toc_sections: parseTocSections(o.toc_sections),
    toc_groups: parseTocGroups(o.toc_groups),
  };
}
