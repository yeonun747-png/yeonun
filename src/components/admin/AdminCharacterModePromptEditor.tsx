"use client";

import { useState } from "react";

import { VoiceCharacterPromptTtsFields, type TtsVoiceOption } from "@/components/admin/VoiceCharacterPromptTtsFields";

type Row = Record<string, unknown>;

function text(v: unknown, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function StatusPill({ children, tone = "base" }: { children: React.ReactNode; tone?: "base" | "good" | "warn" }) {
  return <span className={`y-admin-pill ${tone}`}>{children}</span>;
}

export function AdminCharacterModePromptEditor({
  character,
  mode,
  row,
  defaultTitle,
  ttsVoiceOptions,
}: {
  character: Row;
  mode: "voice" | "fortune_text" | "chat_text";
  row?: Row;
  defaultTitle: string;
  ttsVoiceOptions?: TtsVoiceOption[];
}) {
  const summary = mode === "voice" ? "음성 상담형" : mode === "fortune_text" ? "텍스트 점사형" : "텍스트 채팅형";
  const defaultVoiceId = row?.tts_voice_id != null ? text(row.tts_voice_id, "") : "";

  const [title, setTitle] = useState(() => text(row?.title, defaultTitle));
  const [prompt, setPrompt] = useState(() => text(row?.prompt, ""));
  const [isActive, setIsActive] = useState(() => String(row?.is_active ?? true));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("title", title.trim());
    fd.set("prompt", prompt);
    try {
      const res = await fetch("/admin/character-prompts", {
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
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>
            {text(character.name)} · {summary}
          </strong>
          <em>
            {text(character.key)} · updated {text(row?.updated_at, "-")}
          </em>
        </span>
        <StatusPill tone={row?.is_active === false ? "warn" : "good"}>{row?.is_active === false ? "비활성" : "활성"}</StatusPill>
      </summary>
      <form className="y-admin-form y-admin-edit-form" onSubmit={onSubmit}>
        <input type="hidden" name="character_key" value={text(character.key, "")} />
        <input type="hidden" name="mode" value={mode} />
        <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="프롬프트명" />
        <textarea name="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="캐릭터 프롬프트" />
        {mode === "voice" && ttsVoiceOptions ? (
          <div className="y-admin-voice-prompt-foot">
            <VoiceCharacterPromptTtsFields voices={ttsVoiceOptions} defaultVoiceId={defaultVoiceId} isActiveDefault={String(row?.is_active ?? true)} />
            <button type="submit" disabled={busy}>
              {busy ? "저장 중…" : "프롬프트 저장"}
            </button>
          </div>
        ) : (
          <>
            <select name="is_active" value={isActive} onChange={(e) => setIsActive(e.target.value)}>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            <button type="submit" disabled={busy}>
              {busy ? "저장 중…" : "프롬프트 저장"}
            </button>
          </>
        )}
        {msg ? <p className="y-admin-muted" style={{ margin: "8px 0 0", gridColumn: "1 / -1", fontSize: 12 }}>{msg}</p> : null}
      </form>
    </details>
  );
}
