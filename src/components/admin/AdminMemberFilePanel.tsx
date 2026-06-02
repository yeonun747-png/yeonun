"use client";

import { useState } from "react";

import type {
  AdminMemberFile,
  AdminMemberFileInquiryRow,
  AdminMemberFilePaymentRow,
  AdminMemberFileReviewRow,
  AdminMemberFileUsageRow,
} from "@/lib/admin-cs-member";

export type AdminMemberFileTab = "info" | "usage" | "payments" | "reviews" | "inquiries";

export type AdminMemberFileAdjustProps = {
  busy: boolean;
  deltaPaid: string;
  deltaFree: string;
  adjustKind: "cs_refund" | "admin_adjust";
  memo: string;
  refId: string;
  onDeltaPaid: (v: string) => void;
  onDeltaFree: (v: string) => void;
  onAdjustKind: (v: "cs_refund" | "admin_adjust") => void;
  onMemo: (v: string) => void;
  onRefId: (v: string) => void;
  onAdjust: () => void;
};

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
    second: "2-digit",
    hour12: false,
  });
}

function fmtKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <th>{label}</th>
      <td>{value}</td>
    </tr>
  );
}

function CreditBalanceCards({ wallet }: { wallet: AdminMemberFile["wallet"] }) {
  const freeExpiresLabel =
    wallet.free_expires_at && wallet.free > 0
      ? new Date(wallet.free_expires_at).toLocaleDateString("ko-KR", { dateStyle: "medium" })
      : null;

  return (
    <div className="y-admin-member-credits-balances y-admin-cs-balance-cards">
      <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--paid">
        <span className="y-admin-member-credits-balance-label">유료</span>
        <strong className="y-admin-member-credits-balance-value">{wallet.paid.toLocaleString("ko-KR")}</strong>
      </div>
      <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--free">
        <span className="y-admin-member-credits-balance-label">무료</span>
        <strong className="y-admin-member-credits-balance-value">{wallet.free.toLocaleString("ko-KR")}</strong>
        {freeExpiresLabel ? (
          <span className="y-admin-member-credits-balance-sub">만료 {freeExpiresLabel}</span>
        ) : null}
      </div>
      <div className="y-admin-member-credits-balance-card y-admin-member-credits-balance-card--total">
        <span className="y-admin-member-credits-balance-label">합계</span>
        <strong className="y-admin-member-credits-balance-value">{wallet.total.toLocaleString("ko-KR")}</strong>
      </div>
    </div>
  );
}

function UsageLogTable({ rows }: { rows: AdminMemberFileUsageRow[] }) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">이용 내역이 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>이용타입</th>
            <th>유형</th>
            <th>크레딧</th>
            <th>유료/무료</th>
            <th>코드</th>
            <th>내역</th>
            <th>이용일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <span className={`y-admin-cs-usage-type y-admin-cs-usage-type--${row.usage_type}`}>
                  {row.usage_type_label}
                </span>
              </td>
              <td>{row.kind_label}</td>
              <td className={row.amount > 0 ? "plus" : row.amount < 0 ? "minus" : ""}>
                {row.amount > 0 ? `+${row.amount.toLocaleString("ko-KR")}` : row.amount.toLocaleString("ko-KR")}
              </td>
              <td className="y-admin-cs-num">
                {row.delta_paid ? row.delta_paid.toLocaleString("ko-KR") : "0"} /{" "}
                {row.delta_free ? row.delta_free.toLocaleString("ko-KR") : "0"}
              </td>
              <td className="y-admin-cs-mono">{row.code ?? "—"}</td>
              <td>{row.code_name}</td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentLogTable({ rows }: { rows: AdminMemberFilePaymentRow[] }) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">결제 내역이 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>주문번호</th>
            <th>결제방식</th>
            <th>결제정보</th>
            <th>결제금액</th>
            <th>지급크레딧</th>
            <th>상품</th>
            <th>구매일시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="y-admin-cs-mono">{row.order_no}</td>
              <td>
                <span className="y-admin-cs-pay-badge">{row.method_label}</span>
              </td>
              <td>{row.payment_info}</td>
              <td className="y-admin-cs-num">{fmtKrw(row.amount_krw)}</td>
              <td className="y-admin-cs-num">
                {row.bonus_credits > 0 ? row.bonus_credits.toLocaleString("ko-KR") : "—"}
              </td>
              <td>{row.title}</td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.paid_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { fmtInquiryDateTime, inquiryBodyPreview } from "@/lib/user-inquiry-format";
import { isInquiryReplyUnread } from "@/lib/user-inquiries-types";

