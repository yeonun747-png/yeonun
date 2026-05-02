import { ChatHistoryListClient } from "@/components/history/ChatHistoryListClient";
import { listTextChatSessions } from "@/lib/text-chat-history";
import { groupTextChatRowsByKstMonth } from "@/lib/text-chat-history-public";

export const metadata = {
  title: "텍스트 대화 기록 | 연운 緣運",
  description: "텍스트 대화 기록",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChatHistoryPage() {
  let grouped: ReturnType<typeof groupTextChatRowsByKstMonth> = [];
  let loadError: string | null = null;

  try {
    const rows = await listTextChatSessions();
    grouped = groupTextChatRowsByKstMonth(rows);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "목록을 불러오지 못했습니다.";
  }

  return <ChatHistoryListClient grouped={grouped} loadError={loadError} />;
}
