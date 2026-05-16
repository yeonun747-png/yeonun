"use client";

import { DEFAULT_FORTUNE_QUESTIONS, type FortuneQuestionItem } from "@/lib/fortune-ux/defaultQuestions";

const CHOICE_SLOTS = 4;

export function AdminProductFortuneQuestionsEditor({
  value,
  onChange,
}: {
  value: FortuneQuestionItem[];
  onChange: (next: FortuneQuestionItem[]) => void;
}) {
  const updateQuestion = (idx: number, patch: Partial<FortuneQuestionItem>) => {
    onChange(
      value.map((q, i) => {
        if (i !== idx) return q;
        const nextChoices = patch.choices !== undefined ? [...patch.choices] : [...q.choices];
        return { ...q, ...patch, choices: nextChoices };
      }),
    );
  };

  const setPrompt = (idx: number, prompt: string) => updateQuestion(idx, { prompt });
  const setId = (idx: number, id: string) => updateQuestion(idx, { id });

  const setChoice = (qIdx: number, cIdx: number, text: string) => {
    const q = value[qIdx];
    if (!q) return;
    const next = [...q.choices];
    next[cIdx] = text;
    while (next.length < CHOICE_SLOTS) next.push("");
    updateQuestion(qIdx, { choices: next.slice(0, CHOICE_SLOTS) });
  };

  const addQuestion = () => {
    onChange([
      ...value,
      { id: `fq_${Date.now()}`, prompt: "", choices: ["", "", "", ""] },
    ]);
  };

  const removeQuestion = (idx: number) => {
    if (value.length <= 1) return;
    onChange(value.filter((_, i) => i !== idx));
  };

  const resetToDefault = () => {
    onChange(DEFAULT_FORTUNE_QUESTIONS.map((q) => ({ id: q.id, prompt: q.prompt, choices: [...q.choices] })));
  };

  return (
    <div className="y-admin-fortune-menu-editor">
      <div className="y-admin-fortune-menu-head">
        <span className="y-admin-stack-legend">메뉴카드 질문 스텝</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="y-admin-ghost-btn" onClick={addQuestion}>
            + 질문 추가
          </button>
          <button type="button" className="y-admin-ghost-btn" onClick={resetToDefault}>
            기본 질문으로 되돌리기
          </button>
        </div>
      </div>
      <p className="y-admin-fortune-menu-hint">
        각 질문은 질문 문장과 보기 2개 이상(권장 4개)이면 점사 플로우에 반영됩니다. 저장 시 비어 있거나 유효한 질문이 없으면 DB에는 비우고, 사이트에서는 기본 질문 세트가 표시됩니다.
      </p>
      {value.map((question, qi) => (
        <div key={`${question.id}-${qi}`} className="y-admin-fortune-main-card">
          <div className="y-admin-fortune-main-head">
            <strong>질문 {qi + 1}</strong>
            <button type="button" className="y-admin-danger-soft" onClick={() => removeQuestion(qi)} disabled={value.length <= 1}>
              삭제
            </button>
          </div>
          <label className="y-admin-field-stack">
            <span className="y-admin-stack-legend">식별 id (선택)</span>
            <input value={question.id} onChange={(e) => setId(qi, e.target.value)} placeholder="fq1" />
          </label>
          <label className="y-admin-field-stack">
            <span className="y-admin-stack-legend">질문 문장</span>
            <textarea value={question.prompt} onChange={(e) => setPrompt(qi, e.target.value)} rows={2} placeholder="질문을 입력하세요" />
          </label>
          <div className="y-admin-field-stack">
            <span className="y-admin-stack-legend">보기 (①~④ 권장)</span>
            {Array.from({ length: CHOICE_SLOTS }, (_, ci) => (
              <input
                key={ci}
                value={String(question.choices[ci] ?? "")}
                onChange={(e) => setChoice(qi, ci, e.target.value)}
                placeholder={`보기 ${ci + 1}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
