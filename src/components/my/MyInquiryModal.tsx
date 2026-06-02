"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { formatPhoneKrInput } from "@/lib/format-phone-kr";
import { getStoredGuestInquiryEmail, setStoredGuestInquiryEmail } from "@/lib/guest-inquiry-session";
import { YEONUN_MY_INQUIRIES_CHANGED, notifyMyInquiriesChanged } from "@/lib/my-inquiry-events";
import { fmtInquiryDateTime, inquiryBodyPreview } from "@/lib/user-inquiry-format";
import { isInquiryReplyUnread, type MyInquiryListItem } from "@/lib/user-inquiries-types";

type Props = {
  onDismiss: () => void;
};

type Tab = "history" | "new";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INQUIRY_LEAD = "필수 항목을 입력해 주세요. 평일 1영업일 이내 답변드립니다.";

function authHeadersFromToken(accessToken: string | null | undefined): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function defaultNameFromUser(user: ReturnType<typeof useYeonunAuth>["user"]): string {
  if (!user) return "";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta =
    (typeof meta?.name === "string" && meta.name.trim()) ||
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    "";
  if (fromMeta) return fromMeta;
  return user.email?.split("@")[0] ?? "";
}

function statusLabel(row: MyInquiryListItem): string {
  if (row.status === "pending") return "접수됨";
  if (String(row.admin_reply ?? "").trim()) return "답변 완료";
  return "처리 완료";
}

function resolveGuestEmail(formEmail: string): string {
  const fromForm = formEmail.trim().toLowerCase();
  if (fromForm && EMAIL_RE.test(fromForm)) return fromForm;
  const stored = getStoredGuestInquiryEmail();
  if (stored && EMAIL_RE.test(stored)) return stored;
  return "";
}

function InquiryThreadDetail({
  row,
  onBack,
  onRead,
}: {
  row: MyInquiryListItem;
  onBack: () => void;
  onRead: (row: MyInquiryListItem) => void;
}) {
  const markedRef = useRef(false);

  useEffect(() => {
    if (markedRef.current) return;
    if (!isInquiryReplyUnread(row)) return;
    markedRef.current = true;
    onRead(row);
  }, [onRead, row]);

  const hasReply = row.status === "resolved" && String(row.admin_reply ?? "").trim();

  return (
    <div className="y-my-inquiry-detail">
      <button type="button" className="y-my-inquiry-back" onClick={onBack}>
        ← 목록
      </button>
      <div className="y-my-inquiry-thread">
        <article className="y-my-inquiry-bubble y-my-inquiry-bubble--user">
          <header className="y-my-inquiry-bubble-head">
            <span className="y-my-inquiry-bubble-who">내 문의</span>
            <time dateTime={row.created_at}>{fmtInquiryDateTime(row.created_at)}</time>
          </header>
          <p className="y-my-inquiry-bubble-body">{row.body}</p>
        </article>
        {row.status === "pending" ? (
          <p className="y-my-inquiry-waiting">운영팀 확인 중입니다. 평일 1영업일 이내 답변드립니다.</p>
        ) : null}
        {hasReply ? (
          <article className="y-my-inquiry-bubble y-my-inquiry-bubble--admin">
            <header className="y-my-inquiry-bubble-head">
              <span className="y-my-inquiry-bubble-who">연운 운영팀</span>
              <time dateTime={row.resolved_at ?? undefined}>{fmtInquiryDateTime(row.resolved_at)}</time>
            </header>
            <p className="y-my-inquiry-bubble-body">{row.admin_reply}</p>
          </article>
        ) : row.status === "resolved" ? (
          <p className="y-my-inquiry-waiting">처리는 완료되었습니다. 답변 본문이 곧 표시됩니다.</p>
        ) : null}
      </div>
    </div>
  );
}

