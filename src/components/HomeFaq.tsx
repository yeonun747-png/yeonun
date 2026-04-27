"use client";

import { useMemo, useState } from "react";

type Item = { q: string; a: React.ReactNode };

export function HomeFaq() {
  const items: Item[] = useMemo(
    () => [
      {
        q: "4명의 인연 안내자는 어떻게 다른가요?",
        a: (
          <>
            <strong>연화</strong>는 재회·연애·궁합, <strong>별하</strong>는 자미두수·신년운세,{" "}
            <strong>여연</strong>은 정통 사주·평생운, <strong>운서</strong>는 작명·택일·꿈해몽을 담당합니다.
            같은 사주를 봐도 4명이 보는 결이 달라요. 어떤 고민인지에 따라 가장 잘 맞는 안내자를 선택하시면
            됩니다. 처음이라면 3분 무료 체험으로 4명 모두 만나보고 결정하세요.
          </>
        ),
      },
      {
        q: "실시간 음성 상담은 진짜 사람처럼 들리나요?",
        a: (
          <>
            네, 응답 지연이 0.3초 이내라 자연스러운 대화가 가능합니다. 4명 모두 각자의 음성·억양·말투를
            가지고 있어 캐릭터마다 분명히 구분됩니다. 일부 분들은 &quot;사람이라고 착각했다&quot;는 후기를
            남기기도 합니다.
          </>
        ),
      },
      {
        q: "정통 사주만큼 정확한가요?",
        a: (
          <>
            연운의 만세력은 <strong>진태양시 보정 + 출생 경도 반영</strong>까지 적용한 정통 명리학 엔진입니다.
            합·충·형·파·해, 12운성, 12신살, 용신, 대운까지 모두 계산합니다. 풀이 또한 정파 명리학 자료를
            학습한 결과로, 강남 청담의 30~50만원대 풀이와 같은 깊이를 24시간 음성으로 받아볼 수 있습니다.
          </>
        ),
      },
      {
        q: "개인정보와 상담 내용은 안전한가요?",
        a: (
          <>
            모든 사주 데이터는 암호화 저장되며, 음성 상담 내용은 사용자 동의 없이 영구 저장되지 않습니다.
            회원의 대화 히스토리는 본인만 열람 가능하며, 언제든 삭제 요청이 가능합니다.
          </>
        ),
      },
      {
        q: "결제는 어떻게 진행되나요?",
        a: (
          <>
            연운은 <strong>구독 없이 건당 결제</strong>로 운영됩니다. 음성 상담은 분 단위 크레딧 충전 후
            사용하시고, 텍스트 풀이는 콘텐츠별로 결제합니다. 처음 가입 시 3분 무료 상담이 한 번 제공됩니다.
            결제 수단은 <strong>신용·체크카드, 휴대폰 결제, 코인 결제(Fortune82)</strong> 3가지로 진행하실 수
            있습니다.
          </>
        ),
      },
    ],
    [],
  );

  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="y-faq-block" id="faq" aria-label="자주 묻는 질문">
      <div className="y-faq-head">
        <div className="y-pricing-eyebrow">FAQ · 자주 묻는 질문</div>
        <h2 className="y-pricing-title">
          궁금한 점이
          <br />
          있으신가요?
        </h2>
      </div>

      <div className="y-faq-list">
        {items.map((it, idx) => {
          const open = idx === openIdx;
          return (
            <div key={it.q} className="y-faq-item">
              <button
                className="y-faq-q"
                type="button"
                onClick={() => setOpenIdx(open ? -1 : idx)}
                aria-expanded={open}
              >
                <span className="y-faq-q-text">{it.q}</span>
                <span className="y-faq-toggle">{open ? "−" : "+"}</span>
              </button>
              <div className="y-faq-a" style={{ display: open ? "block" : "none" }}>
                {it.a}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

