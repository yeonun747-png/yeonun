"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  FORTUNE_MENU_LLM_OPTIONS,
  normalizeFortuneMenuLlmModelId,
  type FortuneMenuLlmModelId,
} from "@/lib/fortune-menu-llm-model";

export function AdminFortuneMenuLlmCard({ currentModelId }: { currentModelId: string }) {
  const router = useRouter();
  const normalizedServer = normalizeFortuneMenuLlmModelId(currentModelId, "claude-sonnet-4-6");
  const [selected, setSelected] = useState<FortuneMenuLlmModelId>(normalizedServer);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingModel, setPendingModel] = useState<FortuneMenuLlmModelId | null>(null);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    setSelected(normalizeFortuneMenuLlmModelId(currentModelId, "claude-sonnet-4-6"));
  }, [currentModelId]);

  const openConfirm = () => {
    setBanner(null);
    if (selected === normalizedServer) {
      setBanner("이미 적용 중인 모델입니다.");
      return;
    }
    setPendingModel(selected);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPendingModel(null);
  };

  const confirmSave = useCallback(async () => {
    if (!pendingModel) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/admin/fortune-menu-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ model: pendingModel }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setBanner(
          j.error === "invalid_model" ? "지원하지 않는 모델입니다." : j.error ? `저장 실패: ${j.error}` : "저장에 실패했습니다.",
        );
        return;
      }
      closeConfirm();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [pendingModel, router]);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {FORTUNE_MENU_LLM_OPTIONS.map((o) => (
          <label key={o.id} className="y-admin-radio-option">
            <input type="radio" name="fortune_menu_llm" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} />
            <span style={{ minWidth: 0 }}>
              <span style={{ color: "var(--y-ink)" }}>{o.label}</span>
              <span className="y-admin-muted" style={{ marginLeft: 6, fontSize: "inherit" }}>
                {o.id}
              </span>
            </span>
          </label>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <button
            type="button"
            onClick={openConfirm}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "none",
              background: "var(--y-rose, #dd5878)",
              color: "#fff",
              font: "inherit",
              fontSize: "12.5px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            저장
          </button>
        </div>
        {banner ? (
          <p className="y-admin-muted" style={{ margin: 0, color: "#b45309", fontWeight: 600 }}>
            {banner}
          </p>
        ) : null}
      </div>

      {confirmOpen && pendingModel ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fortune-llm-confirm-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            background: "rgba(26,24,21,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) closeConfirm();
          }}
        >
          <div
            style={{
              maxWidth: 400,
              width: "100%",
              background: "#fff",
              borderRadius: 14,
              padding: "20px 22px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h4 id="fortune-llm-confirm-title" style={{ margin: "0 0 10px", fontSize: "13.5px", fontWeight: 800, color: "var(--y-ink)" }}>
              점사 LLM 변경 확인
            </h4>
            <p style={{ margin: "0 0 8px", fontSize: "12.5px", lineHeight: 1.55, color: "var(--y-mute)" }}>
              메뉴 점사 스트림(Cloudways)에 사용할 모델을 아래 값으로 바꿉니다. 계속할까요?
            </p>
            <p style={{ margin: "0 0 16px", fontSize: "12.5px", fontWeight: 700, color: "var(--y-ink)" }}>
              {FORTUNE_MENU_LLM_OPTIONS.find((o) => o.id === pendingModel)?.label ?? pendingModel}
              <span style={{ fontWeight: 500, color: "var(--y-mute)", marginLeft: 6 }}>({pendingModel})</span>
            </p>
            {pendingModel === "gemini-2.5-pro" ? (
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#8c2a40", lineHeight: 1.5 }}>
                Gemini 사용 시 Cloudways에{" "}
                <span style={{ fontWeight: 700 }}>GEMINI_API_KEY</span> 또는 <span style={{ fontWeight: 700 }}>GOOGLE_AI_API_KEY</span>가 설정되어 있어야 합니다.
              </p>
            ) : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={saving}
                onClick={closeConfirm}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--y-line, #e8e6e1)",
                  background: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  font: "inherit",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "var(--y-ink)",
                }}
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmSave()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "none",
                  background: "var(--y-rose, #dd5878)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: saving ? "wait" : "pointer",
                  font: "inherit",
                  fontSize: "12.5px",
                }}
              >
                {saving ? "저장 중…" : "확인 후 변경"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
