import { NextResponse } from "next/server";
import {
  foreignScriptNeedsTranslation,
  translateForeignTextsToKoreanServer,
} from "@/lib/fortune-foreign-script-translate-server";

export const runtime = "nodejs";

type Body = { texts?: unknown };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const raw = Array.isArray(body.texts) ? body.texts : [];
  const texts = raw.map((t) => String(t ?? "").trim()).filter(Boolean).slice(0, 24);
  if (texts.length === 0) {
    return NextResponse.json({ ok: true, translations: {} });
  }

  if (!texts.some((t) => foreignScriptNeedsTranslation(t))) {
    return NextResponse.json({ ok: true, translations: {} });
  }

  try {
    const translations = await translateForeignTextsToKoreanServer(texts);
    return NextResponse.json({ ok: true, translations });
  } catch {
    return NextResponse.json({ ok: false, error: "translate_failed" }, { status: 502 });
  }
}
