type AvatarKey = "yeon" | "byeol" | "yeo" | "un";

import Link from "next/link";

const AVATAR: Record<AvatarKey, { han: string; className: string }> = {
  yeon: { han: "蓮", className: "yeon" },
  byeol: { han: "星", className: "byeol" },
  yeo: { han: "麗", className: "yeo" },
  un: { han: "雲", className: "un" },
};

export function HomeHero() {
  return (
    <section className="yVoiceHero" aria-label="음성 LIVE 상담">
      <div className="yVoiceContent">
        <div className="yVoiceLabel">
          <span className="pulse" aria-hidden="true" />
          LIVE · 지금 상담 가능
        </div>

        <h1 className="yVoiceTitle">
          한 번의 부름이면,
          <br />
          운명이 답합니다
        </h1>
        <p className="yVoiceSub">
          구독 없이 분 단위로. 처음 3분은 무료, 그 다음은 필요한 만큼만.
        </p>

        <div className="yVoiceAvatars" aria-label="인연 안내자 4명">
          {(Object.keys(AVATAR) as AvatarKey[]).map((k) => (
            <span key={k} className={`yAvatarMini ${AVATAR[k].className}`}>
              {AVATAR[k].han}
            </span>
          ))}
          <span className="yVoiceMeta">4명 모두 상담 가능</span>
        </div>

        <Link className="yVoiceCta" href="/meet">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
          지금 상담하기 · 3분 무료
        </Link>
        <div className="yVoiceCtaSub">카드 등록 없이 지금 바로</div>
      </div>
    </section>
  );
}

