/** 상품별 DB 연동 전 기본 질문 세트 (Claude 프롬프트 미포함) */
export type FortuneQuestionItem = {
  id: string;
  prompt: string;
  choices: readonly string[];
};

export const DEFAULT_FORTUNE_QUESTIONS: readonly FortuneQuestionItem[] = [
  {
    id: "fq1",
    prompt: "지금 가장 마음이 가는 영역은 무엇인가요?",
    choices: ["연애·관계", "일·커리어", "금전·재물", "건강·마음"],
  },
  {
    id: "fq2",
    prompt: "최근 스트레스를 가장 많이 받는 지점은 어디에 가깝나요?",
    choices: ["관계·소통", "불안정한 미래", "비교·평가", "체력·수면"],
  },
  {
    id: "fq3",
    prompt: "이번 풀이에서 가장 얻고 싶은 건 무엇인가요?",
    choices: ["현실적인 조언", "마음의 위로", "선택의 방향", "타이밍·시기"],
  },
];
