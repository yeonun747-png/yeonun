import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { TextChatDetailShell } from "@/components/history/TextChatDetailShell";
import { TextChatDetailThread } from "@/components/history/TextChatDetailThread";
import { getVoiceSessionConversationDetail } from "@/lib/text-chat-history";
import {
  formatKstYmdDots,
  formatTextChatListDayDot,
  groupTextChatMessagesByKstDay,
  isUuidSessionId,
} from "@/lib/text-chat-history-public";
import { VOICE_CALL_ARCHIVE_LIST_DAYS } from "@/lib/voice-call-history-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  if (!isUuidSessionId(sessionId)) return { title: "음성 상담 대화 | 연운 緣運" };
  const detail = await getVoiceSessionConversationDetail(sessionId);
  if (!detail) return { title: "음성 상담 대화 | 연운 緣運" };
  const day = formatTextChatListDayDot(detail.started_at);
  return {
    title: `${detail.character_name}와 음성 상담 대화 · ${day} | 연운 緣運`,
    description: "음성 상담 중 주고받은 대화 글을 다시 봅니다.",
    robots: { index: false, follow: true },
  };
}

export default async function VoiceCallConversationPage({ params }: Props) {
  const { sessionId } = await params;
  if (!isUuidSessionId(sessionId)) notFound();

  const detail = await getVoiceSessionConversationDetail(sessionId);
  if (!detail) notFound();

  const grouped = groupTextChatMessagesByKstDay(detail.messages);
  const headerDay = formatTextChatListDayDot(detail.started_at);
  const retentionIso =
    detail.retention_until ??
    new Date(Date.parse(detail.started_at) + VOICE_CALL_ARCHIVE_LIST_DAYS * 86400000).toISOString();
  const retentionDots = formatKstYmdDots(retentionIso);

  const title = `${detail.character_name}와 음성 상담 대화 · ${headerDay}`;
  const retentionLine = `이 대화 글은 ${retentionDots}까지 보관됩니다`;
  const consultHref = `/meet?character_key=${encodeURIComponent(detail.character_key)}`;

  return (
    <TextChatDetailShell title={title} retentionLine={retentionLine} consultHref={consultHref} listHref="/history/calls">
      <TextChatDetailThread grouped={grouped} characterHan={detail.character_han} />
    </TextChatDetailShell>
  );
}
