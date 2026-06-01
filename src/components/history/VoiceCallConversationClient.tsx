"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TextChatDetailShell } from "@/components/history/TextChatDetailShell";
import { TextChatDetailThread } from "@/components/history/TextChatDetailThread";
import { VoiceCallReplayCta } from "@/components/history/VoiceCallReplayCta";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { TextChatDetail } from "@/lib/text-chat-history-public";
import {
  formatKstYmdDots,
  formatTextChatListDayDot,
  groupTextChatMessagesByKstDay,
} from "@/lib/text-chat-history-public";
import { getOrCreateVoiceVisitorRef } from "@/lib/voice-visitor-ref";
import { buildVoiceArchiveReplayBrief } from "@/lib/voice-archive-replay-brief";
import { VOICE_CALL_ARCHIVE_LIST_DAYS } from "@/lib/voice-call-history-public";

type LoadState = "loading" | "ready" | "forbidden" | "missing";

export function VoiceCallConversationClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<TextChatDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const sb = supabaseBrowser();
      const token = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const visitor = getOrCreateVoiceVisitorRef();
      if (visitor.startsWith("visitor_")) headers["X-Yeonun-Visitor-Ref"] = visitor;

      const res = await fetch(`/api/my/voice-conversation/${encodeURIComponent(sessionId)}`, {
        headers,
        cache: "no-store",
      });

      if (cancelled) return;

      if (res.status === 403) {
        setState("forbidden");
        return;
      }
      if (!res.ok) {
        setState("missing");
        return;
      }

      const data = (await res.json()) as { ok?: boolean; detail?: TextChatDetail };
      if (!data.ok || !data.detail) {
        setState("missing");
        return;
      }

      setDetail(data.detail);
      setState("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === "loading") {
    return (
      <>
        <MyTabBackdrop />
        <div className="y-history-route-live" style={{ padding: 24, color: "var(--y-mute)" }}>
          불러오는 중…
        </div>
      </>
    );
  }

  if (state === "forbidden") {
    return (
      <>
        <MyTabBackdrop />
        <div className="y-history-route-live" style={{ padding: 24 }}>
          <p>로그인 후 본인 상담 기록만 열람할 수 있습니다.</p>
          <button type="button" className="y-onboard-next" onClick={() => router.push("/my?shelf=voice")}>
            보관함으로
          </button>
        </div>
      </>
    );
  }

  if (state === "missing" || !detail) notFound();

  const grouped = groupTextChatMessagesByKstDay(detail.messages);
  const headerDay = formatTextChatListDayDot(detail.started_at);
  const retentionIso =
    detail.retention_until ??
    new Date(Date.parse(detail.started_at) + VOICE_CALL_ARCHIVE_LIST_DAYS * 86400000).toISOString();
  const retentionDots = formatKstYmdDots(retentionIso);
  const title = `${detail.character_name}와 음성 상담 대화 · ${headerDay}`;
  const retentionLine = `이 대화 글은 ${retentionDots}까지 보관됩니다`;
  const consultHref = `/call-dcc?character_key=${encodeURIComponent(detail.character_key)}`;
  const voiceBrief = buildVoiceArchiveReplayBrief(detail.messages);

  return (
    <>
      <MyTabBackdrop />
      <TextChatDetailShell
        title={title}
        retentionLine={retentionLine}
        consultHref={consultHref}
        consultCta={
          <VoiceCallReplayCta
            characterKey={detail.character_key}
            characterName={detail.character_name}
            voiceBrief={voiceBrief}
          />
        }
        listHref="/my?shelf=voice"
      >
        <TextChatDetailThread grouped={grouped} characterHan={detail.character_han} />
      </TextChatDetailShell>
    </>
  );
}
