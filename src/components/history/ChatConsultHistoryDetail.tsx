"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { TopNav } from "@/components/TopNav";
import {
  chatConsultExpiresAtMs,
  chatConsultGetSession,
  chatConsultThreadPublicCount,
  type ChatConsultSession,
} from "@/lib/chat-consult-archive";

const CHAR_NAME: Record<string, string> = {
  yeon: "연화",
  byeol: "별하",
  yeo: "여연",
  un: "운서",
};

const CHAR_HAN: Record<string, string> = {
  yeon: "蓮",
  byeol: "星",
  yeo: "易",
  un: "運",
};

export function ChatConsultHistoryDetail({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<ChatConsultSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setSession(chatConsultGetSession(sessionId));
    setReady(true);
  }, [sessionId]);

  if (!ready) {
    return (
      <div className="yeonunPage">
        <TopNav />
        <main className="y-sub-scroll-page" style={{ padding: 24 }}>
          <p style={{ color: "var(--y-mute)" }}>불러오는 중…</p>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="yeonunPage">
        <TopNav />
        <main className="y-sub-scroll-page" style={{ padding: 24 }}>
          <p>기록을 찾을 수 없습니다.</p>
          <Link href="/history/chats">목록으로</Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  const charName = CHAR_NAME[session.character_key] ?? session.character_key;
  const charHan = CHAR_HAN[session.character_key] ?? "緣";
  const expireMs = chatConsultExpiresAtMs(session);
  const expireLabel = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(
    new Date(expireMs),
  );

  const continueHref = `/meet?modal=chat_consult&character_key=${encodeURIComponent(session.character_key)}&chat_session=${encodeURIComponent(session.id)}`;

  return (
    <div className="yeonunPage">
      <TopNav />
      <header className="y-page-sub-head">
        <button type="button" className="y-page-sub-back" aria-label="목록으로" onClick={() => router.push("/history/chats")}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M15 18 L9 12 L15 6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <h1 className="y-page-sub-title">상담 내용</h1>
        <span className="y-page-sub-spacer" aria-hidden />
      </header>

      <main className="y-sub-scroll-page y-chat-hist-detail">
        <div className="y-chat-hist-subhead">
          <div className={`y-chat-hist-avatar lg ${session.character_key}`} aria-hidden>
            {charHan}
          </div>
          <div>
            <div className="y-chat-hist-subhead-name">{charName}</div>
            <div className="y-chat-hist-subhead-meta">
              {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(
                new Date(session.updated_at),
              )}
              · 메시지 {chatConsultThreadPublicCount(session)} · {session.credits_used.toLocaleString("ko-KR")} 크레딧
            </div>
          </div>
        </div>

        <div className="y-chat-hist-thread">
          {session.messages.map((m) => {
            if (m.role === "system") {
              return (
                <div key={m.id} className="y-chat-consult-system">
                  {m.body}
                </div>
              );
            }
            if (m.role === "user") {
              if (m.ui_hidden) return null;
              return (
                <div key={m.id} className="y-chat-consult-row user">
                  <div className="y-chat-consult-bubble user">{m.body}</div>
                </div>
              );
            }
            return (
              <div key={m.id} className="y-chat-consult-row assistant">
                <div className="y-chat-consult-bubble assistant">{m.body}</div>
              </div>
            );
          })}
        </div>

        <div className="y-chat-hist-detail-foot">
          <p className="y-chat-hist-expire">보관 만료 예정일 · {expireLabel}</p>
          <Link className="y-chat-hist-continue" href={continueHref} scroll={false}>
            이어하기
          </Link>
        </div>

        <div style={{ height: 80 }} />
      </main>
      <BottomNav />
    </div>
  );
}
