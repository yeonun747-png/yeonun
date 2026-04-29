/**
 * 오늘의 한 마디 등: Cartesia character-line API로 받은 WAV를 Web Audio로 재생.
 * 동일 문장은 세션 동안 디코딩 버퍼를 재사용하고, 유휴 시 미리 받아 두면 첫 재생이 거의 즉시입니다.
 */

let sharedCtx: AudioContext | null = null;
let currentSrc: AudioBufferSourceNode | null = null;

const decodedBufferCache = new Map<string, AudioBuffer>();
const inflightDecode = new Map<string, Promise<AudioBuffer | null>>();

function lineCacheKey(characterKey: string, transcript: string): string {
  return `${characterKey}\0${transcript}`;
}

export function stopCartesiaWebPlayback(): void {
  try {
    currentSrc?.stop();
  } catch {
    // 이미 종료됨
  }
  currentSrc = null;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

/** 오늘 탭 등에서 미리 컨텍스트만 만들어 두면 첫 재생 시 초기화 지연을 줄일 수 있음 */
export function warmCartesiaAudioContext(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().catch(() => {
    // 사용자 제스처 전이면 무시
  });
}

/**
 * 캐시에 없을 때만 네트워크·디코딩 시작.
 * 버튼에 pointerenter로 걸어 두면 클릭 전에 받기 시작합니다.
 */
export function touchCartesiaCharacterLineCache(characterKey: string, transcript: string): void {
  const ctx = getCtx();
  if (!ctx) return;
  const k = lineCacheKey(characterKey, transcript);
  if (decodedBufferCache.has(k) || inflightDecode.has(k)) return;
  void loadDecodedBuffer(ctx, characterKey, transcript);
}

/**
 * 오늘의 한 마디 4줄 등 — 브라우저가 한가할 때 미리 받아 둡니다.
 * (Cartesia 호출이 늘어나므로 이 컴포넌트에서만 호출하는 것을 권장)
 */
export function prefetchCartesiaCharacterLines(entries: { characterKey: string; transcript: string }[]): void {
  if (typeof window === "undefined" || entries.length === 0) return;
  const run = () => {
    warmCartesiaAudioContext();
    for (const e of entries) {
      touchCartesiaCharacterLineCache(e.characterKey, e.transcript);
    }
  };
  const ric = window.requestIdleCallback;
  if (typeof ric === "function") {
    ric(() => run(), { timeout: 600 });
  } else {
    window.setTimeout(run, 1);
  }
}

async function loadDecodedBuffer(ctx: AudioContext, characterKey: string, transcript: string): Promise<AudioBuffer | null> {
  const k = lineCacheKey(characterKey, transcript);
  const hit = decodedBufferCache.get(k);
  if (hit) return hit;

  const pending = inflightDecode.get(k);
  if (pending) return pending;

  const p = (async () => {
    try {
      const fetchLine = fetch("/api/tts/cartesia/character-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ character_key: characterKey, transcript }),
      });
      const [res] = await Promise.all([fetchLine, ctx.resume().catch(() => undefined)]);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf);
      decodedBufferCache.set(k, audioBuf);
      return audioBuf;
    } catch {
      return null;
    } finally {
      inflightDecode.delete(k);
    }
  })();

  inflightDecode.set(k, p);
  return p;
}

/** character_key: yeon | byeol | yeo | un */
export async function playCartesiaCharacterLine(characterKey: string, transcript: string): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  stopCartesiaWebPlayback();

  const audioBuf = await loadDecodedBuffer(ctx, characterKey, transcript);
  if (!audioBuf) return false;

  const src = ctx.createBufferSource();
  src.buffer = audioBuf;
  src.connect(ctx.destination);
  currentSrc = src;
  src.onended = () => {
    if (currentSrc === src) currentSrc = null;
  };
  try {
    src.start(0);
  } catch {
    return false;
  }
  return true;
}