export function MyInquiryModal({ onDismiss }: Props) {
  const { user, session } = useYeonunAuth();
  const accessToken = session?.access_token ?? null;
  const nameRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [history, setHistory] = useState<MyInquiryListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(() => defaultNameFromUser(user));
  const [email, setEmail] = useState(() => user?.email?.trim() ?? getStoredGuestInquiryEmail() ?? "");
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email?.trim()) return;
    const next = email.trim().toLowerCase();
    if (next && EMAIL_RE.test(next)) setStoredGuestInquiryEmail(next);
  }, [email, user?.email]);

  const loadHistory = useCallback(async () => {
    if (user && !accessToken) {
      setHistory([]);
      setHistoryError("로그인 정보를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (user && accessToken) {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const res = await fetch("/api/my/inquiries/history", {
          headers: authHeadersFromToken(accessToken),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && Array.isArray(data.inquiries)) {
          setHistory(data.inquiries as MyInquiryListItem[]);
          return;
        }
        setHistory([]);
        setHistoryError(typeof data?.error === "string" ? data.error : "문의 내역을 불러오지 못했습니다.");
      } catch {
        setHistory([]);
        setHistoryError("문의 내역을 불러오지 못했습니다.");
      } finally {
        setHistoryLoading(false);
      }
      return;
    }

    const guestEmail = resolveGuestEmail(email);
    if (!guestEmail) {
      setHistory([]);
      setHistoryError(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/my/inquiries/guest-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: guestEmail }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && Array.isArray(data.inquiries)) {
        setHistory(data.inquiries as MyInquiryListItem[]);
        return;
      }
      setHistory([]);
      setHistoryError(typeof data?.error === "string" ? data.error : "문의 내역을 불러오지 못했습니다.");
    } catch {
      setHistory([]);
      setHistoryError("문의 내역을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken, email, user]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (tab === "history") {
      void loadHistory();
    }
  }, [loadHistory, tab]);

  useEffect(() => {
    const onChanged = () => void loadHistory();
    window.addEventListener(YEONUN_MY_INQUIRIES_CHANGED, onChanged);
    return () => window.removeEventListener(YEONUN_MY_INQUIRIES_CHANGED, onChanged);
  }, [loadHistory]);

  useEffect(() => {
    if (tab === "new") {
      nameRef.current?.focus();
    }
  }, [tab]);

  const markRead = useCallback(
    async (row: MyInquiryListItem) => {
      try {
        if (user && accessToken) {
          const res = await fetch("/api/my/inquiries/history", {
            method: "POST",
            headers: authHeadersFromToken(accessToken),
            body: JSON.stringify({ id: row.id }),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok && data.inquiry) {
            const next = data.inquiry as MyInquiryListItem;
            setHistory((prev) => prev.map((r) => (r.id === next.id ? next : r)));
            notifyMyInquiriesChanged();
          }
          return;
        }

        const guestEmail = resolveGuestEmail(email);
        if (!guestEmail) return;

        const res = await fetch("/api/my/inquiries/guest-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: guestEmail, id: row.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok && data.inquiry) {
          const next = data.inquiry as MyInquiryListItem;
          setHistory((prev) => prev.map((r) => (r.id === next.id ? next : r)));
          notifyMyInquiriesChanged();
        }
      } catch {
        /* ignore */
      }
    },
    [accessToken, email, user],
  );

  const submit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/my/inquiries", {
        method: "POST",
        headers: authHeadersFromToken(accessToken),
        body: JSON.stringify({ name, email, phone, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError("잠시 후 다시 시도해 주세요.");
        return;
      }
      if (!res.ok || !data?.ok) {
        setError(typeof data?.error === "string" ? data.error : "문의 접수에 실패했습니다.");
        return;
      }
      setBody("");
      setPhone("");
      if (!user) setStoredGuestInquiryEmail(email);
      try {
        window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "문의가 접수되었습니다" } }));
      } catch {
        /* ignore */
      }
      notifyMyInquiriesChanged();
      await loadHistory();
      setTab("history");
      setSelectedId(null);
    } finally {
      setSubmitting(false);
    }
  }, [accessToken, body, email, loadHistory, name, phone, submitting, user]);

  const selected = history.find((r) => r.id === selectedId) ?? null;
  const unreadInList = history.filter(isInquiryReplyUnread).length;

  return (
    <YeonunSheetPortal>
      <div
        className="y-modal open y-my-inquiry-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="y-my-inquiry-title"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !submitting) onDismiss();
        }}
      >
        <div className="y-modal-sheet y-my-inquiry-sheet" onMouseDown={(e) => e.stopPropagation()}>
          <div className="y-modal-handle" />
          <div className="y-modal-head">
            <span className="y-my-inquiry-head-spacer" aria-hidden="true" />
            <div className="y-modal-title" id="y-my-inquiry-title">
              문의하기
            </div>
            <button type="button" className="y-modal-close" onClick={onDismiss} aria-label="닫기" disabled={submitting}>
              ×
            </button>
          </div>

          <div className="y-my-inquiry-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "history"}
              className={tab === "history" ? "active" : ""}
              onClick={() => {
                setTab("history");
                setSelectedId(null);
              }}
            >
              내 문의
              {unreadInList > 0 ? <span className="y-my-inquiry-tab-badge">{unreadInList}</span> : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "new"}
              className={tab === "new" ? "active" : ""}
              onClick={() => setTab("new")}
            >
              새 문의
            </button>
          </div>

          <div className="y-modal-scroll y-my-inquiry-scroll">
            {tab === "history" ? (
              selected ? (
                <InquiryThreadDetail row={selected} onBack={() => setSelectedId(null)} onRead={markRead} />
              ) : (
                <div className="y-my-inquiry-history">
                  {historyLoading && history.length === 0 ? (
                    <p className="y-my-inquiry-empty">불러오는 중…</p>
                  ) : historyError ? (
                    <p className="y-my-inquiry-error" role="alert">
                      {historyError}
                      <button type="button" className="y-my-inquiry-retry" onClick={() => void loadHistory()}>
                        다시 시도
                      </button>
                    </p>
                  ) : history.length === 0 ? (
                    <p className="y-my-inquiry-empty">접수한 문의가 없습니다. 새 문의 탭에서 작성해 주세요.</p>
                  ) : (
                    <ul className="y-my-inquiry-list">
                      {history.map((row) => {
                        const unread = isInquiryReplyUnread(row);
                        return (
                          <li key={row.id}>
                            <button type="button" className="y-my-inquiry-card" onClick={() => setSelectedId(row.id)}>
                              <div className="y-my-inquiry-card-top">
                                <span className={`y-my-inquiry-status ${row.status}`}>{statusLabel(row)}</span>
                                {unread ? <span className="y-my-inquiry-unread-dot" aria-label="새 답변" /> : null}
                                <time dateTime={row.created_at}>{fmtInquiryDateTime(row.created_at)}</time>
                              </div>
                              <p className="y-my-inquiry-card-preview">{inquiryBodyPreview(row.body, 72)}</p>
                              {row.status === "resolved" && row.admin_reply ? (
                                <p className="y-my-inquiry-card-reply-preview">
                                  <span>답변</span> {inquiryBodyPreview(row.admin_reply, 48)}
                                </p>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )
            ) : (
              <>
                <div className="y-my-inquiry-top-gap" aria-hidden="true" />
                <p className="y-my-inquiry-lead">{INQUIRY_LEAD}</p>
                <form
                  className="y-my-inquiry-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <label className="y-my-inquiry-field">
                    <span className="y-my-inquiry-label">
                      이름 <em aria-hidden="true">*</em>
                    </span>
                    <input
                      ref={nameRef}
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="이름"
                      required
                      maxLength={40}
                      disabled={submitting}
                    />
                  </label>
                  <label className="y-my-inquiry-field">
                    <span className="y-my-inquiry-label">
                      이메일 <em aria-hidden="true">*</em>
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@email.com"
                      required
                      maxLength={120}
                      disabled={submitting || Boolean(user?.email?.trim())}
                    />
                  </label>
                  <label className="y-my-inquiry-field">
                    <span className="y-my-inquiry-label">전화번호</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneKrInput(e.target.value))}
                      placeholder="010-0000-0000 (선택)"
                      maxLength={20}
                      disabled={submitting}
                    />
                  </label>
                  <label className="y-my-inquiry-field">
                    <span className="y-my-inquiry-label">
                      문의 내용 <em aria-hidden="true">*</em>
                    </span>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="문의 내용을 입력해 주세요"
                      required
                      minLength={5}
                      maxLength={2000}
                      rows={5}
                      disabled={submitting}
                    />
                  </label>
                  {error ? (
                    <p className="y-my-inquiry-error" role="alert">
                      {error}
                    </p>
                  ) : null}
                  <button type="submit" className="y-my-inquiry-submit" disabled={submitting}>
                    {submitting ? "접수 중…" : "문의 접수"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
