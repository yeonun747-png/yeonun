"use client";

import { AdminFortuneMenuMediaField } from "@/components/admin/AdminFortuneMenuMediaField";
import { AdminFortuneMenuStackedMediaPreview } from "@/components/admin/AdminFortuneMenuStackedMediaPreview";
import {
  emptyFortuneMenu,
  newMainMenuRow,
  newSubMenuRow,
  type FortuneMainMenuRow,
  type FortuneMenuPayload,
} from "@/lib/product-fortune-menu";

export function ProductFortuneMenuEditor({
  value,
  onChange,
}: {
  value: FortuneMenuPayload;
  onChange: (next: FortuneMenuPayload) => void;
}) {
  const menus = value.main_menus?.length ? value.main_menus : emptyFortuneMenu().main_menus;

  const setMains = (main_menus: FortuneMainMenuRow[]) => onChange({ main_menus });

  const updateMain = (idx: number, patch: Partial<FortuneMainMenuRow>) => {
    const next = menus.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    setMains(next);
  };

  const updateSub = (mi: number, si: number, patch: Partial<FortuneMainMenuRow["sub_menus"][number]>) => {
    const next = menus.map((m, i) => {
      if (i !== mi) return m;
      const subs = (m.sub_menus ?? []).map((s, j) => (j === si ? { ...s, ...patch } : s));
      return { ...m, sub_menus: subs };
    });
    setMains(next);
  };

  const addMain = () => setMains([...menus, newMainMenuRow()]);
  const removeMain = (idx: number) => setMains(menus.filter((_, i) => i !== idx));

  const addSub = (mi: number) => {
    const m = menus[mi];
    if (!m) return;
    const subs = [...(m.sub_menus ?? []), newSubMenuRow()];
    updateMain(mi, { sub_menus: subs });
  };

  const removeSub = (mi: number, si: number) => {
    const m = menus[mi];
    if (!m) return;
    const subs = (m.sub_menus ?? []).filter((_, j) => j !== si);
    updateMain(mi, { sub_menus: subs });
  };

  return (
    <div className="y-admin-fortune-menu-editor">
      <div className="y-admin-fortune-menu-head">
        <span className="y-admin-stack-legend">점사 대메뉴 · 소메뉴</span>
        <button type="button" className="y-admin-ghost-btn" onClick={addMain}>
          + 대메뉴
        </button>
      </div>
      <p className="y-admin-fortune-menu-hint">
        소메뉴마다 제목·해석 프롬프트·이미지·동영상(mp4) 썸네일을 넣을 수 있습니다. 이미지/동영상 영역에 파일을 드래그 앤 드롭하면 Supabase 스토리지에 올라가고 URL이 채워집니다(같은 슬롯에 다시 올리면 기존 스토리지 파일은 삭제됩니다). 프론트 점사 목차는 소메뉴 기준입니다.
      </p>
      {menus.length === 0 ? (
        <p className="y-admin-muted">대메뉴를 추가하세요.</p>
      ) : (
        menus.map((main, mi) => (
          <div key={main.id} className="y-admin-fortune-main-card">
            <div className="y-admin-fortune-main-head">
              <strong>대메뉴 {mi + 1}</strong>
              <button type="button" className="y-admin-danger-soft" onClick={() => removeMain(mi)}>
                삭제
              </button>
            </div>
            <label className="y-admin-field-stack">
              <span className="y-admin-stack-legend">메뉴명</span>
              <input value={main.title} onChange={(e) => updateMain(mi, { title: e.target.value })} placeholder="예: 총운" />
            </label>
            <AdminFortuneMenuMediaField
              label="이미지 URL"
              kind="image"
              value={main.image_url}
              onChange={(url) => updateMain(mi, { image_url: url })}
            />
            <AdminFortuneMenuMediaField
              label="동영상 썸네일(mp4) URL"
              kind="video"
              value={main.video_thumb_url}
              onChange={(url) => updateMain(mi, { video_thumb_url: url })}
            />
            <AdminFortuneMenuStackedMediaPreview imageUrl={main.image_url} videoThumbUrl={main.video_thumb_url} />

            <div className="y-admin-fortune-subs-head">
              <span>소메뉴</span>
              <button type="button" className="y-admin-ghost-btn" onClick={() => addSub(mi)}>
                + 소메뉴
              </button>
            </div>
            {(main.sub_menus ?? []).length === 0 ? (
              <p className="y-admin-muted">소메뉴를 추가하면 점사 목차에 표시됩니다.</p>
            ) : (
              (main.sub_menus ?? []).map((sub, si) => (
                <div key={sub.id} className="y-admin-fortune-sub-card">
                  <div className="y-admin-fortune-sub-head">
                    <strong>소메뉴 {si + 1}</strong>
                    <button type="button" className="y-admin-danger-soft" onClick={() => removeSub(mi, si)}>
                      삭제
                    </button>
                  </div>
                  <label className="y-admin-field-stack">
                    <span className="y-admin-stack-legend">메뉴명</span>
                    <input value={sub.title} onChange={(e) => updateSub(mi, si, { title: e.target.value })} placeholder="예: 올해 인연 흐름" />
                  </label>
                  <label className="y-admin-field-stack">
                    <span className="y-admin-stack-legend">해석 프롬프트 (Claude)</span>
                    <textarea
                      value={sub.interpretation_prompt}
                      onChange={(e) => updateSub(mi, si, { interpretation_prompt: e.target.value })}
                      rows={4}
                      placeholder="이 소제목에서 다룰 관점·톤·금기 등"
                    />
                  </label>
                  <AdminFortuneMenuMediaField
                    label="이미지 URL"
                    kind="image"
                    value={sub.image_url}
                    onChange={(url) => updateSub(mi, si, { image_url: url })}
                  />
                  <AdminFortuneMenuMediaField
                    label="동영상 썸네일(mp4) URL"
                    kind="video"
                    value={sub.video_thumb_url}
                    onChange={(url) => updateSub(mi, si, { video_thumb_url: url })}
                  />
                  <AdminFortuneMenuStackedMediaPreview imageUrl={sub.image_url} videoThumbUrl={sub.video_thumb_url} />
                </div>
              ))
            )}
          </div>
        ))
      )}
    </div>
  );
}
