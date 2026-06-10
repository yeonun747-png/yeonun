import { kstAddDays, kstStartOfDay, kstStartOfMonthOffset, kstStartOfNextMonth } from "@/lib/datetime/kst";

export type LibraryRetentionKind = "days" | "kst_day" | "kst_month" | "kst_month_3";

export type LibraryRetentionPolicy = {
  kind: LibraryRetentionKind;
  /** `kind === "days"` 일 때만 사용 (기본 60) */
  days: number;
};

export const DEFAULT_LIBRARY_RETENTION_DAYS = 60;

export const DEFAULT_LIBRARY_RETENTION: LibraryRetentionPolicy = {
  kind: "days",
  days: DEFAULT_LIBRARY_RETENTION_DAYS,
};

function clampRetentionDays(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_LIBRARY_RETENTION_DAYS;
  return Math.min(3650, Math.max(1, Math.trunc(n)));
}

export function normalizeLibraryRetentionKind(raw: unknown): LibraryRetentionKind {
  const k = String(raw ?? "").trim();
  if (k === "kst_day" || k === "kst_month" || k === "kst_month_3") return k;
  return "days";
}

export function parseLibraryRetentionFromProduct(row: {
  library_retention_kind?: unknown;
  library_retention_days?: unknown;
} | null | undefined): LibraryRetentionPolicy {
  if (!row) return DEFAULT_LIBRARY_RETENTION;
  return {
    kind: normalizeLibraryRetentionKind(row.library_retention_kind),
    days: clampRetentionDays(Number(row.library_retention_days ?? DEFAULT_LIBRARY_RETENTION_DAYS)),
  };
}

/** 완료 시각 기준 KST 자정 리셋 만료 시각(ms). 유효하지 않은 anchor면 null */
export function libraryRetentionExpiresAtMs(anchorIso: string, policy: LibraryRetentionPolicy): number | null {
  const anchor = Date.parse(anchorIso);
  if (!Number.isFinite(anchor)) return null;
  const anchorDate = new Date(anchor);

  switch (policy.kind) {
    case "kst_day":
      return kstAddDays(kstStartOfDay(anchorDate), 1).getTime();
    case "kst_month":
      return kstStartOfNextMonth(anchorDate).getTime();
    case "kst_month_3":
      return kstStartOfMonthOffset(anchorDate, 3).getTime();
    case "days":
    default:
      return kstAddDays(kstStartOfDay(anchorDate), policy.days).getTime();
  }
}

export function isLibraryRetentionValid(
  anchorIso: string,
  policy: LibraryRetentionPolicy,
  nowMs: number = Date.now(),
): boolean {
  const expireMs = libraryRetentionExpiresAtMs(anchorIso, policy);
  if (expireMs === null) return false;
  return nowMs < expireMs;
}

export function libraryRetentionBadge(
  anchorIso: string,
  policy: LibraryRetentionPolicy,
  nowMs: number = Date.now(),
): { kind: "days"; left: number } | { kind: "expired" } {
  const expireMs = libraryRetentionExpiresAtMs(anchorIso, policy);
  if (expireMs === null || nowMs >= expireMs) return { kind: "expired" };
  const left = Math.ceil((expireMs - nowMs) / 86_400_000);
  if (left <= 0) return { kind: "expired" };
  return { kind: "days", left };
}

/** 어드민·안내 문구용 */
export function formatLibraryRetentionLabel(policy: LibraryRetentionPolicy): string {
  switch (policy.kind) {
    case "kst_day":
      return "당일만 (KST 자정 리셋)";
    case "kst_month":
      return "당월만 (다음달 1일 리셋)";
    case "kst_month_3":
      return "3개월 (완료월 포함 3달, 4번째 달 1일 리셋)";
    case "days":
    default:
      return `${policy.days}일 (KST 자정 기준)`;
  }
}
