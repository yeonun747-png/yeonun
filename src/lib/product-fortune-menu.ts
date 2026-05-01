/** 어드민 `products.fortune_menu` JSON — 점사 TOC·소메뉴별 Claude 호출에 사용 */

export type FortuneSubMenuRow = {
  id: string;
  title: string;
  interpretation_prompt: string;
  image_url: string;
  video_thumb_url: string;
};

export type FortuneMainMenuRow = {
  id: string;
  title: string;
  image_url: string;
  video_thumb_url: string;
  sub_menus: FortuneSubMenuRow[];
};

export type FortuneMenuPayload = {
  main_menus: FortuneMainMenuRow[];
};

export function emptyFortuneMenu(): FortuneMenuPayload {
  return { main_menus: [] };
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newMainMenuRow(): FortuneMainMenuRow {
  return {
    id: newId("m"),
    title: "",
    image_url: "",
    video_thumb_url: "",
    sub_menus: [],
  };
}

export function newSubMenuRow(): FortuneSubMenuRow {
  return {
    id: newId("s"),
    title: "",
    interpretation_prompt: "",
    image_url: "",
    video_thumb_url: "",
  };
}

function asStr(v: unknown, fallback = ""): string {
  if (v == null || v === "") return fallback;
  return String(v).trim();
}

function parseSub(raw: unknown, idx: number): FortuneSubMenuRow {
  if (!raw || typeof raw !== "object") {
    return { ...newSubMenuRow(), id: newId("s"), title: `소메뉴 ${idx + 1}` };
  }
  const o = raw as Record<string, unknown>;
  const id = asStr(o.id);
  return {
    id: id || newId("s"),
    title: asStr(o.title),
    interpretation_prompt: asStr(o.interpretation_prompt),
    image_url: asStr(o.image_url),
    video_thumb_url: asStr(o.video_thumb_url),
  };
}

function parseMain(raw: unknown, idx: number): FortuneMainMenuRow {
  if (!raw || typeof raw !== "object") {
    return { ...newMainMenuRow(), id: newId("m"), title: `대메뉴 ${idx + 1}` };
  }
  const o = raw as Record<string, unknown>;
  const subsRaw = o.sub_menus;
  const subs = Array.isArray(subsRaw) ? subsRaw.map((s, i) => parseSub(s, i)) : [];
  const id = asStr(o.id);
  return {
    id: id || newId("m"),
    title: asStr(o.title),
    image_url: asStr(o.image_url),
    video_thumb_url: asStr(o.video_thumb_url),
    sub_menus: subs,
  };
}

/** DB jsonb / API 응답을 정규화 */
export function parseFortuneMenuJson(raw: unknown): FortuneMenuPayload {
  if (raw == null) return emptyFortuneMenu();
  if (Array.isArray(raw)) {
    return { main_menus: raw.map((m, i) => parseMain(m, i)) };
  }
  if (typeof raw !== "object") return emptyFortuneMenu();
  const o = raw as Record<string, unknown>;
  const mains = o.main_menus;
  if (!Array.isArray(mains)) return emptyFortuneMenu();
  return { main_menus: mains.map((m, i) => parseMain(m, i)) };
}

export type FlatFortuneSection = {
  id: string;
  /** 목차에 표시 (대 · 소) */
  toc_title: string;
  /** 본문 상단에 표시할 대메뉴명 */
  main_title: string;
  /** 대메뉴에만 등록된 썸네일 URL(첫 소제목 구간에서 대제목 아래) */
  main_image_url: string;
  main_video_thumb_url: string;
  /** HTML h3에 넣을 소메뉴명 */
  subtitle_title: string;
  interpretation_prompt: string;
  image_url: string;
  video_thumb_url: string;
};

/** 소메뉴가 1개 이상(제목 비어 있지 않은 것)일 때만 점사 스트림 분기 */
export function flattenFortuneMenuForStream(menu: FortuneMenuPayload): FlatFortuneSection[] {
  const out: FlatFortuneSection[] = [];
  for (const m of menu.main_menus) {
    const mainTitle = m.title.trim() || "메뉴";
    for (const s of m.sub_menus ?? []) {
      const st = s.title.trim();
      if (!st) continue;
      const tocTitle = `${mainTitle} · ${st}`;
      out.push({
        id: s.id || `sec_${out.length}`,
        toc_title: tocTitle,
        main_title: mainTitle,
        main_image_url: String(m.image_url ?? "").trim(),
        main_video_thumb_url: String(m.video_thumb_url ?? "").trim(),
        subtitle_title: st,
        interpretation_prompt: s.interpretation_prompt.trim(),
        image_url: String(s.image_url ?? "").trim(),
        video_thumb_url: String(s.video_thumb_url ?? "").trim(),
      });
    }
  }
  return out;
}

/** 목차 UI: 대메뉴 한 줄 + 그 아래 소메뉴(들여쓰기). `sectionIndex`는 `flattenFortuneMenuForStream` 순서와 동일 */
export type FortuneTocSubRef = {
  id: string;
  title: string;
  sectionIndex: number;
  image_url?: string;
  video_thumb_url?: string;
};
export type FortuneTocMainGroup = {
  main_id: string;
  main_title: string;
  /** 대메뉴 행에만 등록된 이미지·동영상(목차 텍스트 아래 표시) */
  image_url?: string;
  video_thumb_url?: string;
  subs: FortuneTocSubRef[];
};

export function buildFortuneMenuTocGroups(menu: FortuneMenuPayload): FortuneTocMainGroup[] {
  const groups: FortuneTocMainGroup[] = [];
  let sectionIndex = 0;
  for (const m of menu.main_menus) {
    const mainTitle = m.title.trim() || "메뉴";
    const subs: FortuneTocSubRef[] = [];
    for (const s of m.sub_menus ?? []) {
      const st = s.title.trim();
      if (!st) continue;
      const iu = String(s.image_url ?? "").trim();
      const vu = String(s.video_thumb_url ?? "").trim();
      subs.push({
        id: s.id || `sec_${sectionIndex}`,
        title: st,
        sectionIndex,
        ...(iu ? { image_url: iu } : {}),
        ...(vu ? { video_thumb_url: vu } : {}),
      });
      sectionIndex++;
    }
    if (subs.length) {
      const miImg = String(m.image_url ?? "").trim();
      const miVid = String(m.video_thumb_url ?? "").trim();
      groups.push({
        main_id: m.id,
        main_title: mainTitle,
        ...(miImg ? { image_url: miImg } : {}),
        ...(miVid ? { video_thumb_url: miVid } : {}),
        subs,
      });
    }
  }
  return groups;
}
