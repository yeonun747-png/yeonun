"use client";

import type { UserInquiryRow } from "@/lib/user-inquiries-server";

function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AdminInquiryQueueTable({
  rows,
  mode,
  busyId,
  onResolve,
  onOpenMember,
}: {
  rows: UserInquiryRow[];
  mode: "pending" | "resolved";
  busyId: string | null;
  onResolve?: (id: string) => void;
  onOpenMember?: (userId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="y-admin-inq-empty">
        {mode === "pending" ? "미처리 문의가 없습니다." : "처리 완료 이력이 없습니다."}
      </p>
    );
  }

  return (
    <div className="y-admin-inq-table-wrap">
      <table className="y-admin-inq-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>전화</th>
            <th>회원</th>
            <th>문의 내용</th>
            <th>{mode === "pending" ? "접수일" : "처리일"}</th>
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
              <td className="y-admin-inq-time">
                {mode === "pending" ? fmtDt(row.created_at) : fmtDt(row.resolved_at ?? row.created_at)}
              </td>
              <td>
                {mode === "pending" && onResolve ? (
                  <button
                    type="button"
                    className="y-admin-cs-inquiry-resolve-btn"
                    disabled={busyId === row.id}
                    onClick={() => onResolve(row.id)}
                  >
                    {busyId === row.id ? "처리 중…" : "처리완료"}
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
  );
}
