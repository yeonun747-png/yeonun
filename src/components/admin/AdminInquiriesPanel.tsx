"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { AdminInquiryReplyModal } from "@/components/admin/AdminInquiryReplyModal";
import { AdminInquiryQueueTable } from "@/components/admin/AdminInquiryQueueTable";
import { AdminMemberFileModal } from "@/components/admin/AdminMemberFileModal";
import { YEONUN_ADMIN_INQUIRIES_CHANGED } from "@/lib/admin-inquiry-events";
import { readAdminPanelHashParams } from "@/lib/admin-panel-nav";
import { fmtInquiryDateTime } from "@/lib/user-inquiry-format";
import { isInquiryReplyUnread, type UserInquiryRow } from "@/lib/user-inquiries-types";

type Tab = "pending" | "resolved";
type MemberFilter = "all" | "member" | "guest";

type ListPayload = {
  rows: UserInquiryRow[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
};

const PAGE_SIZE = 30;

function InquiryDetailDrawer({
  row,
  onClose,
  onOpenMember,
  onRequestReply,
}: {
  row: UserInquiryRow;
  onClose: () => void;
  onOpenMember?: (userId: string) => void;
  onRequestReply?: (row: UserInquiryRow) => void;
}) {
  const hasReply = row.status === "resolved" && String(row.admin_reply ?? "").trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="y-admin-inq-modal y-admin-inq-modal--detail" role="dialog" aria-modal="true" aria-labelledby="admin-inq-detail-title">
      <button type="button" className="y-admin-inq-modal-backdrop" aria-label="닫기" onClick={onClose} />
      <div className="y-admin-inq-modal-dialog y-admin-inq-modal-dialog--wide">
        <header className="y-admin-inq-modal-head">
          <div>
            <h3 id="admin-inq-detail-title">문의 상세</h3>
            <p className="y-admin-inq-detail-sub">
              {row.name} · {row.email}
              {row.phone ? ` · ${row.phone}` : ""}
            </p>
          </div>
          <button type="button" className="y-admin-inq-modal-close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="y-admin-inq-modal-body y-admin-inq-modal-body--scroll">
          <div className="y-admin-inq-detail-actions">
            {row.user_id && onOpenMember ? (
              <button type="button" className="y-admin-inq-link" onClick={() => onOpenMember(row.user_id!)}>
                회원 CS 열기
              </button>
            ) : (
              <span className="y-admin-inq-guest">게스트 문의</span>
            )}
          </div>
          <div className="y-admin-inq-thread">
            <article className="y-admin-inq-bubble y-admin-inq-bubble--user">
              <header className="y-admin-inq-bubble-head">
                <span>문의자</span>
                <time dateTime={row.created_at}>{fmtInquiryDateTime(row.created_at)}</time>
              </header>
              <p>{row.body}</p>
            </article>
            {row.status === "pending" ? (
              <p className="y-admin-inq-waiting">미처리 — 답변 작성 후 프론트 문의내역에 표시됩니다.</p>
            ) : null}
            {hasReply ? (
              <article className="y-admin-inq-bubble y-admin-inq-bubble--admin">
                <header className="y-admin-inq-bubble-head">
                  <span>연운 운영팀</span>
                  <time dateTime={row.resolved_at ?? undefined}>{fmtInquiryDateTime(row.resolved_at)}</time>
                </header>
                <p>{row.admin_reply}</p>
              </article>
            ) : null}
          </div>
          {row.status === "resolved" ? (
            <dl className="y-admin-inq-detail-meta">
              <div>
                <dt>처리자</dt>
                <dd>{row.resolved_by || "admin"}</dd>
              </div>
              <div>
                <dt>회원 확인</dt>
                <dd>
                  {isInquiryReplyUnread(row)
                    ? "미확인"
                    : row.reply_read_at
                      ? `확인함 (${fmtInquiryDateTime(row.reply_read_at)})`
                      : "답변 없음"}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
        <footer className="y-admin-inq-modal-foot">
          <button type="button" className="y-admin-inq-modal-ghost" onClick={onClose}>
            닫기
          </button>
          {row.status === "pending" && onRequestReply ? (
            <button type="button" className="y-admin-inq-modal-primary" onClick={() => onRequestReply(row)}>
              답변 작성
            </button>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export function AdminInquiriesPanel() {
  const [highlight, setHighlight] = useState(false);
  const [tab, setTab] = useState<Tab>("pending");
  const [member, setMember] = useState<MemberFilter>("all");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<UserInquiryRow | null>(null);
  const [replyTarget, setReplyTarget] = useState<UserInquiryRow | null>(null);
  const [csUserId, setCsUserId] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (!payload) return 1;
    return Math.max(1, Math.ceil(payload.total / payload.pageSize));
  }, [payload]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        tab,
        page: String(page),
        pageSize: String(PAGE_SIZE),
        member,
      });
      if (q) sp.set("q", q);
      const res = await fetch(`/api/admin/inquiries?${sp}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "조회 실패");
      setPayload({
        rows: (data.rows ?? []) as UserInquiryRow[],
        total: Number(data.total ?? 0),
        page: Number(data.page ?? page),
        pageSize: Number(data.pageSize ?? PAGE_SIZE),
        pendingCount: Number(data.pendingCount ?? 0),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 오류");
    } finally {
      setLoading(false);
    }
  }, [member, page, q, tab]);

  useEffect(() => {
    const params = readAdminPanelHashParams();
    const initialTab = params.get("tab");
    if (initialTab === "resolved" || initialTab === "pending") setTab(initialTab);
    if (params.get("highlight") === "1") {
      setHighlight(true);
      const t = window.setTimeout(() => setHighlight(false), 1600);
      return () => window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onChange = () => void reload();
    window.addEventListener(YEONUN_ADMIN_INQUIRIES_CHANGED, onChange);
    return () => window.removeEventListener(YEONUN_ADMIN_INQUIRIES_CHANGED, onChange);
  }, [reload]);

  const openMember = useCallback((userId: string) => {
    setDetailRow(null);
    setReplyTarget(null);
    setCsUserId(userId);
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQ(searchInput.trim());
  };

  return (
    <section className={`y-admin-section y-admin-inq-panel${highlight ? " y-admin-inq-panel--highlight" : ""}`}>
      <div className="y-admin-inq-panel-head">
        <div>
          <span className="y-admin-eyebrow">CUSTOMER SUPPORT</span>
          <h2>고객 문의</h2>
          <p className="y-admin-inq-panel-desc">프론트 문의내역에 전달되는 답변을 조회·처리합니다.</p>
        </div>
        <button type="button" className="y-admin-inq-refresh-btn" disabled={loading} onClick={() => void reload()}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      <div className="y-admin-inq-toolbar">
        <div className="y-admin-inq-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={tab === "pending" ? "on" : ""}
            onClick={() => {
              setTab("pending");
              setPage(1);
            }}
          >
            미처리
            {payload && payload.pendingCount > 0 ? <span className="y-admin-nav-badge">{payload.pendingCount}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "resolved"}
            className={tab === "resolved" ? "on" : ""}
            onClick={() => {
              setTab("resolved");
              setPage(1);
            }}
          >
            답변 히스토리
          </button>
        </div>
        <form className="y-admin-inq-search" onSubmit={onSearch}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="이름·이메일·전화·문의 내용"
          />
          <select value={member} onChange={(e) => { setMember(e.target.value as MemberFilter); setPage(1); }}>
            <option value="all">전체</option>
            <option value="member">회원</option>
            <option value="guest">게스트</option>
          </select>
          <button type="submit">검색</button>
        </form>
      </div>

      {error ? (
        <p className="y-admin-inq-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !payload ? (
        <p className="y-admin-inq-empty">불러오는 중…</p>
      ) : (
        <>
          <AdminInquiryQueueTable
            rows={payload?.rows ?? []}
            mode={tab}
            onOpenMember={openMember}
            onRequestReply={(row) => setReplyTarget(row)}
            onRowClick={(row) => setDetailRow(row)}
          />
          {payload && payload.total > 0 ? (
            <div className="y-admin-inq-pager">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                이전
              </button>
              <span>
                {page} / {totalPages} · 총 {payload.total.toLocaleString("ko-KR")}건
              </span>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                다음
              </button>
            </div>
          ) : null}
        </>
      )}

      {detailRow ? (
        <InquiryDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onOpenMember={openMember}
          onRequestReply={(row) => {
            setDetailRow(null);
            setReplyTarget(row);
          }}
        />
      ) : null}

      <AdminInquiryReplyModal
        row={replyTarget}
        onClose={() => setReplyTarget(null)}
        onResolved={() => {
          setReplyTarget(null);
          void reload();
        }}
      />

      <AdminMemberFileModal userId={csUserId} initialTab="inquiries" onClose={() => setCsUserId(null)} enableCreditAdjust />
    </section>
  );
}
