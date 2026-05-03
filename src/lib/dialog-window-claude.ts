/**
 * 채팅·음성 공통: 최근 N턴(질문·답변 단위)은 원문 유지,
 * 그보다 오래된 구간은 Claude Haiku로 요약해 system에 붙여 장기 상담 맥락 유지.
 */

export const RECENT_TURN_WINDOW = 20;

export type DialogTurnMsg = { role: "user" | "assistant"; content: string };

/** prior 구간을 user 기준 턴으로 묶는다(선행 orphan assistant 제거). */
export function groupPriorIntoTurns(prior: DialogTurnMsg[]): DialogTurnMsg[][] {
  const turns: DialogTurnMsg[][] = [];
  let i = 0;
  while (i < prior.length && prior[i].role === "assistant") i++;
  while (i < prior.length) {
    const m = prior[i];
    if (m.role !== "user") {
      i++;
      continue;
    }
    const chunk: DialogTurnMsg[] = [m];
    i++;
    if (i < prior.length && prior[i].role === "assistant") {
      chunk.push(prior[i]);
      i++;
    }
    turns.push(chunk);
  }
  return turns;
}

function defaultHaikuModel(): string {
  return String(process.env.CLAUDE_HAIKU_MODEL ?? "claude-3-5-haiku-20241022").trim() || "claude-3-5-haiku-20241022";
}

export async function summarizeOlderTurnsWithHaiku(olderDialogText: string, apiKey: string): Promise<string> {
  const trimmed = olderDialogText.trim();
  if (!trimmed) return "";
  const model = defaultHaikuModel();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.2,
      system:
        "연운(緣運) 상담의 **이전 구간** 대화입니다. 한국어로 개조식·짧은 문단으로 요약만 출력하세요. 사주·인연·감정·약속·미해결 질문·중요한 고유명사·날짜·사실 관계를 빠뜨리지 마세요. 새 인사나 질문을 덧붙이지 말고 압축만 하세요.",
      messages: [
        {
          role: "user",
          content: `아래는 최신 ${RECENT_TURN_WINDOW}턴 이전 대화입니다. 이후 이어질 상담을 위해 한 덩어리 요약으로 정리하세요.\n\n${trimmed.slice(0, 120_000)}`,
        },
      ],
    }),
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Haiku summary failed: ${res.status} ${raw.slice(0, 400)}`);
  const j = JSON.parse(raw || "{}") as { content?: Array<{ type?: string; text?: string }> };
  const parts = Array.isArray(j.content) ? j.content : [];
  return parts.map((p) => (p.type === "text" ? String(p.text || "") : "")).join("").trim();
}

export type RollingWindowResult = { systemAddendum: string; messages: DialogTurnMsg[] };

/**
 * @param linearMessages user|assistant만, 시간순, **마지막은 반드시 user(현재 입력)**.
 */
export async function buildRollingWindowAnthropicInput(opts: {
  apiKey: string;
  linearMessages: DialogTurnMsg[];
  recentTurnLimit?: number;
  /** 선형 메시지 상한(과대 페이로드 방지) */
  maxLinear?: number;
}): Promise<RollingWindowResult> {
  const lim = opts.recentTurnLimit ?? RECENT_TURN_WINDOW;
  const maxLinear = opts.maxLinear ?? 500;
  let list = opts.linearMessages.filter((m) => m && (m.role === "user" || m.role === "assistant"));
  if (list.length > maxLinear) list = list.slice(-maxLinear);
  if (list.length === 0) {
    return { systemAddendum: "", messages: [] };
  }
  const last = list[list.length - 1];
  if (last.role !== "user") {
    throw new Error("linearMessages must end with a user message");
  }
  const prior = list.slice(0, -1);
  const current = last;
  const turns = groupPriorIntoTurns(prior);
  if (turns.length <= lim) {
    return { systemAddendum: "", messages: list };
  }
  const oldTurns = turns.slice(0, turns.length - lim);
  const keepTurns = turns.slice(-lim);
  const olderText = oldTurns
    .flat()
    .map((m) => `${m.role === "user" ? "사용자" : "상담사"}: ${m.content}`)
    .join("\n\n");
  let summary = "";
  try {
    summary = await summarizeOlderTurnsWithHaiku(olderText, opts.apiKey);
  } catch {
    summary = olderText.length > 8000 ? `${olderText.slice(0, 8000)}\n…(요약 실패·원문 일부만)` : olderText;
  }
  const systemAddendum = summary ? `\n\n[이전 대화 요약 (${lim}턴 이전, Haiku 압축)]\n${summary}` : "";
  const recentFlat = keepTurns.flat();
  return { systemAddendum, messages: [...recentFlat, current] };
}
