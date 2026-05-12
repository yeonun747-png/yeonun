/**
 * OpenAI Realtime(gpt-realtime-2) 음성 상담용 — 인사이트 추출·재방문·컨텍스트 절약 지침.
 * `client-secret` instructions에 합성됩니다.
 */

export const VOICE_REALTIME_INSIGHT_TOOL_DEFINITION = {
  type: "function" as const,
  name: "save_user_insight",
  description:
    "사용자가 음성으로 말한 내용 중, 이후 상담에 꼭 기억해둘 가치가 있는 사실만 기록합니다. " +
    "매 턴 호출하지 말고, 분명한 사실·감정·인물·사건·수치가 나왔을 때만 호출합니다. " +
    "추측·상담사의 해석은 저장하지 않습니다.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: {
        type: "string",
        enum: ["event", "person", "emotion", "numeric", "relationship", "goal", "other"],
        description: "정보 유형",
      },
      detail: {
        type: "string",
        description: "한국어로 한두 문장 이내 요약. 이름·날짜·금액 등 구체 표현 유지.",
      },
      importance_level: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "5가 가장 중요(재방문 시 꼭 언급 후보). 낮은 숫자는 사소한 부가 정보.",
      },
    },
    required: ["category", "detail", "importance_level"],
  },
};

/** DB에 과거 인사이트가 있을 때만 붙이는 재방문 톤 지침 */
export const VOICE_REALTIME_RETENTION_BLOCK = `
[재방문·기억 톤]
- 지난 상담에서 사용자가 실제로 말했던 내용(위 [User_History_Context])만 근거로, 짧게 안부를 묻습니다.
- 예: "지난번에 ○○ 때문에 마음이 무거우셨는데, 그때 이후로는 좀 어떠셨어요?" / "○○님 이야기 잠깐 해 주셨었죠. 그때 이후 변화가 있었을까요?"
- 형식은 고정 문장이 아니라, 각 캐릭터 말투·존댓말·호흡으로 자연스럽게 바꿉니다.
- 사무적 나열·보고서 톤 금지. 일주일 전을 떠올리며 다시 묻는 친구 같은 온도를 유지합니다.
- 컨텍스트에 없는 사실은 만들지 않습니다. 한 번에 한 가지 주제만 짚고, 나머지는 대화가 이어지면 천천히 묻습니다.
`.trim();

/** 매 세션 공통: 추출·비용·프루닝 원칙 */
export const VOICE_REALTIME_OPTIMIZATION_BLOCK = `
[컨텍스트·비용(Pruning 원칙)]
- [User_History_Context]는 입장 직후 인사와 첫 질문에만 적극 사용하고, 이후에는 최근 음성 대화 흐름을 최우선으로 따릅니다.
- 과거 메모를 길게 인용하거나 반복해 읽지 않습니다.
- save_user_insight는 하루치 상담에서도 수회 이하가 되도록, 정말 남길 가치가 있을 때만 호출합니다.
`.trim();
