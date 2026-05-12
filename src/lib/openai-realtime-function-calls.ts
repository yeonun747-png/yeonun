/** `response.done` 페이로드에서 function_call 아이템만 추출 (Realtime WebRTC/WS 공통) */

export type RealtimeFunctionCallItem = {
  call_id: string;
  name: string;
  arguments: string;
};

export function extractRealtimeFunctionCallsFromResponseDone(ev: unknown): RealtimeFunctionCallItem[] {
  if (!ev || typeof ev !== "object") return [];
  const root = ev as Record<string, unknown>;
  const response = root.response;
  if (!response || typeof response !== "object") return [];
  const out = (response as Record<string, unknown>).output;
  if (!Array.isArray(out)) return [];
  const calls: RealtimeFunctionCallItem[] = [];
  for (const item of out) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "function_call") continue;
    const call_id = typeof o.call_id === "string" ? o.call_id.trim() : "";
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const args = typeof o.arguments === "string" ? o.arguments : "";
    if (call_id && name) calls.push({ call_id, name, arguments: args });
  }
  return calls;
}
