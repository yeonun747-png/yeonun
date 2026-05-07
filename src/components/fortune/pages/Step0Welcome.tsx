"use client";

import type { FortuneBirthPayload } from "@/lib/fortune-ux/sajuStorage";

export function Step0Welcome({
  stored,
  onUseStored,
  onNew,
}: {
  stored: FortuneBirthPayload | null;
  onUseStored: () => void;
  onNew: () => void;
}) {
  if (!stored) return null;
  const birth = `${stored.year}년 ${stored.month}월 ${stored.day}일`;
  const time = stored.hour ? `${stored.hour.padStart(2, "0")}:${(stored.minute || "00").padStart(2, "0")}` : "인시";
  return (
    <section className="y-fortune-v2-page y-fortune-v2-welcome">
      <div className="y-fortune-v2-mascot-spacer" />
      <h1 className="y-fortune-v2-hello">안녕하세요!</h1>
      <p className="y-fortune-v2-lead">이전에 저장된 사주 정보가 있어요. 이 정보로 풀이를 시작할까요?</p>
      <div className="y-fortune-v2-saved-card">
        <div className="y-fortune-v2-saved-icon">📋</div>
        <div>
          <strong>{stored.name?.trim() || "회원"}</strong>
          <p>
            {birth} {time} · {stored.calendarType === "lunar" ? "음력" : stored.calendarType === "lunar-leap" ? "음력(윤달)" : "양력"}
          </p>
        </div>
      </div>
      <button className="y-fortune-v2-primary" type="button" onClick={onUseStored}>
        이 정보로 볼게요 →
      </button>
      <button className="y-fortune-v2-outline" type="button" onClick={onNew}>
        새로 입력할게요
      </button>
    </section>
  );
}
