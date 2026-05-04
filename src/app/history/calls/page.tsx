import { CallHistoryClient } from "@/components/history/CallHistoryClient";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { groupVoiceHistoryByKstMonth, listVoiceCallHistoryRows } from "@/lib/voice-call-history";

export const metadata = {
  title: "음성상담 보관함 | 연운 緣運",
  description: "종료된 음성 상담 목록과 대화 글(전사)을 60일간 확인합니다.",
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

  return (
    <>
      <MyTabBackdrop />
      <CallHistoryClient grouped={grouped} loadError={loadError} />
    </>
  );
}
