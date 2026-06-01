/**
 * 오늘의 한 마디 등: character-line API로 받은 WAV를 Web Audio로 재생.
 */

let sharedCtx: AudioContext | null = null;
let currentSrc: AudioBufferSourceNode | null = null;

const decodedBufferCache = new Map<string, AudioBuffer>();
const inflightDecode = new Map<string, Promise<AudioBuffer | null>>();

function lineCacheKey(characterKey: string, transcript: string): string {
  return `${characterKey}\0${transcript}`;
}

export function stopCharacterLinePlayback(): void {
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

export function warmCharacterLineAudioContext(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().catch(() => {
    // 사용자 제스처 전이면 무시
  });
}

export function touchCharacterLineCache(characterKey: string, transcript: string): void {
  const ctx = getCtx();
  if (!ctx) return;
  const k = lineCacheKey(characterKey, transcript);
  if (decodedBufferCache.has(k) || inflightDecode.has(k)) return;
  void loadDecodedBuffer(ctx, characterKey, transcript);
}

export function prefetchCharacterLines(entries: { characterKey: string; transcript: string }[]): void {
  if (typeof window === "undefined" || entries.length === 0) return;
  const run = () => {
    warmCharacterLineAudioContext();
    for (const e of entries) {
      touchCharacterLineCache(e.characterKey, e.transcript);
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
      const fetchLine = fetch("/api/tts/character-line", {
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

export async function playCharacterLine(characterKey: string, transcript: string): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  stopCharacterLinePlayback();

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
