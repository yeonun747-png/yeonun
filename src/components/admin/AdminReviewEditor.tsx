"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ProductOption = { slug: string; title: string };

type ReviewRow = {
  id: string;
  product_slug: string;
  user_mask: string;
  stars: number | string;
  body: string;
  tags: string[] | string;
  created_at?: string;
  source_type?: string;
  source_id?: string;
  user_ref?: string;
  is_showcase?: boolean;
  is_published?: boolean;
};

function text(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function StatusPill({ children, tone = "base" }: { children: React.ReactNode; tone?: "base" | "good" | "warn" }) {
  return <span className={`y-admin-pill ${tone}`}>{children}</span>;
}

export function AdminReviewEditor({ row, products }: { row: ReviewRow; products: ProductOption[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isShowcase = row.is_showcase === true;
  const isUserReview = Boolean(row.user_ref) && !isShowcase;
  const published = row.is_published === true;
  const tags = Array.isArray(row.tags) ? row.tags : text(row.tags).split(/[,\s]+/).filter(Boolean);
  const createdLabel = row.created_at
    ? new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "";
  const formId = `edit-review-${text(row.id)}`;

  const postForm = async (action: string, form: HTMLFormElement) => {
    const fd = new FormData(form);
    fd.set("ajax", "1");
    const res = await fetch(action, { method: "POST", body: fd });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? "저장에 실패했습니다.");
    }
  };

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await postForm("/admin/reviews", e.currentTarget);
      setMessage("저장됐습니다.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!window.confirm("이 리뷰를 삭제할까요?")) return;
    setDeleting(true);
    setMessage(null);
    try {
      await postForm("/admin/reviews/delete", e.currentTarget);
      setMessage("삭제됐습니다.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <details className="y-admin-editor y-admin-review-editor" suppressHydrationWarning>
      <summary className="y-admin-review-summary">
        <div className="y-admin-review-head">
          <div className="y-admin-review-avatar">{text(row.user_mask).slice(0, 1)}</div>
          <div className="y-admin-review-meta">
            <strong>{text(row.user_mask)}</strong>
            <span>
              {text(row.product_slug)}
              {isUserReview ? ` · ${text(row.source_type)}/${text(row.source_id)}` : ""}
              {createdLabel ? ` · ${createdLabel}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill tone={published ? "good" : "warn"}>{published ? "노출" : "비노출"}</StatusPill>
            <StatusPill tone="warn">★ {text(row.stars)}</StatusPill>
          </div>
        </div>
        <textarea
          form={formId}
          name="body"
          defaultValue={text(row.body)}
          className="y-admin-review-body"
          rows={4}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
        <div className="y-admin-review-tags">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </summary>
      <form id={formId} onSubmit={onSave} className="y-admin-form y-admin-edit-form">
        <input type="hidden" name="id" defaultValue={text(row.id)} />
        <input type="hidden" name="is_showcase" value={isShowcase ? "true" : "false"} />
        <select name="product_slug" defaultValue={text(row.product_slug)}>
          {products.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title} ({p.slug})
            </option>
          ))}
        </select>
        <input name="user_mask" defaultValue={text(row.user_mask)} />
        <input name="stars" defaultValue={text(row.stars, "5")} inputMode="numeric" />
        <input name="tags" defaultValue={tags.join(" ")} />
        <fieldset className="y-admin-radio-inline">
          <legend>프론트 노출</legend>
          <label className="y-admin-radio-option">
            <input type="radio" name="is_published" value="true" defaultChecked={published} />
            노출
          </label>
          <label className="y-admin-radio-option">
            <input type="radio" name="is_published" value="false" defaultChecked={!published} />
            비노출
          </label>
        </fieldset>
        {message ? <p className="y-admin-form-msg">{message}</p> : null}
        <div className="y-admin-edit-actions">
          <button type="submit" disabled={saving || deleting}>
            {saving ? "저장 중…" : "수정 저장"}
          </button>
          <button
            type="submit"
            form={`delete-review-${text(row.id)}`}
            className="y-admin-danger"
            disabled={saving || deleting}
          >
            {deleting ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </form>
      <form id={`delete-review-${text(row.id)}`} onSubmit={onDelete} className="y-admin-review-delete-form">
        <input type="hidden" name="id" value={text(row.id)} />
      </form>
    </details>
  );
}
