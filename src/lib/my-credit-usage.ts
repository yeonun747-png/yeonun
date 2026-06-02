import { MISSIONS, type MissionId } from "@/lib/daily-missions";

const MS_12M = 365 * 24 * 60 * 60 * 1000;

/** API·mapCreditUsageRow용 — credit-server import 없이 클라이언트 안전 */
export type CreditUsageLedgerRow = {
  id: string;
  delta_paid: number;
  delta_free: number;
  kind: string;
  ref_type: string | null;
  ref_id: string | null;
  memo: string | null;
  created_at: string;
};

export type CreditUsageContext = {
  productNames: Map<string, string>;
  orderPurchaseTitles: Map<string, string>;
};

export type MyCreditUsageRow = {
  id: string;
  title: string;
  kindLabel: string;
  amountCredits: number;
  createdAt: string;
};

function isMissionId(id: string): id is MissionId {
  return id in MISSIONS;
}

export function titleFromProductSlugForUsage(slug: string): string {
  if (slug.startsWith("credit-package")) {
    if (slug.includes("basic")) return "크레딧 기본 충전";
    if (slug.includes("popular")) return "크레딧 인기 패키지";
    if (slug.includes("premium")) return "크레딧 프리미엄 패키지";
    return "크레딧 충전";
  }
  return slug.replace(/-/g, " ");
}

function kindLabel(row: CreditUsageLedgerRow, amount: number): string {
  if (row.ref_type === "attendance") return "출석 보상";
  if (row.kind === "purchase") return "크레딧 충전";
  if (row.kind === "spend_fortune") return "크레딧 사용";
  if (row.kind === "spend_chat") return "채팅 이용";
  if (row.kind === "spend_voice") return "음성 상담";
  if (row.kind === "cs_refund") return "CS 조정";
  if (row.kind === "trial_grant") return "무료 지급";
  if (row.kind === "migration_import") return "크레딧 이전";
  if (row.kind === "admin_adjust") {
    if (row.ref_type === "mission") return "오늘의 미션";
    return amount >= 0 ? "크레딧 적립" : "크레딧 차감";
  }
  return "이용";
}

function titleFromMemo(memo: string): string | null {
  const t = memo.trim();
  if (!t) return null;
  const missionMatch = t.match(/^미션\s+(M\d{2})\s*·\s*(.+)$/);
  if (missionMatch) {
    const id = missionMatch[1];
    if (isMissionId(id)) return `오늘의 미션 · ${MISSIONS[id].name}`;
    return `오늘의 미션 · ${missionMatch[2].trim()}`;
  }
  if (t.startsWith("출석 7일")) return t;
  return t;
}

export function mapCreditUsageRow(row: CreditUsageLedgerRow, ctx: CreditUsageContext): MyCreditUsageRow | null {
  const amount = row.delta_paid + row.delta_free;
  if (amount === 0) return null;

  const label = kindLabel(row, amount);
  let title = label;

  if (row.ref_type === "attendance") {
    title = row.memo?.trim() || "출석 7일 연속 달성";
  } else if (row.ref_type === "mission" && row.ref_id && isMissionId(row.ref_id)) {
    title = `오늘의 미션 · ${MISSIONS[row.ref_id].name}`;
  } else if (row.kind === "purchase" && row.ref_type === "order" && row.ref_id) {
    title = ctx.orderPurchaseTitles.get(row.ref_id) ?? row.memo?.trim() ?? "크레딧 충전";
  } else if (row.memo) {
    const fromMemo = titleFromMemo(row.memo);
    if (fromMemo) title = fromMemo;
    else if (row.kind.startsWith("spend_")) title = row.memo;
    else if (row.kind === "cs_refund" || row.kind === "admin_adjust" || row.kind === "migration_import") title = row.memo;
  } else if (row.kind === "spend_fortune" && row.ref_type === "product" && row.ref_id) {
    title = ctx.productNames.get(row.ref_id) ?? row.ref_id;
  } else if (row.kind === "trial_grant") {
    title = "신규 회원 무료 체험";
  } else if (row.kind === "purchase") {
    title = "크레딧 충전";
  } else if (row.kind === "spend_fortune") {
    title = "점사 이용";
  } else if (row.kind === "spend_chat") {
    title = "채팅 메시지";
  } else if (row.kind === "spend_voice") {
    title = "음성 상담";
  } else if (row.kind === "migration_import") {
    title = row.memo?.trim() || "계정 크레딧 이전";
  }

  return {
    id: row.id,
    title,
    kindLabel: label,
    amountCredits: amount,
    createdAt: row.created_at,
  };
}

export function creditUsageCutoffIso(now = Date.now()): string {
  return new Date(now - MS_12M).toISOString();
}

export function formatCreditUsageAmount(amount: number): string {
  const abs = Math.abs(amount).toLocaleString("ko-KR");
  if (amount > 0) return `+${abs}C`;
  if (amount < 0) return `−${abs}C`;
  return "0C";
}
