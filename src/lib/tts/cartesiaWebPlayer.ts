/**
 * 오늘의 한 마디 등: Cartesia character-line API로 받은 WAV를 Web Audio로 재생.
 */

let sharedCtx: AudioContext | null = null;
let currentSrc: AudioBufferSourceNode | null = null;

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

/** character_key: yeon | byeol | yeo | un */
export async function playCartesiaCharacterLine(characterKey: string, transcript: string): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;

  const res = await fetch("/api/tts/cartesia/character-line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character_key: characterKey, transcript }),
  });
  if (!res.ok) return false;

  const buf = await res.arrayBuffer();
  try {
    await ctx.resume();
  } catch {
    // ignore
  }

  stopCartesiaWebPlayback();

  let audioBuf: AudioBuffer;
  try {
    audioBuf = await ctx.decodeAudioData(buf.slice(0));
  } catch {
    return false;
  }

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
