import { CallHistoryClient } from "@/components/history/CallHistoryClient";
import { groupVoiceHistoryByKstMonth, listVoiceCallHistoryRows } from "@/lib/voice-call-history";

export const metadata = {
  title: "상담 히스토리 | 연운 緣運",
  description: "음성 상담 기록",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CallHistoryPage() {
  let grouped: ReturnType<typeof groupVoiceHistoryByKstMonth> = [];
  let loadError: string | null = null;

  try {
    const rows = await listVoiceCallHistoryRows();
    grouped = groupVoiceHistoryByKstMonth(rows);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
  }

  return <CallHistoryClient grouped={grouped} loadError={loadError} />;
}
