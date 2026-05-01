"use client";

import { useCallback, useRef, useState } from "react";

type Kind = "image" | "video";

export function AdminFortuneMenuMediaField({
  label,
  value,
  onChange,
  kind,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  kind: Kind;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = kind === "image" ? "image/jpeg,image/png,image/webp,image/gif" : "video/mp4";

  const uploadFile = useCallback(
    async (file: File) => {
      setErr(null);
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        const prev = value.trim();
        if (prev) fd.append("previous_url", prev);

        const res = await fetch("/api/admin/fortune-menu-asset", { method: "POST", body: fd });
        const j = (await res.json().catch(() => ({}))) as {
          publicUrl?: string;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !j.publicUrl) {
          throw new Error(j.detail || j.error || "업로드 실패");
        }
        onChange(j.publicUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "업로드 실패");
      } finally {
        setUploading(false);
        setDragOver(false);
      }
    },
    [kind, onChange, value],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (!f) return;
      void uploadFile(f);
    },
    [uploadFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void uploadFile(f);
    },
    [uploadFile],
  );

  const hint =
    kind === "image"
      ? "JPEG · PNG · WebP · GIF — 드래그 앤 드롭 또는 클릭"
      : "MP4만 — 드래그 앤 드롭 또는 클릭 (교체 시 스토리지 기존 파일 삭제)";

  return (
    <div className="y-admin-fortune-media-field">
      <span className="y-admin-stack-legend">{label}</span>
      <div
        className={`y-admin-fortune-dropzone${dragOver ? " y-admin-fortune-dropzone--over" : ""}${uploading ? " y-admin-fortune-dropzone--busy" : ""}`}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!uploading) inputRef.current?.click();
          }
        }}
        aria-label={`${label} 파일 업로드`}
      >
        <input ref={inputRef} type="file" accept={accept} className="y-admin-fortune-file-input" onChange={onPick} />
        {uploading ? <span>업로드 중…</span> : <span>{hint}</span>}
      </div>
      <label className="y-admin-field-stack y-admin-fortune-url-row">
        <span className="y-admin-stack-legend y-admin-muted">URL (직접 붙여넣기·수정)</span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="업로드 후 자동 입력 또는 외부 URL" />
      </label>
      {err ? <p className="y-admin-save-err">{err}</p> : null}
    </div>
  );
}
