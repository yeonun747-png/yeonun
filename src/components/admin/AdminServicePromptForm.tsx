"use client";

import { useState } from "react";

type Row = Record<string, unknown>;

function text(v: unknown, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

export function AdminServicePromptForm({
  promptKey,
  defaultTitle,
  row,
}: {
  promptKey: string;
  defaultTitle: string;
  row?: Row;
}) {
  const [title, setTitle] = useState(() => text(row?.title, defaultTitle));
  const [prompt, setPrompt] = useState(() => text(row?.prompt, ""));
  const [isActive, setIsActive] = useState(() => String(row?.is_active ?? true));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("key", promptKey);
    fd.set("title", title.trim());
    fd.set("prompt", prompt);
    fd.set("is_active", isActive === "true" ? "true" : "false");
    try {
      const res = await fetch("/admin/service-prompts", {
        method: "POST",
        body: fd,
        headers: { Accept: "application/json" },
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || j.ok !== true) throw new Error(j.error || "저장하지 못했습니다.");
      setMsg("저장했습니다.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="y-admin-form" onSubmit={onSubmit}>
      <input type="hidden" name="key" value={promptKey} />
      <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="프롬프트명" />
      <textarea name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="공통 시스템 프롬프트" />
      <select name="is_active" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
        <option value="true">활성</option>
        <option value="false">비활성</option>
      </select>
      <button type="submit" disabled={busy}>
        {busy ? "저장 중…" : "프롬프트 저장"}
      </button>
      {msg ? <p className="y-admin-muted" style={{ margin: "8px 0 0", fontSize: 12 }}>{msg}</p> : null}
    </form>
  );
}
