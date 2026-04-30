import { NextResponse } from "next/server";

import { countHangulChars, demoSectionHtml, demoTocSections, type DemoProfile } from "@/lib/fortune-two-stage-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function enc(s: string) {
  return new TextEncoder().encode(s);
}

function sse(obj: unknown) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    product_slug?: string;
    profile?: string;
    manse_context?: string;
    character_key?: string;
    order_no?: string;
  };
  const product_slug = String(body.product_slug ?? "").trim() || "demo";
  const profile: DemoProfile = body.profile === "pair" ? "pair" : "single";
  const manse_context = typeof body.manse_context === "string" ? body.manse_context.trim() : "";
  const manse_context_chars = manse_context.length;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(enc(sse(obj)));

      send({
        type: "meta",
        product_slug,
        profile,
        manse_context_included: manse_context_chars > 0,
        manse_context_chars,
      });

      await new Promise((r) => setTimeout(r, 1500));
      const sections = demoTocSections(profile);
      send({ type: "toc", sections });
      await new Promise((r) => setTimeout(r, 1100));

      const chunkUtf = (s: string, n: number) => {
        const a = Array.from(s);
        const out: string[] = [];
        for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n).join(""));
        return out.length ? out : [s];
      };

      let totalChars = 0;
      for (let i = 0; i < sections.length; i++) {
        send({ type: "section_start", index: i });
        const html = demoSectionHtml(profile, i);
        const chunks = chunkUtf(html, 28);
        for (const chunk of chunks) {
          await new Promise((r) => setTimeout(r, 38));
          send({ type: "chunk", index: i, html: chunk });
        }
        totalChars += countHangulChars(html);
        send({ type: "section_end", index: i });
      }

      send({ type: "done", charCount: Math.max(totalChars, 1200) });
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
