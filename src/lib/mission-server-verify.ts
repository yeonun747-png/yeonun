import type { SupabaseClient } from "@supabase/supabase-js";

import type { MissionId } from "@/lib/daily-missions";
import {
  hasUserMissionEvent,
  hasUserMissionM04Complete,
  hours24SinceIso,
  kstDateForMissionWindow,
} from "@/lib/mission-event-server";

const M07_CHARACTER_KEYS = ["yeon", "byeol", "yeo", "un"] as const;

/** 클라이언트 localStorage만으로는 검증 불가 — 서버 DB로 확인 가능한 미션만 차단 */
export async function assertMissionEligibleOnServer(
  supabase: SupabaseClient,
  userId: string,
  missionId: MissionId,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const todayKst = kstDateForMissionWindow();
  const since24h = hours24SinceIso();

  switch (missionId) {
    case "M01": {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", userId)
        .maybeSingle();
      if (!data?.onboarding_completed_at) return { ok: false, error: "mission_not_completed" };
      return { ok: true };
    }
    case "M02": {
      const { count } = await supabase
        .from("voice_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_ref", userId);
      if (!count) return { ok: false, error: "mission_not_completed" };
      return { ok: true };
    }
    case "M03": {
      if (await hasUserMissionEvent(supabase, userId, "m03-iljin", todayKst)) return { ok: true };
      return { ok: false, error: "mission_not_completed" };
    }
    case "M04": {
      if (await hasUserMissionM04Complete(supabase, userId, todayKst)) return { ok: true };
      return { ok: false, error: "mission_not_completed" };
    }
    case "M05": {
      const dreamEvent =
        (await hasUserMissionEvent(supabase, userId, "m05-dream", todayKst)) ||
        (await hasUserMissionEvent(supabase, userId, "m05-dream-library", todayKst));
      if (dreamEvent) return { ok: true };

      const { count: orderCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_ref", userId)
        .eq("status", "paid")
        .eq("product_slug", "dream-lastnight")
        .gte("created_at", since24h);
      if (orderCount) return { ok: true };

      const { count: reqCount } = await supabase
        .from("fortune_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_ref", userId)
        .eq("product_slug", "dream-lastnight")
        .gte("created_at", since24h);
      if (reqCount) return { ok: true };

      return { ok: false, error: "mission_not_completed" };
    }
    case "M06": {
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("user_ref", userId)
        .gte("created_at", since24h);
      if (!count) return { ok: false, error: "mission_not_completed" };
      return { ok: true };
    }
    case "M07": {
      for (const ck of M07_CHARACTER_KEYS) {
        const { count: recentCount } = await supabase
          .from("voice_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_ref", userId)
          .eq("character_key", ck)
          .gte("started_at", since24h);
        if (recentCount !== 1) continue;

        const { count: total } = await supabase
          .from("voice_sessions")
          .select("id", { count: "exact", head: true })
          .eq("user_ref", userId)
          .eq("character_key", ck);
        if (total === 1) return { ok: true };
      }
      return { ok: false, error: "mission_not_completed" };
    }
    case "M09": {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_ref", userId)
        .eq("status", "paid")
        .gte("created_at", since24h);
      if (!count) return { ok: false, error: "mission_not_completed" };
      return { ok: true };
    }
    case "M10": {
      if (await hasUserMissionEvent(supabase, userId, "m10-manse", todayKst)) return { ok: true };
      return { ok: false, error: "mission_not_completed" };
    }
    case "M11": {
      if (await hasUserMissionEvent(supabase, userId, "m11-daily-record", todayKst)) return { ok: true };
      return { ok: false, error: "mission_not_completed" };
    }
    case "M12": {
      const { count } = await supabase
        .from("share_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kst_date", todayKst);
      if (count) return { ok: true };
      if (await hasUserMissionEvent(supabase, userId, "m12-daily-words-share", todayKst)) return { ok: true };
      return { ok: false, error: "mission_not_completed" };
    }
    default:
      return { ok: false, error: "mission_not_completed" };
  }
}