function InquiriesTable({
  rows,
  onRequestReply,
}: {
  rows: AdminMemberFileInquiryRow[];
  onRequestReply?: (row: AdminMemberFileInquiryRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">접수된 문의가 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>이름</th>
            <th>이메일</th>
            <th>전화번호</th>
            <th>상태</th>
            <th>문의 내용</th>
            <th>답변</th>
            <th>접수일</th>
            <th>회원 확인</th>
            {onRequestReply ? <th>처리</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.email}</td>
              <td className="y-admin-cs-mono">{row.phone || "—"}</td>
              <td>
                <span className={`y-admin-cs-inquiry-status ${row.status === "pending" ? "pending" : "done"}`}>
                  {row.status === "pending" ? "미처리" : "처리완료"}
                </span>
              </td>
              <td className="y-admin-cs-inquiry-body">{row.body}</td>
              <td className="y-admin-cs-inquiry-body">
                {row.status === "resolved" && row.admin_reply
                  ? inquiryBodyPreview(row.admin_reply, 80)
                  : "—"}
              </td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.created_at)}</td>
              <td>
                {row.status === "resolved" && row.admin_reply ? (
                  isInquiryReplyUnread({
                    status: "resolved",
                    admin_reply: row.admin_reply,
                    reply_read_at: row.reply_read_at,
                  }) ? (
                    <span className="y-admin-inq-read-badge unread">미확인</span>
                  ) : (
                    <span className="y-admin-inq-read-badge read" title={fmtInquiryDateTime(row.reply_read_at)}>
                      확인함
                    </span>
                  )
                ) : (
                  "—"
                )}
              </td>
              {onRequestReply ? (
                <td>
                  {row.status === "pending" ? (
                    <button type="button" className="y-admin-cs-inquiry-resolve-btn" onClick={() => onRequestReply(row)}>
                      답변 작성
                    </button>
                  ) : (
                    <span className="y-admin-cs-muted">{fmtDt(row.resolved_at)}</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsTable({ rows }: { rows: AdminMemberFileReviewRow[] }) {
  if (rows.length === 0) {
    return <p className="y-admin-member-credits-empty">작성한 후기가 없습니다.</p>;
  }
  return (
    <div className="y-admin-member-credits-table-wrap">
      <table className="y-admin-cs-file-data y-admin-member-credits-table">
        <thead>
          <tr>
            <th>별점</th>
            <th>상품</th>
            <th>출처</th>
            <th>노출</th>
            <th>내용</th>
            <th>작성일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="y-admin-cs-num">{row.stars.toFixed(1)}</td>
              <td>{row.product_title}</td>
              <td>{row.source_type ?? "—"}</td>
              <td>
                <span className={`y-admin-cs-review-pub ${row.is_published ? "on" : ""}`}>
                  {row.is_published ? "노출" : "비노출"}
                </span>
              </td>
              <td className="y-admin-cs-review-body">{row.body}</td>
              <td className="y-admin-member-credits-cell-time">{fmtDt(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type AdminMemberFileInquiryResolveProps = {
  onRequestReply: (row: AdminMemberFileInquiryRow) => void;
};

export function AdminMemberFilePanel({
  file,
  initialTab = "info",
  adjust,
  inquiryResolve,
}: {
  file: AdminMemberFile;
  initialTab?: AdminMemberFileTab;
  adjust?: AdminMemberFileAdjustProps;
  inquiryResolve?: AdminMemberFileInquiryResolveProps;
}) {
  const [tab, setTab] = useState<AdminMemberFileTab>(initialTab);
  const { member, wallet, profiles, payment_totals_by_year, payments, usage_log, reviews, inquiries, activity } = file;
  const email = member.email ?? "—";

  return (
    <div className="y-admin-cs-file">
      <div className="y-admin-cs-file-banner">
        <strong>{email}</strong>
        <span>님의 회원 파일</span>
      </div>

      <div className="y-admin-cs-file-tabs" role="tablist">
        {(
          [
            ["info", "회원정보"],
            ["usage", "이용로그"],
            ["payments", "결제로그"],
            ["reviews", "후기보기"],
            ["inquiries", "문의내용보기"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "info" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--stack">
          <h4 className="y-admin-cs-file-panel-title">회원정보</h4>
          <table className="y-admin-cs-file-kv">
            <tbody>
              <InfoRow label="회원 UUID" value={<code className="y-admin-cs-mono">{member.user_id}</code>} />
              <InfoRow label="아이디(이메일)" value={email} />
              <InfoRow
                label="SNS"
                value={
                  member.provider_label
                    ? `${member.provider_label}${member.provider_id ? ` · ${member.provider_id}` : ""}`
                    : "—"
                }
              />
              <InfoRow label="표시명" value={member.display_name || member.social_name || "—"} />
              <InfoRow
                label="결제금액 (3년)"
                value={
                  payment_totals_by_year.length > 0 ? (
                    <ul className="y-admin-cs-year-totals">
                      {payment_totals_by_year.map((y) => (
                        <li key={y.year}>
                          {y.year}년 : {fmtKrw(y.total_krw)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="가입일" value={fmtDt(member.joined_at)} />
              <InfoRow label="최근 로그인" value={fmtDt(member.last_login_at)} />
              <InfoRow label="프로필 수정" value={fmtDt(member.profile_updated_at)} />
              <InfoRow
                label="활동 요약"
                value={`점사 ${activity.fortune_requests} · 음성 ${activity.voice_sessions} · 채팅 ${activity.text_chat_sessions}`}
              />
              <InfoRow label="첫 구매" value={wallet.first_purchase_done ? "완료" : "미완료"} />
              {!wallet.wallet_exists ? (
                <InfoRow
                  label="지갑"
                  value={<span className="y-admin-cs-warn">서버 지갑 없음 — 크레딧 반영 시 생성됩니다</span>}
                />
              ) : null}
            </tbody>
          </table>

          <section className="y-admin-cs-file-section">
            <h4 className="y-admin-cs-file-panel-title">생년월일 · 사주 입력 (서버 profiles)</h4>
            {profiles.length === 0 ? (
              <p className="y-admin-member-credits-empty">온보딩 미완료 — profiles 행 없음</p>
            ) : (
              <table className="y-admin-cs-file-data">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>이름</th>
                    <th>성별</th>
                    <th>생년월일</th>
                    <th>시간</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p, i) => (
                    <tr key={i}>
                      <td>{p.is_primary ? "대표" : i + 1}</td>
                      <td>{p.name}</td>
                      <td>{p.gender_label}</td>
                      <td>{p.birth_label}</td>
                      <td>{p.birth_branch_label ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="y-admin-cs-file-note">궁합 상대·기기 전용 사주는 DB에 없으며 profiles 대표 1건만 표시됩니다.</p>
          </section>

          {adjust ? (
            <div className="y-admin-cs-adjust-box">
              <h5>크레딧 조정 (CS)</h5>
              <CreditBalanceCards wallet={wallet} />
              <div className="y-admin-form compact y-admin-member-credits-adjust">
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">유료 (+/-)</span>
                  <input
                    inputMode="numeric"
                    value={adjust.deltaPaid}
                    onChange={(e) => adjust.onDeltaPaid(e.target.value)}
                    placeholder="예: 3900"
                  />
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">무료 (+/-)</span>
                  <input
                    inputMode="numeric"
                    value={adjust.deltaFree}
                    onChange={(e) => adjust.onDeltaFree(e.target.value)}
                    placeholder="예: 130"
                  />
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">사유 유형</span>
                  <select
                    value={adjust.adjustKind}
                    onChange={(e) => adjust.onAdjustKind(e.target.value as "cs_refund" | "admin_adjust")}
                  >
                    <option value="cs_refund">CS 환불</option>
                    <option value="admin_adjust">어드민 조정</option>
                  </select>
                </label>
                <label className="y-admin-member-credits-field">
                  <span className="y-admin-member-credits-field-label">주문번호 (선택)</span>
                  <input value={adjust.refId} onChange={(e) => adjust.onRefId(e.target.value)} placeholder="YN…" />
                </label>
                <label className="y-admin-member-credits-field full">
                  <span className="y-admin-member-credits-field-label">메모 (필수)</span>
                  <textarea
                    value={adjust.memo}
                    onChange={(e) => adjust.onMemo(e.target.value)}
                    rows={2}
                    placeholder="사유 입력"
                  />
                </label>
                <button
                  type="button"
                  className="y-admin-member-credits-submit"
                  disabled={adjust.busy}
                  onClick={adjust.onAdjust}
                >
                  크레딧 반영
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "usage" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 이용로그 · 총 {usage_log.length}건
          </p>
          <UsageLogTable rows={usage_log} />
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 결제로그 · 총 {payments.length}건 (최근 3년, 결제완료)
          </p>
          <PaymentLogTable rows={payments} />
        </div>
      ) : null}

      {tab === "reviews" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 후기 · 총 {reviews.length}건
          </p>
          <ReviewsTable rows={reviews} />
        </div>
      ) : null}

      {tab === "inquiries" ? (
        <div className="y-admin-cs-file-panel y-admin-cs-file-panel--full">
          <p className="y-admin-cs-file-subhead">
            {email}님의 문의 · 총 {inquiries.length}건
          </p>
          <InquiriesTable rows={inquiries} onRequestReply={inquiryResolve?.onRequestReply} />
        </div>
      ) : null}
    </div>
  );
}
