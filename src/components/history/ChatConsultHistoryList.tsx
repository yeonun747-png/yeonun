"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  chatConsultListPreview,
  chatConsultListSessions,
  chatConsultThreadPublicCount,
  type ChatConsultSession,
} from "@/lib/chat-consult-archive";

import { ChatConsultHistorySheet } from "./ChatConsultHistorySheet";

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

function monthKey(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", timeZone: "Asia/Seoul" }).format(d);
}

function kstYmd(iso: string): string {
  return new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 10);
}

/** 목록 우측: 오늘 / M.D */
function formatListDateLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const t = kstYmd(iso);
  const n = kstYmd(new Date().toISOString());
  if (t === n) return "오늘";
  const parts = t.split("-");
  const mo = parts[1] ? String(Number(parts[1])) : "";
  const day = parts[2] ? String(Number(parts[2])) : "";
  return `${mo}.${day}`;
}

export function ChatConsultHistoryList() {
  const [sessions, setSessions] = useState<ChatConsultSession[]>([]);
  useEffect(() => setSessions(chatConsultListSessions()), []);

  const stats = useMemo(() => {
    let msgs = 0;
    let credits = 0;
    for (const s of sessions) {
      msgs += chatConsultThreadPublicCount(s);
      credits += s.credits_used;
    }
    return { n: sessions.length, msgs, credits };
  }, [sessions]);

  const groups = useMemo(() => {
    const m = new Map<string, ChatConsultSession[]>();
    for (const s of sessions) {
      const k = monthKey(s.updated_at);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    return Array.from(m.entries());
  }, [sessions]);

  return (
    <ChatConsultHistorySheet>
      <div className="y-chat-consult-mock-wrap">
        <section className="y-chat-consult-mock-stats" aria-label="요약">
          <div className="y-chat-consult-mock-stat">
            <div className="y-chat-consult-mock-stat-num">{stats.n}</div>
            <div className="y-chat-consult-mock-stat-label">총 상담 횟수</div>
          </div>
          <div className="y-chat-consult-mock-stat">
            <div className="y-chat-consult-mock-stat-num">{stats.msgs}</div>
            <div className="y-chat-consult-mock-stat-label">주고받은 메시지</div>
          </div>
          <div className="y-chat-consult-mock-stat">
            <div className="y-chat-consult-mock-stat-num">{stats.credits.toLocaleString("ko-KR")}</div>
            <div className="y-chat-consult-mock-stat-label">사용한 크레딧</div>
          </div>
        </section>

        {sessions.length === 0 ? (
          <p className="y-chat-consult-mock-empty">
            저장된 채팅 상담 기록이 없습니다. 만남 탭에서 채팅 상담을 시작해 보세요.
          </p>
        ) : (
          groups.map(([month, rows]) => (
            <section key={month} className="y-chat-consult-mock-month-block" aria-label={month}>
              <h2 className="y-chat-consult-mock-month-bar">{month}</h2>
              <ul className="y-chat-consult-mock-ul">
                {rows.map((s) => {
                  const n = chatConsultThreadPublicCount(s);
                  const preview = chatConsultListPreview(s);
                  return (
                    <li key={s.id}>
                      <Link className="y-chat-consult-mock-row" href={`/history/chats/${s.id}`} scroll={false}>
                        <div className={`y-chat-consult-mock-avatar ${s.character_key}`} aria-hidden>
                          {CHAR_HAN[s.character_key] ?? "緣"}
                        </div>
                        <div className="y-chat-consult-mock-main">
                          <div className="y-chat-consult-mock-top">
                            <span className="y-chat-consult-mock-name">{CHAR_NAME[s.character_key] ?? s.character_key}</span>
                            <span className="y-chat-consult-mock-date">{formatListDateLabel(s.updated_at)}</span>
                          </div>
                          <p className="y-chat-consult-mock-preview">{preview || "대화 미리보기"}</p>
                          <div className="y-chat-consult-mock-bottom">
                            <div className="y-chat-consult-mock-tags">
                              <span className="y-chat-consult-mock-tag">{s.topic_tag}</span>
                              <span className="y-chat-consult-mock-msgcount">{n} 메시지</span>
                            </div>
                            <span className="y-chat-consult-mock-credit">-{s.credits_used.toLocaleString("ko-KR")} 크레딧</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        <p className="y-chat-consult-mock-foot">크레딧 상담 기록은 30일간 이 기기에 보관됩니다.</p>
      </div>
    </ChatConsultHistorySheet>
  );
}
