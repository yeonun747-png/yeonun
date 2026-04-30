"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { SajuInputProfile } from "@/lib/data/content";

type Props = {
  slug: string;
  title: string;
  priceKrw: number;
  characterKey: string;
  sajuInputProfile: SajuInputProfile;
  themeKey: string;
  sheet?: string;
  /** 모달 복귀용 원본 back 쿼리 (서버에서 그대로 넘김) */
  backRaw?: string;
};

export function ContentPurchaseFooter({ slug, title, priceKrw, characterKey, sajuInputProfile, themeKey, sheet, backRaw }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const isPair = sajuInputProfile === "pair";

  const paymentHref = useMemo(() => {
    const q = new URLSearchParams();
    if (sheet === "1") q.set("sheet", "1");
    q.set("modal", "payment");
    q.set("product", slug);
    q.set("title", title);
    q.set("price", String(priceKrw));
    q.set("character_key", characterKey);
    q.set("profile", sajuInputProfile);
    q.set("ck", themeKey);
    const back = backRaw ?? sp.get("back") ?? undefined;
    if (back) q.set("back", back);
    const qs = q.toString();
    return `${pathname}?${qs}`;
  }, [sheet, slug, title, priceKrw, characterKey, sajuInputProfile, themeKey, backRaw, pathname, sp]);

  return (
    <>
      {isPair ? (
        <section className="y-cd-partner y-cd-partner--hint" aria-labelledby="y-cd-partner-h">
          <div className="y-cd-section">
            <h2 className="y-cd-section-title" id="y-cd-partner-h">
              궁합형 풀이 <span className="y-cd-partner-badge">안내</span>
            </h2>
          </div>
          <p className="y-cd-partner-lead">
            결제가 완료되면 <strong>상대방 정보 입력</strong> 화면이 열립니다. 생년월일·시간·성별 등 아시는 만큼 입력해 주세요. 건너뛰기도 가능합니다.
          </p>
        </section>
      ) : null}

      <div style={{ height: 18 }} />

      <div className="y-cd-foot" aria-label="구매">
        <div className="y-cd-price-block">
          <div className="y-cd-price-orig">정가 {Math.round(priceKrw * 1.3).toLocaleString("ko-KR")}원</div>
          <div className="y-cd-price-now">
            {priceKrw.toLocaleString("ko-KR")}
            <span className="small">원</span>
          </div>
        </div>
        <button type="button" className="y-cd-buy-btn" onClick={() => router.push(paymentHref, { scroll: false })}>
          결제하기
        </button>
      </div>
    </>
  );
}
