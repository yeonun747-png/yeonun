import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

const PRODUCT_SELECT_LEGACY =
  "slug,title,quote,category_slug,badge,price_krw,character_key,home_section_slug,tags,thumbnail_svg,created_at";
const PRODUCT_SELECT_WITH_PROFILE = `${PRODUCT_SELECT_LEGACY},saju_input_profile`;
const PRODUCT_SELECT_FULL = `${PRODUCT_SELECT_WITH_PROFILE},payment_code,fortune_menu`;

function missingSajuProfileColumn(msg: string) {
  return msg.includes("saju_input_profile") && msg.includes("does not exist");
}

function missingPaymentOrMenuColumn(msg: string) {
  return (
    (msg.includes("payment_code") || msg.includes("fortune_menu")) &&
    (msg.includes("does not exist") || msg.includes("column"))
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const supabase = supabaseServer();
  const run = (cols: string) => {
    let q = supabase.from("products").select(cols).order("created_at", { ascending: false });
    if (category && category !== "all") {
      q = q.eq("category_slug", category);
    }
    return q;
  };

  let { data, error } = await run(PRODUCT_SELECT_FULL);
  if (error && missingPaymentOrMenuColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_WITH_PROFILE));
  }
  if (error && missingSajuProfileColumn(error.message)) {
    ({ data, error } = await run(PRODUCT_SELECT_LEGACY));
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

