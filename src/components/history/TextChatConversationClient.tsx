"use client";

import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { TextChatDetailShell } from "@/components/history/TextChatDetailShell";
import { TextChatDetailThread } from "@/components/history/TextChatDetailThread";
import { MyTabBackdrop } from "@/components/my/MyTabBackdrop";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { TextChatDetail } from "@/lib/text-chat-history-public";
import {
  formatKstYmdDots,
  formatTextChatListDayDot,
  groupTextChatMessagesByKstDay,
} from "@/lib/text-chat-history-public";
import { getOrCreateVoiceVisitorRef } from "@/lib/voice-visitor-ref";

type LoadState = "loading" | "ready" | "forbidden" | "missing";

export function TextChatConversationClient({ sessionId }: { sessionId: string }) {
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

      const res = await fetch(`/api/my/text-chat-conversation/${encodeURIComponent(sessionId)}`, {
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
          <button type="button" className="y-onboard-next" onClick={() => router.push("/history/chats")}>
            목록으로
          </button>
        </div>
      </>
    );
  }

  if (state === "missing" || !detail) notFound();

  const grouped = groupTextChatMessagesByKstDay(detail.messages);
  const headerDay = formatTextChatListDayDot(detail.started_at);
  const retentionIso =
    detail.retention_until ?? new Date(Date.parse(detail.started_at) + 30 * 86400000).toISOString();
  const retentionDots = formatKstYmdDots(retentionIso);
  const title = `${detail.character_name}와 텍스트 상담 · ${headerDay}`;
  const retentionLine = `이 대화는 ${retentionDots}까지 보관됩니다`;
  const consultHref = `/meet?character_key=${encodeURIComponent(detail.character_key)}`;

  return (
    <>
      <MyTabBackdrop />
      <div className="y-history-route-live">
        <TextChatDetailShell title={title} retentionLine={retentionLine} consultHref={consultHref}>
          <TextChatDetailThread grouped={grouped} characterHan={detail.character_han} />
        </TextChatDetailShell>
      </div>
    </>
  );
}
