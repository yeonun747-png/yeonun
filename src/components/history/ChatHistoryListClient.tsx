"use client";

import Link from "next/link";

import { formatTextChatListDayDot, type TextChatListRow } from "@/lib/text-chat-history-public";

import { ChatHistorySheet } from "./ChatHistorySheet";

function BubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="y-tchat-list-icon-svg">
      <path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChatHistoryListClient({
  grouped,
  loadError,
}: {
  grouped: { monthLabel: string; rows: TextChatListRow[] }[];
  loadError: string | null;
}) {
  const empty = !loadError && grouped.every((g) => g.rows.length === 0);

  return (
    <ChatHistorySheet>
      <div className="y-tchat-list-wrap">
        {loadError ? (
          <p className="y-lib-error y-lib-error--sheet" role="alert">
            {loadError}
          </p>
        ) : null}

        {empty ? (
          <div className="y-lib-empty y-lib-empty--sheet">
            <p className="y-lib-empty-desc">저장된 텍스트 상담이 없습니다.</p>
            <Link className="y-lib-empty-cta" href="/meet">
              만남 탭에서 상담하기 →
            </Link>
          </div>
        ) : null}

        {!loadError && !empty
          ? grouped.map((block, mi) => (
              <section key={`${block.monthLabel}-${mi}`} className="y-tchat-list-section" aria-labelledby={`tchat-m-${mi}`}>
                <h2 id={`tchat-m-${mi}`} className="y-tchat-list-month">
                  {block.monthLabel}
                </h2>
                <ul className="y-tchat-list-ul">
                  {block.rows.map((row) => (
                    <li key={row.id}>
                      <Link href={`/history/chats/${row.id}`} className="y-tchat-list-row">
                        <div className="y-tchat-list-icon" aria-hidden>
                          <BubbleIcon />
                        </div>
                        <div className="y-tchat-list-main">
                          <div className="y-tchat-list-title">{row.character_name}와 텍스트 상담</div>
                          <div className="y-tchat-list-meta">
                            <span>{formatTextChatListDayDot(row.started_at)}</span>
                            <span>{row.message_count} 메시지</span>
                          </div>
                        </div>
                        <span className="y-tchat-list-chev" aria-hidden>
                          ›
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : null}

        {!loadError ? (
          <p className="y-tchat-list-foot">
            음성 상담에서 남은 대화 글과, 텍스트 전용으로 저장된 상담을 함께 보여 줍니다 · 목록은 최근 90일 기준입니다
          </p>
        ) : null}
      </div>
    </ChatHistorySheet>
  );
}
