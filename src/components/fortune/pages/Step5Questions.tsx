"use client";

import { useState } from "react";

import type { FortuneQuestionItem } from "@/lib/fortune-ux/defaultQuestions";

export function Step5Questions({
  characterName,
  questions,
  onAnswer,
  onDone,
}: {
  characterName: string;
  questions: readonly FortuneQuestionItem[];
  onAnswer: (id: string, answer: string) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const q = questions[index]!;

  const choose = (choice: string) => {
    if (selected) return;
    setSelected(choice);
    onAnswer(q.id, choice);
    window.setTimeout(() => {
      if (index >= questions.length - 1) {
        onDone();
        return;
      }
      setIndex((v) => v + 1);
      setSelected(null);
    }, 1600);
  };

  return (
    <section className="y-fortune-v2-page">
      <div className="y-fortune-v2-question-card">
        <div className="y-fortune-v2-question-label">• {characterName}님이 여쭤봐요</div>
        <h1>{q.prompt}</h1>
        <p>
          질문 {index + 1} / {questions.length}
        </p>
      </div>
      <div className="y-fortune-v2-answer-list">
        {q.choices.map((choice) => (
          <button
            key={choice}
            type="button"
            disabled={Boolean(selected)}
            className={selected === choice ? "active" : ""}
            onClick={() => choose(choice)}
          >
            {choice}
          </button>
        ))}
      </div>
    </section>
  );
}
