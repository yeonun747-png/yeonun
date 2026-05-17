"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function AdminReviewCreateForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    fd.set("ajax", "1");
    try {
      const res = await fetch("/admin/reviews", { method: "POST", body: fd });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "저장에 실패했습니다.");
      e.currentTarget.reset();
      setMessage("리뷰가 등록됐습니다.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="y-admin-form compact">
      <input name="product_slug" placeholder="product slug" required />
      <input name="user_mask" placeholder="사용자 표시명" required />
      <input name="stars" inputMode="numeric" placeholder="별점 1-5" defaultValue="5" required />
      <textarea name="body" placeholder="리뷰 내용" required />
      <input name="tags" placeholder="#재회 #인연" />
      <input type="hidden" name="is_showcase" value="true" />
      <input type="hidden" name="is_published" value="true" />
      {message ? <p className="y-admin-form-msg">{message}</p> : null}
      <button type="submit" disabled={saving}>
        {saving ? "저장 중…" : "리뷰 저장"}
      </button>
    </form>
  );
}
