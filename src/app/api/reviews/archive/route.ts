import { NextResponse } from "next/server";

import { buildReviewUserMask, type ReviewSourceType } from "@/lib/reviews-user";
import { revalidateReviewPages } from "@/lib/reviews-revalidate";
import { bearerFromRequest, supabaseRouteUserClient } from "@/lib/supabase/route-user-client";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const SOURCE_TYPES = new Set<ReviewSourceType>(["fortune", "voice", "chat"]);

function parseSourceType(raw: string | null): ReviewSourceType | null {
  if (!raw) return null;
  return SOURCE_TYPES.has(raw as ReviewSourceType) ? (raw as ReviewSourceType) : null;
}

type ReviewRow = {
  id: string;
  source_type: string;
  source_id: string;
  stars: number;
  body: string;
  tags: string[] | null;
  character_key: string | null;
  product_label: string | null;
  created_at: string;
  is_published: boolean;
};

function rowToRecord(row: ReviewRow) {
  const characterKey =
    row.character_key === "yeo" || row.character_key === "un" || row.character_key === "byeol"
      ? row.character_key
      : "yeon";
  return {
    id: row.id,
    sourceType: row.source_type as ReviewSourceType,
    sourceId: row.source_id,
    stars: Number(row.stars) || 5,
    body: row.body,
    tags: row.tags ?? [],
    characterKey,
    productLine: row.product_label?.trim() || "",
    title: row.product_label?.trim() || "",
    submittedAt: row.created_at,
    isPublished: Boolean(row.is_published),
  };
}

export async function GET(request: Request) {
  const token = bearerFromRequest(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sbUser = supabaseRouteUserClient(token);
  if (!sbUser) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: userData, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userData.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const url = new URL(request.url);
  const sourceType = parseSourceType(url.searchParams.get("sourceType"));
  const sourceId = url.searchParams.get("sourceId")?.trim() ?? "";

  if (!sourceType || !sourceId) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("reviews")
    .select(
      "id,source_type,source_id,stars,body,tags,character_key,product_label,created_at,is_published",
    )
    .eq("user_ref", userData.user.id)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ review: null });

  return NextResponse.json({ review: rowToRecord(data as ReviewRow) });
}

type SubmitBody = {
  sourceType?: ReviewSourceType;
  sourceId?: string;
  productSlug?: string;
  stars?: number;
  body?: string;
  tags?: string[];
  characterKey?: string;
  productLine?: string;
  title?: string;
};

export async function POST(request: Request) {
  const token = bearerFromRequest(request);
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sbUser = supabaseRouteUserClient(token);
  if (!sbUser) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });

  const { data: userData, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userData.user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  let payload: SubmitBody;
  try {
    payload = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sourceType = parseSourceType(payload.sourceType ?? null);
  const sourceId = payload.sourceId?.trim() ?? "";
  const productSlug = payload.productSlug?.trim() ?? "";
  const stars = Math.max(1, Math.min(5, Math.round(Number(payload.stars) || 0)));
  const body = (payload.body ?? "").trim();
  const tags = Array.isArray(payload.tags) ? payload.tags.filter((t) => typeof t === "string") : [];
  const characterKey =
    payload.characterKey === "yeo" || payload.characterKey === "un" || payload.characterKey === "byeol"
      ? payload.characterKey
      : "yeon";
  const productLine = (payload.productLine ?? "").trim();
  const title = (payload.title ?? productLine).trim();

  if (!sourceType || !sourceId || !productSlug || !body || stars < 1) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const sb = supabaseServer();
  const uid = userData.user.id;

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name,birth_year,gender")
    .eq("id", uid)
    .maybeSingle();

  const userMask = buildReviewUserMask(profile?.display_name, {
    birthYear: profile?.birth_year,
    gender: profile?.gender,
  });

  const row = {
    product_slug: productSlug,
    user_mask: userMask,
    stars,
    body,
    tags,
    character_key: characterKey,
    product_label: productLine || title,
    reviewed_on: new Date().toISOString().slice(0, 10),
    is_showcase: false,
    is_published: false,
    source_type: sourceType,
    source_id: sourceId,
    user_ref: uid,
  };

  const { data: existing } = await sb
    .from("reviews")
    .select("id")
    .eq("user_ref", uid)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  let saved: ReviewRow | null = null;
  let error: { message: string } | null = null;

  if (existing?.id) {
    const res = await sb
      .from("reviews")
      .update(row)
      .eq("id", existing.id)
      .select(
        "id,source_type,source_id,stars,body,tags,character_key,product_label,created_at,is_published",
      )
      .single();
    saved = res.data as ReviewRow | null;
    error = res.error;
  } else {
    const res = await sb
      .from("reviews")
      .insert(row)
      .select(
        "id,source_type,source_id,stars,body,tags,character_key,product_label,created_at,is_published",
      )
      .single();
    saved = res.data as ReviewRow | null;
    error = res.error;
  }

  if (error || !saved) {
    return NextResponse.json({ error: error?.message ?? "save_failed" }, { status: 500 });
  }

  if (saved.is_published) {
    revalidateReviewPages();
  }

  return NextResponse.json({ review: rowToRecord(saved) });
}
