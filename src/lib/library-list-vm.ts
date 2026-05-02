import {
  normalizeLibraryCharacterKey,
  type LibraryCharacterFilterKey,
} from "@/lib/library-character-filters";
import { fortuneLibraryCharLabel, type FortuneLibraryListRow } from "@/lib/library-fortune";

export type LibraryListItemVm = {
  requestId: string;
  characterKey: LibraryCharacterFilterKey | "";
  charLabel: string;
  /** 예: 연화 · 재회비책 풀이 */
  productLine: string;
  title: string;
  /** KST 기준 YYYY.MM.DD */
  dateYmd: string;
  visibleChars: number;
  badge: { kind: "days"; left: number } | { kind: "expired" };
};

const HOLD_MS = 60 * 24 * 60 * 60 * 1000;

function retentionBadge(completedOrCreatedIso: string): LibraryListItemVm["badge"] {
  const anchor = Date.parse(completedOrCreatedIso);
  if (!Number.isFinite(anchor)) return { kind: "expired" };
  const expire = anchor + HOLD_MS;
  const left = Math.ceil((expire - Date.now()) / (24 * 60 * 60 * 1000));
  if (left <= 0) return { kind: "expired" };
  return { kind: "days", left };
}

function formatKstDateYmdDots(iso: string): string {
  try {
    const ymd = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
    return ymd.replace(/-/g, ".");
  } catch {
    return "";
  }
}

function rowDisplayTitle(row: FortuneLibraryListRow, productTitleBySlug: Record<string, string>): string {
  const t = row.payload.title?.trim();
  if (t) return t;
  const slug = row.product_slug?.trim();
  if (slug && productTitleBySlug[slug]) return productTitleBySlug[slug];
  return "저장된 풀이";
}

export function buildLibraryListItemVm(
  row: FortuneLibraryListRow,
  productTitleBySlug: Record<string, string>,
): LibraryListItemVm {
  const slug = row.product_slug?.trim();
  const productTitle = slug && productTitleBySlug[slug] ? productTitleBySlug[slug] : "풀이";
  const charKey = normalizeLibraryCharacterKey(row.payload.character_key);
  const charLabel = fortuneLibraryCharLabel(row.payload.character_key);
  const title = rowDisplayTitle(row, productTitleBySlug);
  const when = row.completed_at || row.created_at;

  return {
    requestId: row.request_id,
    characterKey: charKey,
    charLabel,
    productLine: `${charLabel} · ${productTitle}`,
    title,
    dateYmd: formatKstDateYmdDots(when),
    visibleChars: row.visible_char_count,
    badge: retentionBadge(when),
  };
}
