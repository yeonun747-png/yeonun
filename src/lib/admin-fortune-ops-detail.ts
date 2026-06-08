type Payload = Record<string, unknown>;

type PrefetchSnapshot = {
  v?: number;
  complete?: boolean;
  toc?: unknown[];
  doneIdx?: unknown[];
  claudeStreamMode?: boolean;
  claudeStreamHtml?: string;
  updatedAt?: number;
};

function text(v: unknown, fallback = ""): string {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function readPayload(raw: unknown): Payload {
  if (!raw || typeof raw !== "object") return {};
  return raw as Payload;
}

function readSnapshot(payload: Payload): PrefetchSnapshot | null {
  const snap = payload.prefetch_snapshot;
  if (!snap || typeof snap !== "object") return null;
  return snap as PrefetchSnapshot;
}

/** DB·로그에 저장된 영문/기술 코드 → 운영자용 한국어 */
function humanizePrefetchError(raw: string): string {
  const code = raw.trim();
  if (!code) return "";

  const known: Record<string, string> = {
    missing_upstream:
      "점사 요청에 AI 서버(Cloudways) 연결 정보가 없습니다. prefetch 시작 시 본문이 제대로 저장됐는지 확인해 주세요.",
    upstream_failed:
      "AI 점사 서버(Cloudways)에서 풀이를 받아오지 못했습니다. Cloudways 서버 상태·API 키·프록시 설정을 확인해 주세요.",
    prefetch_job_failed:
      "서버에서 점사 미리 생성(prefetch) 작업 중 예기치 않은 오류가 발생했습니다. Vercel/서버 로그를 확인해 주세요.",
  };
  if (known[code]) return known[code];

  if (code.includes("readStoredSaju") && code.includes("client")) {
    return "서버가 브라우저 전용 사주 저장소를 읽으려다 실패했습니다. (수정 반영 후 재시도 필요)";
  }
  if (code.startsWith("Claude HTTP") || code.includes("Claude HTTP")) {
    return `AI 모델(Claude) 호출 실패 · ${code}`;
  }
  if (code.startsWith("Gemini HTTP") || code.includes("Gemini HTTP")) {
    return `AI 모델(Gemini) 호출 실패 · ${code}`;
  }

  return code;
}

function streamingProgressDetail(payload: Payload): string {
  const snap = readSnapshot(payload);
  if (!snap || snap.v !== 1) {
    if (payload.cloudways_upstream) {
      return "서버가 AI 점사 서버(Cloudways)에 연결해 풀이를 미리 받아오는 중입니다. 아직 첫 목차·본문 진행 기록이 DB에 저장되지 않았습니다.";
    }
    if (payload.final_system_prompt || payload.client_body) {
      return "사용자 브라우저 또는 프록시를 통해 점사 스트림이 진행 중입니다. 서버 Tank prefetch가 아닌 경로일 수 있습니다.";
    }
    return "점사 본문 생성이 진행 중이나, 진행률을 볼 수 있는 스냅샷이 아직 없습니다.";
  }

  const tocLen = Array.isArray(snap.toc) ? snap.toc.length : 0;
  const doneLen = Array.isArray(snap.doneIdx) ? snap.doneIdx.length : 0;
  const mode = snap.claudeStreamMode ? "한 번에 HTML 받기" : "목차별 나눠 받기";
  const htmlLen = typeof snap.claudeStreamHtml === "string" ? snap.claudeStreamHtml.length : 0;

  if (snap.complete) {
    return `거의 완료 · ${mode} · 목차 ${tocLen}개 · HTML ${htmlLen.toLocaleString("ko-KR")}자`;
  }

  if (tocLen > 0) {
    return `목차 ${tocLen}개 중 ${doneLen}개 완료 · ${mode}${htmlLen ? ` · 누적 ${htmlLen.toLocaleString("ko-KR")}자` : ""}`;
  }

  if (snap.claudeStreamMode && htmlLen > 0) {
    return `${mode}로 본문 수신 중 · 현재 ${htmlLen.toLocaleString("ko-KR")}자`;
  }

  return `${mode} 시작됨 · 목차·본문 첫 데이터 대기 중`;
}

function queuedDetail(payload: Payload, order?: { order_no?: string; status?: string } | null): string {
  const parts: string[] = [];
  const orderNo = text(order?.order_no || payload.order_no, "").trim();
  const orderStatus = text(order?.status, "").trim();

  if (orderNo) {
    const orderStatusKo =
      orderStatus === "paid"
        ? "결제완료"
        : orderStatus === "pending"
          ? "결제대기"
          : orderStatus === "failed"
            ? "결제실패"
            : orderStatus === "cancelled"
              ? "취소"
              : orderStatus;
    parts.push(`주문번호 ${orderNo}${orderStatusKo ? ` · ${orderStatusKo}` : ""}`);
  }

  if (text(payload.payment_method) === "pg") {
    parts.push("PG 결제는 완료됨");
  }

  if (payload.prefetch_access_token) {
    parts.push("서버 prefetch 작업은 등록됨 · 백그라운드에서 점사 생성 시작 대기");
  } else if (!payload.cloudways_upstream) {
    parts.push("아직 점사 생성이 시작되지 않음 · 사용자가 점사 화면에 들어가면 streaming으로 바뀝니다");
  } else {
    parts.push("AI 요청 본문은 준비됨 · 서버 prefetch job 실행만 남음");
  }

  if (text(payload.source) === "fortune_stream_modal") {
    parts.push("점사 모달에서 저장한 요청");
  }

  return parts.join(" · ");
}

/** Fortune Ops 점사 요청 — completed 제외 상태별 상세 사유 */
export function resolveFortuneRequestStatusDetail(
  row: Record<string, unknown>,
  order?: { order_no?: string; status?: string } | null,
): string {
  const status = text(row.status, "").toLowerCase();
  if (!status || status === "completed") return "";

  const payload = readPayload(row.payload);
  const prefetchError = humanizePrefetchError(text(payload.prefetch_error, ""));
  const genericError = humanizePrefetchError(text(payload.error ?? payload.stream_error ?? payload.last_error, ""));

  if (status === "failed") {
    if (prefetchError) return prefetchError;
    if (genericError) return genericError;
    const snap = readSnapshot(payload);
    if (snap && !snap.complete) {
      return `생성 도중 중단됨 · ${streamingProgressDetail(payload)}`;
    }
    return "실패 원인이 DB에 기록되지 않았습니다. Cloudways·Vercel 서버 로그를 확인해 주세요.";
  }

  if (status === "retrying") {
    const base = "재시도 예정 또는 재시도 진행 중";
    if (prefetchError) return `${base} · 직전 오류: ${prefetchError}`;
    if (genericError) return `${base} · ${genericError}`;
    return base;
  }

  if (status === "streaming") {
    if (prefetchError) return `스트림 중 오류가 감지됨 · ${prefetchError}`;
    return streamingProgressDetail(payload);
  }

  if (status === "queued") {
    return queuedDetail(payload, order);
  }

  const fallback = prefetchError || genericError;
  return fallback || `${status} 상태 · 추가 설명 없음`;
}
