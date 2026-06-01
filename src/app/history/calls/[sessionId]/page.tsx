import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { VoiceCallConversationClient } from "@/components/history/VoiceCallConversationClient";
import { isUuidSessionId } from "@/lib/text-chat-history-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  if (!isUuidSessionId(sessionId)) return { title: "음성 상담 대화 | 연운 緣運" };
  return {
    title: "음성 상담 대화 | 연운 緣運",
    description: "음성 상담 중 주고받은 대화 글을 다시 봅니다.",
    robots: { index: false, follow: true },
  };
}

export default async function VoiceCallConversationPage({ params }: Props) {
  const { sessionId } = await params;
  if (!isUuidSessionId(sessionId)) notFound();
  return <VoiceCallConversationClient sessionId={sessionId} />;
}
