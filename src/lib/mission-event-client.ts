import { formatKstDateKey } from "@/lib/datetime/kst";
import { supabaseBrowser } from "@/lib/supabase/client";

/** 로그인 사용자 미션 사실을 서버에 기록(보상 eligibility 검증용) */
export function syncMissionEventToServer(eventKey: string, kst?: string): void {
  if (typeof window === "undefined") return;
  const kstDate = kst ?? formatKstDateKey(new Date());

  void (async () => {
    try {
      const sb = supabaseBrowser();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      if (!token) return;

      await fetch("/api/missions/record-event", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ event_key: eventKey, kst_date: kstDate }),
      });
    } catch {
      /* ignore */
    }
  })();
}
