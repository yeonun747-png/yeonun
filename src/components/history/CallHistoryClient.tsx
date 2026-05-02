"use client";

import type { VoiceCallHistoryRowVm } from "@/lib/voice-call-history-public";

import { CallHistorySheet } from "./CallHistorySheet";

function HeadphoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 18v-6a9 9 0 0 1 18 0v6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CallHistoryClient({
  grouped,
  loadError,
}: {
  grouped: { monthLabel: string; rows: VoiceCallHistoryRowVm[] }[];
  loadError: string | null;
}) {
  const empty = !loadError && grouped.every((g) => g.rows.length === 0);

  return (
    <CallHistorySheet>
      <div className="y-call-hist-wrap">
        {loadError ? (
          <p className="y-lib-error y-lib-error--sheet" role="alert">
            {loadError}
          </p>
        ) : null}

        {empty ? (
          <div className="y-lib-empty y-lib-empty--sheet">
            <p className="y-lib-empty-desc">종료된 음성 상담 기록이 없습니다.</p>
            <p className="y-call-hist-empty-hint">만남 탭에서 상담을 시작하면 여기에 표시됩니다.</p>
          </div>
        ) : null}

        {!loadError && !empty
          ? grouped.map((block, mi) => (
              <section key={`${block.monthLabel}-${mi}`} className="y-call-hist-section" aria-labelledby={`call-hist-m-${mi}`}>
                <h2 id={`call-hist-m-${mi}`} className="y-call-hist-month">
                  {block.monthLabel}
                </h2>
                <ul className="y-call-hist-list">
                  {block.rows.map((row) => (
                    <li key={row.id}>
                      <div className="y-call-hist-row" role="group" aria-label={`${row.consultantName} 음성 상담 ${row.timeLine}`}>
                        <div className="y-call-hist-icon">
                          <HeadphoneIcon />
                        </div>
                        <div className="y-call-hist-main">
                          <div className="y-call-hist-title">{row.consultantName}와 음성 상담</div>
                          <div className="y-call-hist-time">{row.timeLine}</div>
                          {row.resultSnippet ? <p className="y-call-hist-snippet">{row.resultSnippet}</p> : null}
                        </div>
                        <span className="y-call-hist-badge">{row.badge}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          : null}

        {!loadError ? (
          <p className="y-call-hist-foot">상담 종료 시 저장된 요약·대화가 표시됩니다 · 최근 {90}일</p>
        ) : null}
      </div>
    </CallHistorySheet>
  );
}
