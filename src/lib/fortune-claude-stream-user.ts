"use client";

import type { ClaudeFortuneUserInfo } from "@/lib/fortune-claude-payload";
import { PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR } from "@/lib/partner-hour-branch";
import { readPartnerInfo, type PartnerInfoPayload } from "@/lib/partner-info-storage";

/** 세션 `yeonun_saju_v1` → `/api/fortune/chat-stream`용 신청자 정보 */
export function readUserInfoFromYeonunSajuV1(): ClaudeFortuneUserInfo {
  if (typeof window === "undefined") {
    return { name: "회원", gender: "", birth_date: "" };
  }
  try {
    const raw = sessionStorage.getItem("yeonun_saju_v1");
    if (!raw) return { name: "회원", gender: "", birth_date: "" };
    const j = JSON.parse(raw) as Record<string, unknown>;
    const y = String(j.year ?? "").trim();
    const mo = String(j.month ?? "").trim();
    const d = String(j.day ?? "").trim();
    const birth_date =
      y && mo && d ? `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : "";
    const ho = j.hour != null && String(j.hour).trim() !== "" ? String(j.hour).trim() : "";
    const mi = j.minute != null && String(j.minute).trim() !== "" ? String(j.minute).trim() : "";
    const birth_hour =
      ho !== "" ? (mi !== "" ? `${ho.padStart(2, "0")}:${mi.padStart(2, "0")}` : `${ho.padStart(2, "0")}:00`) : undefined;
    const g = j.gender === "female" ? "여" : j.gender === "male" ? "남" : "";
    return {
      name: String(j.name ?? "").trim() || "회원",
      gender: g,
      birth_date,
      ...(birth_hour ? { birth_hour } : {}),
    };
  } catch {
    return { name: "회원", gender: "", birth_date: "" };
  }
}

export function partnerInfoFromPartnerStorage(productSlug: string): ClaudeFortuneUserInfo | null {
  if (typeof window === "undefined") return null;
  const p = readPartnerInfo(productSlug);
  if (!p) return null;
  return partnerPayloadToClaudeFortuneUser(p);
}

export function partnerPayloadToClaudeFortuneUser(p: PartnerInfoPayload): ClaudeFortuneUserInfo {
  const genderKo = p.gender === "male" ? "남" : p.gender === "female" ? "여" : "";
  const birth_date = `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  const h =
    p.unknownTime || !p.hourBranch ? undefined : PARTNER_HOUR_BRANCH_TO_CLOCK_HOUR[p.hourBranch];
  const birth_hour =
    h != null ? `${String(h).padStart(2, "0")}:00 (시지 ${p.hourBranch})` : undefined;
  return {
    name: (p.name || "상대").trim(),
    gender: genderKo,
    birth_date,
    ...(birth_hour ? { birth_hour } : {}),
  };
}
