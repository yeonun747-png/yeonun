"use client";

import type { Character } from "@/lib/data/characters";
import type { Product } from "@/lib/data/content";

export function Step2CharIntro({
  product,
  character,
  episode,
  onNextEpisode,
}: {
  product: Product;
  character: Character | null;
  episode: number;
  onNextEpisode: () => void;
}) {
  const name = character?.name?.trim() || product.character_key;
  const tags = (product.tags?.length ? product.tags : ["재회", "궁합", "인연", "연애운"]).slice(0, 5);
  const talks = [
    `${name}선생님은 흐름을 읽는 감각이 섬세한 분이에요.`,
    "놓친 마음과 아직 남아 있는 연결고리를 차분히 짚어줍니다.",
    "이제 명식 카드로 오늘 풀이의 바탕을 먼저 확인해볼게요.",
  ];
  return (
    <section className="y-fortune-v2-page y-fortune-v2-char-page">
      <div className="y-fortune-v2-char-card">
        <h1>{name}</h1>
        <p className="y-fortune-v2-char-spec">{character?.spec || "인연 · 연애 · 재회 전문 분석가"}</p>
        <div className="y-fortune-v2-tags">
          {tags.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="y-fortune-v2-char-talk">{talks[episode]}</div>
      </div>
      <div className="y-fortune-v2-dots" aria-label="이야기 진행">
        {talks.map((_, i) => (
          <span key={i} className={i === episode ? "active" : ""} />
        ))}
      </div>
      <button className="y-fortune-v2-primary" type="button" onClick={onNextEpisode}>
        {episode >= talks.length - 1 ? "명식 카드 보기 →" : "다음 이야기"}
      </button>
      <button className="y-fortune-v2-link" type="button" onClick={onNextEpisode}>
        명식 카드 보기
      </button>
    </section>
  );
}
