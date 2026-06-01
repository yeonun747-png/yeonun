"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useYeonunAuth } from "@/components/auth/YeonunAuthProvider";
import { YeonunSheetPortal } from "@/components/YeonunSheetPortal";
import { formatPhoneKrInput } from "@/lib/format-phone-kr";
import { supabaseBrowser } from "@/lib/supabase/client";

type Props = {
  onDismiss: () => void;
};

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

export function MyInquiryModal({ onDismiss }: Props) {
  const { user } = useYeonunAuth();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(() => defaultNameFromUser(user));
  const [email, setEmail] = useState(() => user?.email?.trim() ?? "");
  const [phone, setPhone] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const sb = supabaseBrowser();
      const tok = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (tok) headers.Authorization = `Bearer ${tok}`;

      const res = await fetch("/api/my/inquiries", {
        method: "POST",
        headers,
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
      try {
        window.dispatchEvent(new CustomEvent("yeonun:toast", { detail: { message: "문의가 접수되었습니다" } }));
      } catch {
        /* ignore */
      }
      onDismiss();
    } finally {
      setSubmitting(false);
    }
  }, [body, email, name, onDismiss, phone, submitting]);

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
          <div className="y-modal-scroll y-my-inquiry-scroll">
            <div className="y-my-inquiry-top-gap" aria-hidden="true" />
            <p className="y-my-inquiry-lead">필수 항목을 입력해 주세요. 평일 1영업일 이내 답변드립니다.</p>
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
                  disabled={submitting}
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
          </div>
        </div>
      </div>
    </YeonunSheetPortal>
  );
}
