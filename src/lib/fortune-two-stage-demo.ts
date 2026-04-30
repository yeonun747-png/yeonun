/** 데모 스트림용 목차·본문 (실서비스에서는 LLM 1·2단계로 대체) */

export type DemoProfile = "single" | "pair";

export function demoTocSections(profile: DemoProfile): { id: string; title: string }[] {
  if (profile === "pair") {
    return [
      { id: "s1", title: "두 사람의 인연 자리" },
      { id: "s2", title: "그 사람의 현재 마음" },
      { id: "s3", title: "재회 가능 시기" },
      { id: "s4", title: "행동 가이드" },
      { id: "s5", title: "마무리 한 마디" },
    ];
  }
  return [
    { id: "s1", title: "명식의 핵심과 강약" },
    { id: "s2", title: "올해·이달의 운기" },
    { id: "s3", title: "재물과 인연의 자리" },
    { id: "s4", title: "조심할 때와 나아갈 때" },
    { id: "s5", title: "정리와 방향" },
  ];
}

export function demoSectionHtml(profile: DemoProfile, sectionIndex: number): string {
  const p = profile === "pair";
  const blocks: string[][] = p
    ? [
        [
          "<h2>두 사람의 인연 자리</h2>",
          '<p>지금은 <span class="keyword">각자의 운기에 갇혀 있는 시기</span>로 읽히며, 연주·일주의 기운이 곧바로 맞물리지는 않습니다. 다만 <span class="keyword">갑목(甲木)</span>과 <span class="keyword">임수(壬水)</span>의 흐름이 겨울 이후 다시 교차할 여지는 있습니다.</p>',
          '<p><span class="keyword">먼저 연락할 가능성은 낮습니다</span>. 상대 일주의 <span class="keyword">편재</span> 자리가 강해 말보다 행동으로 마음을 표현하는 타입으로 읽힙니다.</p>',
        ],
        [
          "<h2>그 사람의 현재 마음</h2>",
          "<p>세운 기준으로 보면 <em>겉으로는 담담</em>해 보이나 속주에는 미련이 남아 있는 구조입니다.</p>",
          "<p>연락을 기다리기보다는 먼저 손 내밀면 부담으로 느낄 수 있는 달입니다.</p>",
        ],
        [
          "<h2>재회 가능 시기</h2>",
          '<p><span class="keyword">음(陰)이 채워지는 계절</span> 이후, 다음 대운 초입에 인연이 다시 스치는 자리가 보입니다.</p>',
          '<p>구체적으로는 <span class="keyword">늦가을에서 초겨울 사이</span>에 신호가 강해질 수 있습니다.</p>',
        ],
        [
          "<h2>행동 가이드</h2>",
          "<p>지금은 <strong>한 박자 기다림</strong>, 한 달 뒤에는 가벼운 안부만, 설 전에는 판단을 미루는 것이 좋습니다.</p>",
        ],
        [
          "<h2>마무리 한 마디</h2>",
          "<p>인연은 붙잡는 힘만큼 <em>놓아주는 호흡</em>도 필요합니다. 당신의 일주가 가진 온기는 충분히 빛납니다.</p>",
        ],
      ]
    : [
        [
          "<h2>명식의 핵심과 강약</h2>",
          "<p>일간을 중심으로 볼 때 <strong>신강에 가깝고</strong> 뿌리가 월령에 붙어 있어 스스로의 판단으로 방향을 잡는 편입니다.</p>",
        ],
        [
          "<h2>올해·이달의 운기</h2>",
          '<p>세운의 천간이 일간과 <span class="keyword">상생</span> 관계에 있어 상반기보다 하반기에 기회의 문이 넓어집니다.</p>',
        ],
        [
          "<h2>재물과 인연의 자리</h2>",
          "<p>재성 자리에 별이 모이는 시기에는 <em>현금 흐름</em>보다 계약·약속이 먼저입니다.</p>",
        ],
        [
          "<h2>조심할 때와 나아갈 때</h2>",
          "<p>충이 강한 달에는 큰 결정을 미루고, 합이 들어오는 주에는 사람을 통해 정보가 들어옵니다.</p>",
        ],
        [
          "<h2>정리와 방향</h2>",
          "<p>지금은 <strong>내면을 다지는 시기</strong>로 삼고, 다음 계절에 움직임을 넓히면 흐름이 따라옵니다.</p>",
        ],
      ];

  const idx = Math.min(Math.max(sectionIndex, 0), blocks.length - 1);
  return blocks[idx]!.join("");
}

export function countHangulChars(html: string): number {
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text.length;
}
