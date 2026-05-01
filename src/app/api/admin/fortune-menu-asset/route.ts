import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "fortune_menu_assets";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4"]);

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 40 * 1024 * 1024;

function parseStorageObjectFromPublicUrl(publicUrl: string): { bucket: string; objectPath: string } | null {
  try {
    const u = new URL(publicUrl);
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    const bucket = m[1];
    const objectPath = decodeURIComponent(m[2]);
    if (!objectPath || objectPath.includes("..")) return null;
    return { bucket, objectPath };
  } catch {
    return null;
  }
}

function extForImage(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: Request) {
  if (!env.supabaseServiceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured" }, { status: 501 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size < 1) {
    return NextResponse.json({ error: "missing_or_empty_file" }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "image") === "video" ? "video" : "image";
  const previousUrl = String(form.get("previous_url") ?? "").trim();

  const nameLower = file instanceof File ? file.name.toLowerCase() : "";
  let contentType = (file.type || "").toLowerCase();
  if (!contentType && kind === "video" && nameLower.endsWith(".mp4")) contentType = "video/mp4";
  if (!contentType && kind === "image") {
    if (nameLower.endsWith(".png")) contentType = "image/png";
    else if (nameLower.endsWith(".webp")) contentType = "image/webp";
    else if (nameLower.endsWith(".gif")) contentType = "image/gif";
    else if (nameLower.endsWith(".jpg") || nameLower.endsWith(".jpeg")) contentType = "image/jpeg";
  }
  if (kind === "image" && !IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid_image_type", detail: contentType }, { status: 400 });
  }
  if (kind === "video" && !VIDEO_TYPES.has(contentType)) {
    return NextResponse.json({ error: "invalid_video_type", detail: contentType }, { status: 400 });
  }

  const max = kind === "image" ? MAX_IMAGE : MAX_VIDEO;
  if (file.size > max) {
    return NextResponse.json({ error: "file_too_large", max_bytes: max }, { status: 400 });
  }

  const supabase = supabaseServer();

  const ext = kind === "video" ? "mp4" : extForImage(contentType);
  const objectPath = `menu/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
    contentType: contentType || (kind === "image" ? "image/jpeg" : "video/mp4"),
    upsert: false,
  });

  if (upErr) {
    return NextResponse.json({ error: "upload_failed", detail: upErr.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const publicUrl = data.publicUrl;

  const parsed = previousUrl ? parseStorageObjectFromPublicUrl(previousUrl) : null;
  if (parsed && parsed.bucket === BUCKET && parsed.objectPath !== objectPath) {
    await supabase.storage.from(BUCKET).remove([parsed.objectPath]);
  }

  return NextResponse.json({
    publicUrl,
    path: objectPath,
    bucket: BUCKET,
  });
}
