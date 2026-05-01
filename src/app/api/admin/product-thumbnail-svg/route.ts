import { NextResponse } from "next/server";

import { buildCharacterThumbnailBgGradient } from "@/lib/character-thumbnail-bg-gradient";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  character_key?: string;
  product_title?: string;
  product_quote?: string;
};

function readEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function extractSvgFromText(raw: string): string {
  const t = raw.trim();
  const m = t.match(/<svg[\s\S]*<\/svg>/i);
  return (m ? m[0] : t).trim();
}

function normalizeHex6(raw: string): string | null {
  let s = raw.trim();
  if (!s.startsWith("#")) s = `#${s}`;
  const body = s.slice(1);
  if (/^[0-9a-f]{3}$/i.test(body)) {
    const a = body[0] ?? "0";
    const b = body[1] ?? "0";
    const c = body[2] ?? "0";
    s = `#${a}${a}${b}${b}${c}${c}`;
  }
  if (!/^#[0-9a-f]{6}$/i.test(s)) return null;
  return s.toUpperCase();
}

function collectHexesFromSvg(s: string): Set<string> {
  const out = new Set<string>();
  const re = /#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const n = normalizeHex6(m[0]);
    if (n) out.add(n);
  }
  return out;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const character_key = String(body.character_key ?? "yeon").trim() || "yeon";
  const product_title = String(body.product_title ?? "").trim() || "상품";
  const product_quote = String(body.product_quote ?? "").trim() || "";

  const apiKey = readEnv("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 501 });
  }

  const supabase = supabaseServer();
  const { data: persona } = await supabase
    .from("character_personas")
    .select("color_hex")
    .eq("character_key", character_key)
    .maybeSingle();

  const themeRaw = String(persona?.color_hex ?? "#DD5878").trim() || "#DD5878";
  const THEME_HEX = normalizeHex6(themeRaw) ?? "#DD5878".toUpperCase();
  const charBgGrad = buildCharacterThumbnailBgGradient(character_key, THEME_HEX);

  const { data: charRow } = await supabase.from("characters").select("name,han").eq("key", character_key).maybeSingle();
  const charLabel = [charRow?.name, charRow?.han].filter(Boolean).join(" · ") || character_key;

  const { data: sampleRows } = await supabase
    .from("products")
    .select("slug, title, thumbnail_svg")
    .eq("character_key", character_key)
    .not("thumbnail_svg", "is", null)
    .order("created_at", { ascending: false })
    .limit(6);

  const samplesFull = (sampleRows ?? [])
    .map((r) => ({
      slug: String(r.slug ?? ""),
      title: String(r.title ?? ""),
      svg: String(r.thumbnail_svg ?? "").trim(),
    }))
    .filter((s) => s.svg.length > 80 && s.svg.toLowerCase().includes("<svg"))
    .slice(0, 4);

  const refPalette = new Set<string>();
  for (const s of samplesFull) {
    for (const h of collectHexesFromSvg(s.svg)) refPalette.add(h);
  }

  const samples = samplesFull.map((s) => ({
    ...s,
    svg: s.svg.length > 3200 ? `${s.svg.slice(0, 3200)}\n<!-- …truncated … -->` : s.svg,
  }));

  const refPaletteList = [...refPalette].sort();
  const refPalettePrompt =
    refPaletteList.length === 0
      ? "(참조 SVG가 없어 팔레트 목록이 비었습니다.)"
      : refPaletteList.slice(0, 48).join(", ") + (refPaletteList.length > 48 ? ", …" : "");

  const model = String(
    readEnv("ADMIN_THUMBNAIL_SVG_MODEL") || readEnv("VOICE_LLM_MODEL") || "claude-sonnet-4-6",
  ).trim();

  const system = [
    "You output exactly ONE compact SVG for a Korean fortune-product card thumbnail.",
    "",
    "## Character accent (DB)",
    `THEME_HEX = ${THEME_HEX}`,
    "- Use THEME_HEX for the same kind of accent strokes/fills as in the reference card style (blossoms, ribbons, etc.), consistent with samples.",
    "",
    "## Character-specific background gradient (MANDATORY — server-built from THEME_HEX)",
    "- The user message includes CARD_BACKGROUND_GRADIENT: a <linearGradient> whose stop-color values are **computed from this character's THEME_HEX only** (each character gets a different wash).",
    "- You MUST copy that <linearGradient> element **verbatim** (same id, same stop-color hex values) inside your root <svg><defs>...</defs>.",
    "- Immediately after </defs>, the **first** graphic element MUST be: <rect width=\"100%\" height=\"100%\" fill=\"url(#GRAD_ID_FROM_USER_MESSAGE)\"/> so the entire card background uses this gradient. Do not use solid black or flat white as the only background.",
    "- Put all ornaments (paths, groups) **above** that rect in document order (later siblings draw on top).",
    "",
    "## Reference thumbnails (optional refinement)",
    "- REFERENCE_SAMPLE_SVGS may inform stroke weight and ornament style; the **background wash must still be** the CARD_BACKGROUND_GRADIENT above (not replaced by copying a different black background from a sample).",
    "",
    "## Colors (guidance — not machine-enforced)",
    "- Prefer THEME_HEX for accents, neutrals for ink/shadows, and the same gradient stop hexes as in REFERENCE_SAMPLE_SVGS / ALLOWED_HEX_FROM_REFERENCES. Small deviations are OK if the overall look matches the references.",
    "- Do NOT use currentColor for important fills (host will not theme this asset).",
    "",
    "## Typography — forbidden",
    "- Do NOT use <text>, <tspan>, or any glyphs meant to read as letters/numbers/hangul.",
    "- No captions, no product title inside the SVG. Shapes and gradients only.",
    "",
    "## Output format",
    "- Return ONLY raw <svg …>…</svg>. No markdown, no commentary.",
    "- viewBox like 0 0 320 200. No <foreignObject>, no <script>, no external URLs, no filters that reference remote resources.",
    "- Keep under ~8KB. Abstract/decorative shapes or soft silhouette — no trademarked IPs.",
    "",
    "## Style level",
    "- Match stroke weight and ornament density of REFERENCE_SAMPLE_SVGS. Background = mandatory CARD_BACKGROUND_GRADIENT only.",
  ].join("\n");

  const sampleBlock =
    samples.length === 0
      ? [
          "(이 캐릭터로 등록된 thumbnail_svg 샘플이 DB에 없습니다. 위 규칙만 따르고, 복잡도는 과하지 않게 유지하세요.)",
        ].join("\n")
      : samples
          .map(
            (s, i) =>
              `### Reference sample ${i + 1} — slug: ${s.slug} / title: ${s.title}\n` +
              "Use for **ornament** line weight, shapes, and how THEME_HEX is used in foreground only — **do not** replace the mandatory CARD_BACKGROUND_GRADIENT with this file's background.\n" +
              "```svg\n" +
              s.svg +
              "\n```",
          )
          .join("\n\n");

  const user = [
    `# Character`,
    `- key: ${character_key}`,
    `- display: ${charLabel}`,
    "",
    `# Accent`,
    `THEME_HEX=${THEME_HEX}`,
    "",
    `# CARD_BACKGROUND_GRADIENT (캐릭터별 — THEME_HEX에서만 계산됨. <defs> 안에 그대로 붙이고, id·stop-color 변경 금지)`,
    `GRADIENT_ID=${charBgGrad.gradientId}`,
    "Paste this entire element inside <defs>:",
    "```xml",
    charBgGrad.gradientElementXml,
    "```",
    "Then right after </defs>, first graphic:",
    "```xml",
    `<rect width="100%" height="100%" fill="url(#${charBgGrad.gradientId})"/>`,
    "```",
    "",
    `# ALLOWED_HEX_FROM_REFERENCES (palette extracted from existing thumbnails — prefer these for gradients)`,
    refPalettePrompt,
    "",
    `# New product (for mood only — do not write this text inside SVG)`,
    `- title: ${product_title}`,
    `- quote: ${product_quote.slice(0, 800)}`,
    "",
    `# REFERENCE_SAMPLE_SVGS (same character, from product list)`,
    sampleBlock,
    "",
    "Produce one new SVG. Background: ONLY the CARD_BACKGROUND_GRADIENT above on a full-size rect (not solid black). Accents: include THEME_HEX where samples do. No <text>.",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0.45,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const textBody = await res.text().catch(() => "");
  if (!res.ok) {
    return NextResponse.json(
      { error: `Anthropic ${res.status}`, details: textBody.slice(0, 600) },
      { status: 502 },
    );
  }

  let text = "";
  try {
    const j = JSON.parse(textBody || "{}") as { content?: Array<{ type?: string; text?: string }> };
    const parts = Array.isArray(j?.content) ? j.content : [];
    text = parts.map((p) => (p?.type === "text" ? String(p.text || "") : "")).join("").trim();
  } catch {
    return NextResponse.json({ error: "invalid_upstream_response" }, { status: 502 });
  }

  let svg = extractSvgFromText(text);
  if (!svg.toLowerCase().startsWith("<svg")) {
    return NextResponse.json({ error: "no_svg_in_response", raw: text.slice(0, 400) }, { status: 422 });
  }

  if (/<text[\s>/]/i.test(svg) || /<tspan[\s>/]/i.test(svg)) {
    return NextResponse.json(
      { error: "svg_contains_text", hint: "모델이 <text>를 출력했습니다. 다시 시도하거나 프롬프트를 조정하세요." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    svg,
    theme_hex: THEME_HEX,
    bg_gradient_id: charBgGrad.gradientId,
    bg_gradient_stops: charBgGrad.stopHexes,
    sample_count: samples.length,
    ref_palette_size: refPalette.size,
  });
}
