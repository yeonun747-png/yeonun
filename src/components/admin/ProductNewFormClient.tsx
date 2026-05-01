"use client";

import { useCallback, useRef, useState } from "react";

import { AdminThumbnailSvgField } from "@/components/admin/AdminThumbnailSvgField";
import { ProductFortuneMenuEditor } from "@/components/admin/ProductFortuneMenuEditor";
import { emptyFortuneMenu, type FortuneMenuPayload } from "@/lib/product-fortune-menu";

type Row = Record<string, unknown>;

function text(v: unknown, fallback = "") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

export function ProductNewFormClient({
  categories,
  characters,
  previewVariant = "yeon",
}: {
  categories: Row[];
  characters: Row[];
  previewVariant?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fortuneMenu, setFortuneMenu] = useState<FortuneMenuPayload>(emptyFortuneMenu());
  const [thumb, setThumb] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [svgBusy, setSvgBusy] = useState(false);
  const [assignedPc, setAssignedPc] = useState<number | null>(null);

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
      if (typeof j.payment_code === "number") setAssignedPc(j.payment_code);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "저장 실패");
    }
  }, [fortuneMenu, thumb]);

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
    <form ref={formRef} className="y-admin-form" onSubmit={onSubmit}>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">결제코드 (저장 시 자동 부여)</span>
        <input value={assignedPc != null ? String(assignedPc) : "(저장 후 표시)"} readOnly className="y-admin-readonly" />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">slug</span>
        <input name="slug" placeholder="예: reunion-maybe" required />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">상품명</span>
        <input name="title" placeholder="표시 제목" required />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">설명 / 카피</span>
        <textarea name="quote" placeholder="카드 설명" required />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">가격 (원)</span>
        <input name="price_krw" inputMode="numeric" placeholder="9900" required />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">카테고리</span>
        <select name="category_slug" required defaultValue={categories[0] ? text(categories[0].slug) : ""}>
          {categories.map((c) => (
            <option key={text(c.slug)} value={text(c.slug)}>
              {text(c.label)} ({text(c.slug)})
            </option>
          ))}
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">캐릭터</span>
        <select name="character_key" required defaultValue={characters[0] ? text(characters[0].key) : "yeon"}>
          {characters.map((c) => (
            <option key={text(c.key)} value={text(c.key)}>
              {text(c.name)} ({text(c.key)})
            </option>
          ))}
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">뱃지</span>
        <input name="badge" placeholder="없으면 비움" />
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">홈 섹션</span>
        <select name="home_section_slug" defaultValue="">
          <option value="">(없음 · 풀이 탭만)</option>
          <option value="weekly_love">weekly_love — 이번주 인연</option>
          <option value="lifetime">lifetime — 평생을 풀어드립니다</option>
          <option value="season_2026">season_2026 — 2026 신년 특별</option>
          <option value="deep_dive">deep_dive — 깊이 있는 풀이</option>
        </select>
      </label>
      <label className="y-admin-field-stack">
        <span className="y-admin-stack-legend">태그</span>
        <input name="tags" placeholder="#재회 #인연 (공백·쉼표 구분)" />
      </label>
      <fieldset className="y-admin-field-stack y-admin-saju-profile-fieldset" style={{ border: "none", padding: 0, margin: 0 }}>
        <span className="y-admin-stack-legend">명식 입력</span>
        <label className="y-admin-radio-option">
          <input type="radio" name="saju_input_profile" value="single" defaultChecked />
          <span>사주형 — 본인 생년월일(시)만 필요</span>
        </label>
        <label className="y-admin-radio-option">
          <input type="radio" name="saju_input_profile" value="pair" />
          <span>궁합형 — 상대·자녀 등 두 번째 생시 필요</span>
        </label>
      </fieldset>

      <ProductFortuneMenuEditor value={fortuneMenu} onChange={setFortuneMenu} />

      <div className="y-admin-thumbnail-gen-row">
        <AdminThumbnailSvgField
          name="thumbnail_svg"
          value={thumb}
          onValueChange={setThumb}
          rows={6}
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

      <button type="submit">상품 저장</button>
    </form>
  );
}
