import type { Character } from "@/lib/data/characters";

export function CharacterDetailShell({ c }: { c: Character }) {
  return (
    <>
      <section className={`y-chd-hero ${c.key}`} aria-label="인연 안내자">
        <div className="y-chd-status-pulse">
          <span className="pulse" aria-hidden="true" />
          지금 상담 가능
        </div>
        <div className="y-chd-han" aria-hidden="true">
          {c.han}
        </div>
        <div className="y-chd-name-block">
          <span className="y-chd-spec">{c.spec}</span>
          <h1 className="y-chd-name">{c.name}</h1>
          <div className="y-chd-name-en">
            {c.en} · {c.han}
          </div>
        </div>
      </section>

      <section className="y-chd-quote-section" aria-label="시그니처 한 마디">
        <div className="y-chd-quote-mark">&quot;</div>
        <p className="y-chd-quote">{c.greeting}</p>
        <div className="y-chd-quote-by">— {c.name}의 첫 마디</div>
      </section>
    </>
  );
}
