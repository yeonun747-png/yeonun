import type { Metadata } from "next";

import { ChatConsultHistoryDetail } from "@/components/history/ChatConsultHistoryDetail";
import { TextChatConversationClient } from "@/components/history/TextChatConversationClient";
import { isUuidSessionId } from "@/lib/text-chat-history-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const sessionId = decodeURIComponent((await params).sessionId);
  if (!isUuidSessionId(sessionId)) {
    return { title: "채팅 상담 | 연운 緣運", robots: { index: false, follow: true } };
  }
  return {
    title: "텍스트 상담 | 연운 緣運",
    robots: { index: false, follow: true },
  };
}

export default async function TextChatOrConsultHistoryPage({ params }: Props) {
  const sessionId = decodeURIComponent((await params).sessionId);

  if (isUuidSessionId(sessionId)) {
    return <TextChatConversationClient sessionId={sessionId} />;
  }

  return <ChatConsultHistoryDetail sessionId={sessionId} />;
}
