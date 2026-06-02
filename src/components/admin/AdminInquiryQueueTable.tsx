"use client";

import { fmtInquiryDateTime, inquiryBodyPreview } from "@/lib/user-inquiry-format";
import { isInquiryReplyUnread, type UserInquiryRow } from "@/lib/user-inquiries-types";

function ReadBadge({ row }: { row: UserInquiryRow }) {
  if (row.status !== "resolved" || !String(row.admin_reply ?? "").trim()) {
    return <span className="y-admin-inq-read-badge none">—</span>;
  }
  if (isInquiryReplyUnread(row)) {
    return <span className="y-admin-inq-read-badge unread">미확인</span>;
  }
  return (
    <span className="y-admin-inq-read-badge read" title={fmtInquiryDateTime(row.reply_read_at)}>
      확인함
    </span>
  );
}

export function AdminInquiryQueueTable({
  rows,
  mode,
  busyId,
  onOpenMember,
  onRequestReply,
}: {
  rows: UserInquiryRow[];
  mode: "pending" | "resolved";
  busyId?: string | null;
  onOpenMember?: (userId: string) => void;
  onRequestReply?: (row: UserInquiryRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="y-admin-inq-empty">
        {mode === "pending" ? "미처리 문의가 없습니다." : "처리 완료 이력이 없습니다."}
      </p>
    );
  }

  return (
    <>
      <div className="y-admin-inq-table-wrap">
        <table className="y-admin-inq-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>전화</th>
              <th>회원</th>
              <th>문의 내용</th>
              {mode === "resolved" ? <th>답변</th> : null}
              <th>{mode === "pending" ? "접수일" : "처리일"}</th>
              {mode === "resolved" ? <th>회원 확인</th> : null}
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td className="y-admin-inq-mono">{row.phone || "—"}</td>
                <td>
                  {row.user_id ? (
                    onOpenMember ? (
                      <button type="button" className="y-admin-inq-link" onClick={() => onOpenMember(row.user_id!)}>
                        회원 CS
                      </button>
                    ) : (
                      "로그인"
                    )
                  ) : (
                    <span className="y-admin-inq-guest">게스트</span>
                  )}
                </td>
                <td className="y-admin-inq-body">{row.body}</td>
                {mode === "resolved" ? (
                  <td className="y-admin-inq-body">{inquiryBodyPreview(String(row.admin_reply ?? ""), 120)}</td>
                ) : null}
                <td className="y-admin-inq-time">
                  {mode === "pending" ? fmtInquiryDateTime(row.created_at) : fmtInquiryDateTime(row.resolved_at ?? row.created_at)}
                </td>
                {mode === "resolved" ? (
                  <td>
                    <ReadBadge row={row} />
                  </td>
                ) : null}
                <td>
                  {mode === "pending" ? (
                    <button
                      type="button"
                      className="y-admin-cs-inquiry-resolve-btn"
                      disabled={busyId === row.id}
                      onClick={() => onRequestReply?.(row)}
                    >
                      답변 작성
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
