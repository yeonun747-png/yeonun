"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { AdminThumbnailSvgField } from "@/components/admin/AdminThumbnailSvgField";
import { ProductFortuneMenuEditor } from "@/components/admin/ProductFortuneMenuEditor";
import { parseFortuneMenuJson, type FortuneMenuPayload } from "@/lib/product-fortune-menu";

type Row = Record<string, unknown>;

function text(v: unknown, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function money(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}원` : "-";
}

function StatusPill({ children, tone = "base" }: { children: React.ReactNode; tone?: "base" | "good" | "warn" | "bad" | "rose" }) {
  return <span className={`y-admin-pill ${tone}`}>{children}</span>;
}

function ProductEditorSummary({ row }: { row: Row }) {
  const tagsArr = Array.isArray(row.tags) ? (row.tags as unknown[]).map((t) => String(t)) : [];
  const pc = row.payment_code != null && row.payment_code !== "" ? text(row.payment_code) : "—";
  return (
    <summary>
      <span>
        <strong>{text(row.title)}</strong>
        <em>
          결제코드 {pc} · {text(row.slug)} · {text(row.category_slug)} · {text(row.character_key)} ·{" "}
          {text(row.saju_input_profile, "single") === "pair" ? "궁합형" : "사주형"} · 홈섹션 {text(row.home_section_slug, "—")} · {text(row.badge)}
          {tagsArr.length ? ` · ${tagsArr.slice(0, 3).join(" ")}` : ""}
        </em>
      </span>
      <StatusPill tone="rose">{money(row.price_krw)}</StatusPill>
    </summary>
  );
}

function ProductEditorForm({
  row,
  categories,
  characters,
  previewVariant,
  displayPaymentCode,
  onPaymentAssigned,
}: {
  row: Row;
  categories: Row[];
  characters: Row[];
  previewVariant: string;
  displayPaymentCode: number | null;
  onPaymentAssigned?: (code: number) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const tagsArr = Array.isArray(row.tags) ? (row.tags as unknown[]).map((t) => String(t)) : [];
  const tagsStr = tagsArr.join(" ");
  const categorySlug = text(row.category_slug, "");
  const categoryIsAll = categorySlug === "all";

  const initialMenu = useMemo(() => parseFortuneMenuJson(row.fortune_menu), [row.fortune_menu]);
  const [fortuneMenu, setFortuneMenu] = useState<FortuneMenuPayload>(initialMenu);
  const [thumb, setThumb] = useState(text(row.thumbnail_svg, ""));
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [svgBusy, setSvgBusy] = useState(false);

  const runSave = useCallback(async () => {
    const form = formRef.current;
    if (!form) return;
    setSaveMsg(null);
    setSaveErr(null);
    const fd = new FormData(form);
    fd.set("fortune_menu_json", JSON.stringify(fortuneMenu));
    fd.set("thumbnail_svg", thumb);
    try {
      const res = await fetch("/admin/products", {
        method: "POST",
        headers: { Accept: "application/json", "X-Admin-Fetch": "1" },
        body: fd,
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; payment_code?: number };
      if (!res.ok || !j.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "저장 실패");
      }
      setSaveMsg("저장되었습니다.");
      if (typeof j.payment_code === "number") {
        onPaymentAssigned?.(j.payment_code);
      }
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "저장 실패");
    }
  }, [fortuneMenu, thumb, onPaymentAssigned]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSave();
  };

  const makeSvg = async () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const character_key = String(fd.get("character_key") ?? "").trim() || "yeon";
    const product_title = String(fd.get("title") ?? "").trim() || "상품";
    const product_quote = String(fd.get("quote") ?? "").trim();
    setSvgBusy(true);
    setSaveErr(null);
    try {
      const res = await fetch("/api/admin/product-thumbnail-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_key, product_title, product_quote }),
      });
      const j = (await res.json().catch(() => ({}))) as { svg?: string; error?: string; details?: string };
      if (!res.ok || !j.svg) {
        throw new Error(j.error || j.details || "SVG 생성 실패");
      }
      setThumb(j.svg);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "SVG 생성 실패");
    } finally {
      setSvgBusy(false);
    }
  };

  return (
    <form ref={formRef} className="y-admin-form y-admin-edit-form" onSubmit={onSubmit}>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">결제코드 (PG 구분 · 자동 부여 · 수정 불가)</span>
        <input
          value={displayPaymentCode != null && Number.isFinite(displayPaymentCode) ? String(displayPaymentCode) : "(저장 시 자동 부여)"}
          readOnly
          className="y-admin-readonly"
        />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">slug</span>
        <input name="slug" defaultValue={text(row.slug, "")} />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">상품명</span>
        <input name="title" defaultValue={text(row.title, "")} />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">설명 / 카피</span>
        <textarea name="quote" defaultValue={text(row.quote, "")} />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">가격 (원)</span>
        <input name="price_krw" defaultValue={text(row.price_krw, "")} inputMode="numeric" />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">카테고리</span>
        <select name="category_slug" defaultValue={categorySlug}>
          {categoryIsAll ? (
            <option value="all">전체 (all) — 풀이 탭만, 실제 분류로 바꾸는 것을 권장</option>
          ) : null}
          {categories.map((c) => (
            <option key={text(c.slug)} value={text(c.slug)}>
              {text(c.label)} ({text(c.slug)})
            </option>
          ))}
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">캐릭터</span>
        <select name="character_key" defaultValue={text(row.character_key, "")}>
          {characters.map((c) => (
            <option key={text(c.key)} value={text(c.key)}>
              {text(c.name)} ({text(c.key)})
            </option>
          ))}
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">뱃지</span>
        <input name="badge" defaultValue={text(row.badge, "")} placeholder="없으면 비움" />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">홈 섹션</span>
        <select name="home_section_slug" defaultValue={text(row.home_section_slug, "")}>
          <option value="">(없음 · 풀이 탭만)</option>
          <option value="weekly_love">weekly_love — 이번주 인연</option>
          <option value="lifetime">lifetime — 평생을 풀어드립니다</option>
          <option value="season_2026">season_2026 — 2026 신년 특별</option>
          <option value="deep_dive">deep_dive — 깊이 있는 풀이</option>
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">태그</span>
        <input name="tags" defaultValue={tagsStr} placeholder="공백·쉼표 · # 생략 가능" />
      </label>
      <fieldset className="y-admin-field-stack y-admin-saju-profile-fieldset" style={{ border: "none", padding: 0, margin: 0 }}>
        <span className="y-admin-stack-legend">명식 입력</span>
        <label className="y-admin-radio-option">
          <input type="radio" name="saju_input_profile" value="single" defaultChecked={text(row.saju_input_profile, "single") !== "pair"} />
          <span>사주형 — 본인만</span>
        </label>
        <label className="y-admin-radio-option">
          <input type="radio" name="saju_input_profile" value="pair" defaultChecked={text(row.saju_input_profile, "single") === "pair"} />
          <span>궁합형 — 상대·추가 명식</span>
        </label>
      </fieldset>

      <ProductFortuneMenuEditor value={fortuneMenu} onChange={setFortuneMenu} />

      <div className="y-admin-thumbnail-gen-row">
        <AdminThumbnailSvgField
          name="thumbnail_svg"
          defaultValue={text(row.thumbnail_svg, "")}
          value={thumb}
          onValueChange={setThumb}
          rows={10}
          previewVariant={previewVariant}
          toolbarEnd={
            <button type="button" className="y-admin-ghost-btn" disabled={svgBusy} onClick={() => void makeSvg()}>
              {svgBusy ? "SVG 만드는 중…" : "SVG 만들기 (Claude)"}
            </button>
          }
        />
      </div>

      {saveMsg ? <p className="y-admin-save-ok">{saveMsg}</p> : null}
      {saveErr ? <p className="y-admin-save-err">{saveErr}</p> : null}

      <div className="y-admin-edit-actions">
        <button type="submit">수정 저장</button>
        <button form={`delete-product-${text(row.slug)}`} type="submit" className="y-admin-danger">
          삭제
        </button>
      </div>
    </form>
  );
}

export function ProductEditorBlock({
  row,
  categories,
  characters,
  previewVariant,
}: {
  row: Row;
  categories: Row[];
  characters: Row[];
  previewVariant: string;
}) {
  const initialPc =
    row.payment_code != null && row.payment_code !== ""
      ? Number(row.payment_code)
      : Number.isFinite(Number(row.payment_code))
        ? Number(row.payment_code)
        : null;
  const [paymentOverride, setPaymentOverride] = useState<number | null>(null);
  const effectivePc = paymentOverride ?? initialPc;
  const summaryRow = { ...row, payment_code: effectivePc };

  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <ProductEditorSummary row={summaryRow} />
      <ProductEditorForm
        row={row}
        categories={categories}
        characters={characters}
        previewVariant={previewVariant}
        displayPaymentCode={effectivePc}
        onPaymentAssigned={(code) => setPaymentOverride(code)}
      />
      <form id={`delete-product-${text(row.slug)}`} action="/admin/products/delete" method="post">
        <input type="hidden" name="slug" value={text(row.slug, "")} />
      </form>
    </details>
  );
}
