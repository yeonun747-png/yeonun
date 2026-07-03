import { redirect } from "next/navigation";

import { isAdminRequest } from "@/lib/admin-auth";
import { supabaseServer } from "@/lib/supabase/server";

import { createAdminTtsPreviewToken } from "@/lib/admin-tts-preview-token";

import { AdminDashboardPanel } from "@/components/admin/AdminDashboardPanel";
import { AdminInquiriesPanel } from "@/components/admin/AdminInquiriesPanel";
import { AdminMemberCreditsClient } from "@/components/admin/AdminMemberCreditsClient";
import { AdminSignupsPanel } from "@/components/admin/AdminSignupsPanel";
import { AdminVisitorsPanel } from "@/components/admin/AdminVisitorsPanel";
import { AdminReviewCreateForm } from "@/components/admin/AdminReviewCreateForm";
import { AdminReviewEditor } from "@/components/admin/AdminReviewEditor";
import { AdminCategoryEditor } from "@/components/admin/AdminCategoryEditor";
import { AdminCharacterEditor } from "@/components/admin/AdminCharacterEditor";
import { AdminCharacterModePromptEditor } from "@/components/admin/AdminCharacterModePromptEditor";
import { AdminCrudEditActions } from "@/components/admin/AdminCrudEditActions";
import { AdminServicePromptForm } from "@/components/admin/AdminServicePromptForm";
import { AdminWorkspace } from "@/components/admin/AdminWorkspace";
import { ProductEditorBlock } from "@/components/admin/ProductEditorClient";
import { ProductNewFormClient } from "@/components/admin/ProductNewFormClient";
import { TtsVoiceListPreview } from "@/components/admin/TtsVoiceListPreview";
import { loadAdminDashboardData } from "@/lib/admin-dashboard-data";
import { countPendingInquiries } from "@/lib/user-inquiries-server";
import { resolveFortuneRequestStatusDetail } from "@/lib/admin-fortune-ops-detail";
import { isFortuneMenuCatalogProductSlug } from "@/lib/credit-package-products";
import { cardVariantForSlug } from "@/lib/ui/content-card-variant";
import type { TtsVoiceOption } from "@/components/admin/VoiceCharacterPromptTtsFields";

type Row = Record<string, unknown>;

const PRODUCTS_SELECT_NO_PROFILE =
  "slug,title,quote,price_krw,category_slug,character_key,badge,home_section_slug,tags,thumbnail_svg,created_at";

const PRODUCTS_SELECT_ADMIN =
  "slug,title,quote,payment_code,price_krw,category_slug,character_key,badge,home_section_slug,tags,thumbnail_svg,saju_input_profile,fortune_menu,fortune_questions,fortune_stream_strategy,library_retention_kind,library_retention_days,created_at";

/** `library_retention_*` 컬럼 마이그레이션 전 DB */
const PRODUCTS_SELECT_ADMIN_PRE_LIBRARY_RETENTION =
  "slug,title,quote,payment_code,price_krw,category_slug,character_key,badge,home_section_slug,tags,thumbnail_svg,saju_input_profile,fortune_menu,fortune_questions,fortune_stream_strategy,created_at";

/** `fortune_stream_strategy` 컬럼 마이그레이션 전 DB */
const PRODUCTS_SELECT_ADMIN_PRE_STREAM_STRATEGY =
  "slug,title,quote,payment_code,price_krw,category_slug,character_key,badge,home_section_slug,tags,thumbnail_svg,saju_input_profile,fortune_menu,fortune_questions,created_at";

/** `fortune_questions` 컬럼 마이그레이션 전 DB */
const PRODUCTS_SELECT_ADMIN_PRE_FORTUNE_QUESTIONS =
  "slug,title,quote,payment_code,price_krw,category_slug,character_key,badge,home_section_slug,tags,thumbnail_svg,saju_input_profile,fortune_menu,created_at";

/** 어드민에 노출하는 공통 시스템 프롬프트만 조회 — `order+limit`만 쓰면 행이 늘었을 때 특정 key가 목록에서 빠질 수 있음 */
const ADMIN_SERVICE_PROMPT_KEYS = ["yeonun_common_system", "yeonun_fortune_text_system", "yeonun_chat_text_system"] as const;

async function readServicePromptsForAdmin(): Promise<{ rows: Row[]; ready: boolean; error?: string }> {
  const supabase = supabaseServer();
  try {
    const { data, error } = await supabase
      .from("service_prompts")
      .select("key,title,prompt,is_active")
      .in("key", [...ADMIN_SERVICE_PROMPT_KEYS]);
    if (error) return { rows: [], ready: false, error: error.message };
    const rowsUnknown = (data ?? []) as unknown;
    const rows = Array.isArray(rowsUnknown) ? (rowsUnknown as Row[]) : [];
    return { rows, ready: true };
  } catch (error) {
    return { rows: [], ready: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}

async function readRows(table: string, select = "*", order?: string, limit = 20): Promise<{ rows: Row[]; ready: boolean; error?: string }> {
  const supabase = supabaseServer();
  try {
    let q = supabase.from(table).select(select);
    if (order) q = q.order(order, { ascending: false });
    const first = await q.limit(limit);
    let data: unknown = first.data;
    let error = first.error;
    if (
      error &&
      table === "products" &&
      error.message.includes("saju_input_profile") &&
      error.message.includes("does not exist")
    ) {
      let q2 = supabase.from(table).select(PRODUCTS_SELECT_NO_PROFILE);
      if (order) q2 = q2.order(order, { ascending: false });
      const second = await q2.limit(limit);
      data = second.data;
      error = second.error;
    }
    if (
      error &&
      table === "products" &&
      error.message.includes("fortune_questions") &&
      (error.message.includes("does not exist") || error.message.includes("column"))
    ) {
      let q2 = supabase.from(table).select(PRODUCTS_SELECT_ADMIN_PRE_FORTUNE_QUESTIONS);
      if (order) q2 = q2.order(order, { ascending: false });
      const third = await q2.limit(limit);
      data = third.data;
      error = third.error;
    }
    if (
      error &&
      table === "products" &&
      (error.message.includes("library_retention_kind") || error.message.includes("library_retention_days")) &&
      (error.message.includes("does not exist") || error.message.includes("column"))
    ) {
      let q2 = supabase.from(table).select(PRODUCTS_SELECT_ADMIN_PRE_LIBRARY_RETENTION);
      if (order) q2 = q2.order(order, { ascending: false });
      const fourth = await q2.limit(limit);
      data = fourth.data;
      error = fourth.error;
    }
    if (
      error &&
      table === "products" &&
      error.message.includes("fortune_stream_strategy") &&
      (error.message.includes("does not exist") || error.message.includes("column"))
    ) {
      let q2 = supabase.from(table).select(PRODUCTS_SELECT_ADMIN_PRE_STREAM_STRATEGY);
      if (order) q2 = q2.order(order, { ascending: false });
      const fifth = await q2.limit(limit);
      data = fifth.data;
      error = fifth.error;
    }
    if (error) return { rows: [], ready: false, error: error.message };
    const rowsUnknown = (data ?? []) as unknown;
    const rows = Array.isArray(rowsUnknown) ? (rowsUnknown as Row[]) : [];
    return { rows, ready: true };
  } catch (error) {
    return { rows: [], ready: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}

function text(v: unknown, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function sortNoticeRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) =>
    String(b.published_on ?? "").localeCompare(String(a.published_on ?? "")),
  );
}

function sortReviewRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}

function noticeCategoryLabelAdmin(category: string) {
  if (category === "event") return "이벤트";
  if (category === "update") return "업데이트";
  return "공지";
}

function money(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}원` : "-";
}

async function enrichFortuneRequestsForOps(
  fortuneRequests: { rows: Row[]; ready: boolean; error?: string },
  productRows: Row[],
): Promise<{ rows: Row[]; ready: boolean; error?: string }> {
  if (!fortuneRequests.ready) return fortuneRequests;

  const productMap = new Map(productRows.map((p) => [text(p.slug, ""), p]));
  const userRefs = [
    ...new Set(
      fortuneRequests.rows
        .map((r) => text(r.user_ref, "").trim())
        .filter((uid) => uid && uid !== "guest"),
    ),
  ];
  const orderIds = [
    ...new Set(
      fortuneRequests.rows
        .map((r) => text(r.order_id, "").trim())
        .filter(Boolean),
    ),
  ];

  const profileMap = new Map<string, string>();
  const orderMap = new Map<string, { order_no?: string; status?: string }>();
  const supabase = supabaseServer();
  if (userRefs.length) {
    const { data } = await supabase.from("profiles").select("id, display_name").in("id", userRefs);
    for (const p of data ?? []) {
      const id = text(p.id, "").trim();
      const name = text(p.display_name, "").trim();
      if (id && name) profileMap.set(id, name);
    }
  }
  if (orderIds.length) {
    const { data } = await supabase.from("orders").select("id, order_no, status").in("id", orderIds);
    for (const o of data ?? []) {
      const id = text(o.id, "").trim();
      if (id) orderMap.set(id, { order_no: text(o.order_no), status: text(o.status) });
    }
  }

  const rows = fortuneRequests.rows.map((r) => {
    const slug = text(r.product_slug, "");
    const product = productMap.get(slug);
    const uid = text(r.user_ref, "").trim();
    const displayName = uid ? profileMap.get(uid) : "";
    const orderId = text(r.order_id, "").trim();
    const order = orderId ? orderMap.get(orderId) : null;
    const enriched = {
      ...r,
      user_name:
        displayName ||
        (uid && uid !== "guest" ? `${uid.slice(0, 8)}…` : uid === "guest" ? "게스트" : "-"),
      product_title: product ? text(product.title) : slug || "-",
      product_price_krw: product?.price_krw ?? null,
    };
    return {
      ...enriched,
      status_detail: resolveFortuneRequestStatusDetail(enriched, order),
    };
  });

  return { ...fortuneRequests, rows };
}

/** 상품에 붙이는 카테고리 — 프론트 「전체」탭용 slug `all` 제외 */
function categoriesAssignableToProducts(rows: Row[]) {
  return rows.filter((c) => text(c.slug) !== "all");
}

function StatusPill({ children, tone = "base" }: { children: React.ReactNode; tone?: "base" | "good" | "warn" | "bad" | "rose" }) {
  return <span className={`y-admin-pill ${tone}`}>{children}</span>;
}

function EmptyPanel({ label, error }: { label: string; error?: string }) {
  return (
    <div className="y-admin-empty">
      <strong>{label}</strong>
      <span>{error ? `스키마/권한 확인 필요: ${error}` : "아직 데이터가 없습니다."}</span>
    </div>
  );
}

export default async function AdminHomePage() {
  if (!(await isAdminRequest())) {
    redirect("/admin/login");
  }

  const [
    products,
    characters,
    personas,
    servicePrompts,
    characterModePrompts,
    ttsVoices,
    categories,
    reviews,
    orders,
    payments,
    coupons,
    webhooks,
    voiceSessions,
    fortuneRequests,
    notices,
  ] = await Promise.all([
      readRows("products", PRODUCTS_SELECT_ADMIN, "created_at", 80),
      readRows("characters", "key,name,han,en,spec,greeting", "key", 20),
      readRows("character_personas", "character_key,color_hex,age_impression,voice_tone,honorific_style,field_core,emotional_distance,sentence_tempo,endings,specialties,temperament,speech_style,emotion_style,strengths,keywords,is_active", "character_key", 20),
      readServicePromptsForAdmin(),
      readRows("character_mode_prompts", "character_key,mode,title,prompt,is_active,tts_voice_id,updated_at", "updated_at", 50),
      readRows("tts_voices", "id,provider,label,external_id,gender,sort_order,is_active", "sort_order", 100),
      readRows("categories", "slug,label,sort_order", "sort_order", 50),
      readRows(
        "reviews",
        "id,product_slug,user_mask,stars,body,tags,created_at,source_type,source_id,user_ref,character_key,product_label,is_showcase,is_published",
        "created_at",
        200,
      ),
      readRows("orders", "id,order_no,product_slug,status,amount_krw,created_at", "created_at", 20),
      readRows("payments", "id,order_id,provider,method,status,paid_at", "paid_at", 20),
      readRows("coupons", "id,code,type,value,is_active,used_count,max_uses", "created_at", 20),
      readRows("webhook_events", "id,provider,event_type,status,processed_at", "processed_at", 20),
      readRows("voice_sessions", "id,character_key,status,started_at,ended_at,duration_sec,cost_krw,summary", "started_at", 20),
      readRows("fortune_requests", "id,user_ref,product_slug,order_id,status,model,payload,created_at", "created_at", 20),
      readRows(
        "notices",
        "slug,category,title,published_on,body,is_published,show_new_dot,sort_order,updated_at",
        "published_on",
        50,
      ),
    ]);

  const adminTtsPreviewToken = await createAdminTtsPreviewToken();

  const ttsVoiceOptionsActive: TtsVoiceOption[] = ttsVoices.rows
    .filter((r) => r.is_active !== false)
    .map((r) => ({
      id: text(r.id),
      label: text(r.label),
      external_id: text(r.external_id),
      provider: text(r.provider, "openai_realtime"),
    }))
    .sort((a, b) => text(a.label).localeCompare(text(b.label), "ko"));

  /** 음성 상담형(Realtime) 캐릭터 보이스 — 레거시 Cartesia provider 행은 선택 풀에서 제외 */
  const ttsVoiceOptionsVoiceRealtime = ttsVoiceOptionsActive.filter(
    (v) => String(v.provider ?? "").trim().toLowerCase() !== "cartesia",
  );

  const categoriesForProducts = categoriesAssignableToProducts(categories.rows);

  /** 크레딧 충전 패키지(9001~9003) — PG·결제용 DB 행만 유지, 어드민·메뉴 카드에는 미노출 */
  const catalogProductRows = products.rows.filter((p) => isFortuneMenuCatalogProductSlug(text(p.slug, "")));

  const fortuneRequestsEnriched = await enrichFortuneRequestsForOps(fortuneRequests, products.rows);

  const dashboardData = await loadAdminDashboardData();
  const pendingInquiryCount = await countPendingInquiries();

  return (
    <AdminWorkspace
      navBadges={{ inquiries: pendingInquiryCount }}
      dashboard={<AdminDashboardPanel data={dashboardData} />}
      visitors={<AdminVisitorsPanel />}
      content={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">CONTENT OPS</span>
              <h2>콘텐츠 운영</h2>
            </div>
            <StatusPill tone="good">CRUD 활성</StatusPill>
          </div>
          <div className="y-admin-toolbar">
            <a href="#admin-products">상품 {catalogProductRows.length}</a>
            <a href="#admin-categories">카테고리 {categories.rows.length}</a>
            <a href="#admin-characters">캐릭터 {characters.rows.length}</a>
            <a href="#admin-personas">페르소나 {personas.rows.length}</a>
          </div>

          <div className="y-admin-grid two y-admin-product-save-grid">
            <div className="y-admin-card">
              <h3>상품 저장</h3>
              <ProductNewFormClient categories={categoriesForProducts} characters={characters.rows} previewVariant="yeon" />
            </div>

            <div className="y-admin-card">
              <h3>카테고리 빠른 저장</h3>
              <form action="/admin/categories" method="post" className="y-admin-form compact">
                <input name="slug" placeholder="category slug" />
                <input name="label" placeholder="카테고리명" />
                <input name="sort_order" inputMode="numeric" placeholder="정렬" />
                <button type="submit">카테고리 저장</button>
              </form>
            </div>
          </div>

          <CrudSection id="admin-products" title="상품 목록" hint="slug 기준 upsert. 펼쳐서 바로 수정할 수 있습니다.">
            {catalogProductRows.length === 0 ? <EmptyPanel label="상품" error={products.error} /> : catalogProductRows.map((p) => (
              <ProductEditorBlock
                key={text(p.slug)}
                row={p}
                categories={categoriesForProducts}
                characters={characters.rows}
                previewVariant={cardVariantForSlug(text(p.slug, ""), text(p.character_key, "yeon"))}
              />
            ))}
          </CrudSection>

          <CrudSection id="admin-categories" title="카테고리 목록" hint="홈/전체 풀이 탭의 라벨과 정렬 순서입니다.">
            {categories.rows.length === 0 ? <EmptyPanel label="카테고리" error={categories.error} /> : categories.rows.map((c) => (
              <AdminCategoryEditor key={text(c.slug)} row={c} />
            ))}
          </CrudSection>

          <CrudSection id="admin-characters" title="캐릭터 목록" hint="인연 안내자 카드, 만남 탭, 캐릭터 상세의 원천 데이터입니다.">
            {characters.rows.length === 0 ? <EmptyPanel label="캐릭터" error={characters.error} /> : characters.rows.map((c) => (
              <AdminCharacterEditor key={text(c.key)} row={c} />
            ))}
          </CrudSection>

          <CrudSection
            id="admin-personas"
            title="캐릭터 전문영역"
            hint="캐릭터 카드·만남 등에 쓰이는 전문 분야·톤·키워드와 전문영역(JSON) 메타데이터입니다."
          >
            {characters.rows.map((c) => {
              const persona = personas.rows.find((p) => text(p.character_key) === text(c.key));
              return <PersonaEditor key={text(c.key)} character={c} persona={persona} />;
            })}
          </CrudSection>

        </section>
      }
      reviews={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">REVIEW OPS</span>
              <h2>리뷰 운영</h2>
            </div>
            <StatusPill tone={reviews.ready ? "good" : "warn"}>{reviews.ready ? "CRUD 활성" : "마이그레이션 필요"}</StatusPill>
          </div>
          <p className="y-admin-muted" style={{ margin: "0 0 14px" }}>
            <strong>노출</strong> 선택 시 홈·전체 리뷰·상품 상세에 표시됩니다.
          </p>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>리뷰 새로 등록 (운영)</h3>
            <AdminReviewCreateForm />
          </div>
          <CrudSection id="admin-reviews" title="리뷰 목록" hint="최신순 · 한 줄에 하나 · 노출 여부">
            {reviews.rows.length === 0 ? (
              <EmptyPanel label="리뷰" error={reviews.error} />
            ) : (
              sortReviewRows(reviews.rows).map((r) => (
                <AdminReviewEditor
                  key={text(r.id)}
                  row={{
                    id: text(r.id),
                    product_slug: text(r.product_slug),
                    user_mask: text(r.user_mask),
                    stars: r.stars as number | string,
                    body: text(r.body),
                    tags: (r.tags as string[] | string) ?? [],
                    created_at: text(r.created_at, ""),
                    source_type: text(r.source_type, ""),
                    source_id: text(r.source_id, ""),
                    user_ref: text(r.user_ref, ""),
                    is_showcase: r.is_showcase === true,
                    is_published: r.is_published === true,
                  }}
                  products={catalogProductRows.map((p) => ({ slug: text(p.slug), title: text(p.title) }))}
                />
              ))
            )}
          </CrudSection>
        </section>
      }
      notices={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">NOTICE OPS</span>
              <h2>공지사항 운영</h2>
            </div>
            <StatusPill tone={notices.ready ? "good" : "warn"}>{notices.ready ? "CRUD 활성" : "마이그레이션 필요"}</StatusPill>
          </div>
          <p className="y-admin-muted" style={{ margin: "0 0 14px" }}>
            마이탭 공지사항 목록·상세에 노출됩니다. 목록은 <code>published_on</code>(게시일) 기준 최신순으로 정렬됩니다.
          </p>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
              <h3>공지 새로 등록</h3>
              <form action="/admin/notices" method="post" className="y-admin-form compact">
                <input name="slug" placeholder="slug (영문-하이픈)" required />
                <select name="category" defaultValue="notice">
                  <option value="event">이벤트</option>
                  <option value="update">업데이트</option>
                  <option value="notice">공지</option>
                </select>
                <input name="title" placeholder="제목" required />
                <input name="published_on" type="date" required />
                <input name="sort_order" inputMode="numeric" placeholder="정렬 (클수록 상단)" defaultValue="100" />
                <select name="show_new_dot" defaultValue="true">
                  <option value="true">새 글 점 표시</option>
                  <option value="false">점 숨김</option>
                </select>
                <select name="is_published" defaultValue="true">
                  <option value="true">게시</option>
                  <option value="false">비게시</option>
                </select>
                <textarea name="body" placeholder="본문 (플레인 텍스트, [섹션] 제목 지원)" rows={6} required />
                <button type="submit">공지 저장</button>
              </form>
          </div>
          <CrudSection id="admin-notices" title="공지 목록" hint="최신순 · 한 줄에 하나 · 마이탭 /notices">
            {notices.rows.length === 0 ? (
              <EmptyPanel label="공지" error={notices.error} />
            ) : (
              sortNoticeRows(notices.rows).map((row) => <NoticeEditor key={text(row.slug)} row={row} />)
            )}
          </CrudSection>
        </section>
      }
      commerce={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">COMMERCE OPS</span>
              <h2>결제/주문 운영</h2>
            </div>
            <StatusPill tone={payments.ready ? "good" : "warn"}>{payments.ready ? "연결됨" : "스키마 준비"}</StatusPill>
          </div>
          <div className="y-admin-grid two">
            <div className="y-admin-card">
              <h3>쿠폰 저장</h3>
              <form action="/admin/coupons" method="post" className="y-admin-form">
                <input name="code" placeholder="WELCOME3000" />
                <select name="type" defaultValue="amount">
                  <option value="amount">정액 할인</option>
                  <option value="percent">정률 할인</option>
                </select>
                <input name="value" inputMode="numeric" placeholder="할인 값 (3000 / 10)" />
                <input name="max_uses" inputMode="numeric" placeholder="최대 사용 횟수" />
                <select name="is_active" defaultValue="true">
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
                <button type="submit">쿠폰 저장</button>
              </form>
            </div>
            <div className="y-admin-card">
              <h3>운영 상태 전이</h3>
              <div className="y-admin-empty">
                <strong>상태 변경은 각 목록 행에서 처리</strong>
                <span>주문/결제/음성/점사 요청 카드에 있는 상태 버튼으로 운영 상태를 바로 갱신합니다.</span>
              </div>
            </div>
          </div>
          <div className="y-admin-grid three">
            <OpsList title="주문" data={orders} fields={["order_no", "product_slug", "status", "amount_krw"]} table="orders" hash="commerce" statuses={["pending", "paid", "failed", "cancelled"]} />
            <OpsList title="결제" data={payments} fields={["provider", "method", "status", "paid_at"]} table="payments" hash="commerce" statuses={["pending", "paid", "failed", "refunded"]} />
            <CouponList data={coupons} />
          </div>
          <OpsRunbook
            title="결제 운영 체크"
            items={["주문 생성 후 PG 요청", "결제 콜백 HMAC 검증", "payments/webhook_events 원본 payload 저장", "환불은 결제 상태와 별도 refunds로 추적"]}
          />
        </section>
      }
      inquiries={<AdminInquiriesPanel />}
      signups={<AdminSignupsPanel />}
      credits={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">CREDIT OPS</span>
              <h2>회원 크레딧 (CS)</h2>
            </div>
            <StatusPill tone="good">로그인 회원</StatusPill>
          </div>
          <div className="y-admin-card y-admin-member-credits-panel">
            <AdminMemberCreditsClient />
          </div>
        </section>
      }
      voice={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">VOICE OPS</span>
              <h2>음성상담 운영</h2>
            </div>
            <StatusPill tone={voiceSessions.ready ? "good" : "warn"}>{voiceSessions.ready ? "세션 연결" : "스키마 준비"}</StatusPill>
          </div>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>공통 프롬프트 — 음성 상담형</h3>
            <AdminServicePromptForm
              promptKey="yeonun_common_system"
              defaultTitle="공통 프롬프트 — 음성 상담형"
              row={servicePrompts.rows.find((p) => text(p.key) === "yeonun_common_system")}
            />
          </div>
          <TtsVoicesRegistry data={ttsVoices} adminTtsPreviewToken={adminTtsPreviewToken} />
          <CrudSection
            id="admin-character-voice-prompts"
            title="캐릭터별 프롬프트 — 음성 상담형"
            hint="음성 상담에서 캐릭터 말투/역할을 고정하는 프롬프트입니다. 보이스 풀은 Realtime(OpenAI)만 표시됩니다."
          >
            {characters.rows.map((c) => {
              const row = characterModePrompts.rows.find(
                (p) => text(p.character_key) === text(c.key) && text(p.mode) === "voice",
              );
              return (
                <AdminCharacterModePromptEditor
                  key={`${text(c.key)}-voice`}
                  character={c}
                  mode="voice"
                  row={row}
                  defaultTitle={`${text(c.name)} — 음성 상담형`}
                  ttsVoiceOptions={ttsVoiceOptionsVoiceRealtime}
                  adminTtsPreviewToken={adminTtsPreviewToken}
                />
              );
            })}
          </CrudSection>
          <OpsList title="최근 음성 세션" data={voiceSessions} fields={["character_key", "status", "duration_sec", "cost_krw"]} table="voice_sessions" hash="voice" statuses={["active", "ended", "error"]} />
          <OpsRunbook
            title="음성상담 운영 체크"
            items={["세션 생성/종료 상태 확인", "turn transcript와 audio url 보존", "Cloudways WS 프록시 상태 확인", "사용량/비용 추정치를 세션별 집계"]}
          />
        </section>
      }
      fortune={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">FORTUNE OPS</span>
              <h2>점사 운영</h2>
            </div>
            <StatusPill tone={fortuneRequestsEnriched.ready ? "good" : "warn"}>{fortuneRequestsEnriched.ready ? "요청 연결" : "스키마 준비"}</StatusPill>
          </div>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>공통 프롬프트 — 텍스트 점사형</h3>
            <AdminServicePromptForm
              promptKey="yeonun_fortune_text_system"
              defaultTitle="공통 프롬프트 — 텍스트 점사형"
              row={servicePrompts.rows.find((p) => text(p.key) === "yeonun_fortune_text_system")}
            />
          </div>
          <CrudSection
            id="admin-character-fortune-prompts"
            title="캐릭터별 프롬프트 — 텍스트 점사형"
            hint="텍스트 점사 출력의 캐릭터 톤/역할을 고정하는 프롬프트입니다. (공통 프롬프트 + 캐릭터 프롬프트로 합성)"
          >
            {characters.rows.map((c) => {
              const row = characterModePrompts.rows.find(
                (p) => text(p.character_key) === text(c.key) && text(p.mode) === "fortune_text",
              );
              return (
                <AdminCharacterModePromptEditor
                  key={`${text(c.key)}-fortune_text`}
                  character={c}
                  mode="fortune_text"
                  row={row}
                  defaultTitle={`${text(c.name)} — 텍스트 점사형`}
                />
              );
            })}
          </CrudSection>
          <div className="y-admin-grid">
            <OpsList
              title="점사 요청"
              data={fortuneRequestsEnriched}
              fields={["user_name", "product_title", "product_price_krw", "product_slug", "status", "model", "created_at"]}
              fieldLabels={{
                user_name: "유저명",
                product_title: "한글상품명",
                product_price_krw: "상품금액",
                product_slug: "상품 slug",
                status: "상태",
                model: "모델",
                created_at: "요청 시각",
              }}
              detailField="status_detail"
              detailLabel="상세 사유"
              table="fortune_requests"
              hash="fortune"
              statuses={["queued", "streaming", "completed", "failed", "retrying"]}
            />
          </div>
          <OpsRunbook
            title="점사 운영 체크"
            items={["fortune_requests 상태 전이 확인", "Cloudways SSE 프록시 health 확인", "프롬프트 활성 버전과 모델명 관리", "결과 HTML sanitize 후 fortune_results 저장"]}
          />
        </section>
      }
      chat={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">CHAT OPS</span>
              <h2>채팅 상담 운영</h2>
            </div>
            <StatusPill tone="good">프롬프트 합성</StatusPill>
          </div>
          <p className="y-admin-muted" style={{ margin: "0 0 14px" }}>
            앱의 채팅 상담(`/api/chat/consult-stream`)은 <strong>공통 프롬프트 — 텍스트 채팅형</strong>과 선택 캐릭터의{" "}
            <strong>텍스트 채팅형</strong> 프롬프트를 합친 뒤, 페르소나·사주명식 블록을 이어 붙입니다. 채팅형 행이 없으면
            음성 상담형 프롬프트로 자동 대체합니다.
          </p>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>공통 프롬프트 — 텍스트 채팅형</h3>
            <AdminServicePromptForm
              promptKey="yeonun_chat_text_system"
              defaultTitle="공통 프롬프트 — 텍스트 채팅형"
              row={servicePrompts.rows.find((p) => text(p.key) === "yeonun_chat_text_system")}
            />
          </div>
          <CrudSection
            id="admin-character-chat-prompts"
            title="캐릭터별 프롬프트 — 텍스트 채팅형"
            hint="채팅 UI 말투·역할. 점사용 텍스트 점사형과 별도입니다."
          >
            {characters.rows.map((c) => {
              const row = characterModePrompts.rows.find(
                (p) => text(p.character_key) === text(c.key) && text(p.mode) === "chat_text",
              );
              return (
                <AdminCharacterModePromptEditor
                  key={`${text(c.key)}-chat_text`}
                  character={c}
                  mode="chat_text"
                  row={row}
                  defaultTitle={`${text(c.name)} — 텍스트 채팅형`}
                />
              );
            })}
          </CrudSection>
          <OpsRunbook
            title="채팅 상담 운영 체크"
            items={["프롬프트 저장 후 만남 탭 채팅 모달에서 응답 톤 확인", "공통·캐릭터 프롬프트 비활성 시 API 폴백(구 공통 키·음성형) 동작 확인", "크레딧 차감·스트림 오류 로그 모니터링"]}
          />
        </section>
      }
      logs={
        <section className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">LOGS</span>
              <h2>웹훅/프록시 로그</h2>
            </div>
            <StatusPill tone={webhooks.ready ? "good" : "warn"}>{webhooks.ready ? "로그 연결" : "스키마 준비"}</StatusPill>
          </div>
          <OpsList title="웹훅 이벤트" data={webhooks} fields={["provider", "event_type", "status", "processed_at"]} table="webhook_events" hash="logs" statuses={["received", "processed", "failed", "ignored"]} />
        </section>
      }
    />
  );
}

function CrudSection({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="y-admin-crud-section">
      <div className="y-admin-subhead">
        <div>
          <h3>{title}</h3>
          {hint ? <p>{hint}</p> : null}
        </div>
      </div>
      <div className="y-admin-crud-list">{children}</div>
    </section>
  );
}

function NoticeEditor({ row }: { row: Row }) {
  const pub = text(row.published_on, "");
  const dateInput = /^\d{4}-\d{2}-\d{2}$/.test(pub) ? pub : pub.replace(/\./g, "-").slice(0, 10);
  const category = text(row.category, "notice");
  const dateLabel = /^\d{4}-\d{2}-\d{2}$/.test(pub)
    ? pub.replace(/-/g, ".")
    : pub;
  const slug = text(row.slug, "");
  const editFormId = `edit-notice-${slug}`;
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>
            <span className={`y-admin-notice-cat ${category}`}>{noticeCategoryLabelAdmin(category)}</span>
            {text(row.title)}
          </strong>
          <em>
            {dateLabel} · sort {text(row.sort_order)} · {text(row.slug)}
          </em>
        </span>
        <StatusPill tone={row.is_published === false ? "warn" : "good"}>{row.is_published === false ? "비게시" : "게시"}</StatusPill>
      </summary>
      <form id={editFormId} action="/admin/notices" method="post" className="y-admin-form y-admin-edit-form">
        <input name="slug" defaultValue={slug} />
        <select name="category" defaultValue={text(row.category, "notice")}>
          <option value="event">이벤트</option>
          <option value="update">업데이트</option>
          <option value="notice">공지</option>
        </select>
        <input name="title" defaultValue={text(row.title, "")} />
        <input name="published_on" type="date" defaultValue={dateInput} />
        <input name="sort_order" defaultValue={text(row.sort_order, "0")} inputMode="numeric" />
        <select name="show_new_dot" defaultValue={String(row.show_new_dot ?? true)}>
          <option value="true">새 글 점</option>
          <option value="false">점 숨김</option>
        </select>
        <select name="is_published" defaultValue={String(row.is_published ?? true)}>
          <option value="true">게시</option>
          <option value="false">비게시</option>
        </select>
        <textarea name="body" defaultValue={text(row.body, "")} rows={12} />
      </form>
      <AdminCrudEditActions
        saveFormId={editFormId}
        deleteAction="/admin/notices/delete"
        deleteFields={{ slug }}
        deleteModalTitle="공지 삭제"
        deleteItemLabel={text(row.title)}
        deleteLeadSuffix="공지를 삭제할까요?"
        deleteMeta={`slug: ${slug}`}
      />
    </details>
  );
}

function PersonaEditor({ character, persona }: { character: Row; persona?: Row }) {
  const specialties = JSON.stringify(persona?.specialties ?? [], null, 2);
  const colorHex = text(persona?.color_hex, "#DD5878");
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{text(character.name)} 페르소나</strong>
          <em>{text(persona?.voice_tone)} · {text(persona?.field_core)} · {text(persona?.is_active, "미등록")}</em>
        </span>
        <span className="y-admin-persona-summary">
          <span className="y-admin-color-chip" style={{ backgroundColor: colorHex }}>
            {colorHex}
          </span>
          <StatusPill tone={persona?.is_active === false ? "warn" : "good"}>{persona?.is_active === false ? "비활성" : "활성"}</StatusPill>
        </span>
      </summary>
      <form action="/admin/personas" method="post" className="y-admin-form y-admin-edit-form persona">
        <input type="hidden" name="character_key" value={text(character.key, "")} />
        <input
          className="y-admin-color-cell"
          name="color_hex"
          defaultValue={colorHex}
          style={{ backgroundColor: colorHex }}
          aria-label="테마 컬러 16진수 값"
        />
        <input name="age_impression" defaultValue={text(persona?.age_impression, "")} placeholder="나이대 인상" />
        <input name="voice_tone" defaultValue={text(persona?.voice_tone, "")} placeholder="목소리 톤" />
        <input name="honorific_style" defaultValue={text(persona?.honorific_style, "")} placeholder="존댓말 강도" />
        <input name="field_core" defaultValue={text(persona?.field_core, "")} placeholder="분야 핵심" />
        <input name="emotional_distance" defaultValue={text(persona?.emotional_distance, "")} placeholder="감정 거리" />
        <input name="sentence_tempo" defaultValue={text(persona?.sentence_tempo, "")} placeholder="말 길이/호흡" />
        <input name="endings" defaultValue={text(persona?.endings, "")} placeholder="대표 어미" />
        <label className="y-admin-labeled-field">
          <span>전문영역 JSON</span>
          <textarea name="specialties" defaultValue={specialties} placeholder='[{"name":"재회 분석","desc":"..."}]' />
        </label>
        <label className="y-admin-labeled-field">
          <span>페르소나 · 성정</span>
          <textarea name="temperament" defaultValue={text(persona?.temperament, "")} placeholder="성정" />
        </label>
        <label className="y-admin-labeled-field">
          <span>말투</span>
          <textarea name="speech_style" defaultValue={text(persona?.speech_style, "")} placeholder="말투" />
        </label>
        <label className="y-admin-labeled-field">
          <span>감정</span>
          <textarea name="emotion_style" defaultValue={text(persona?.emotion_style, "")} placeholder="감정" />
        </label>
        <label className="y-admin-labeled-field">
          <span>강점</span>
          <textarea name="strengths" defaultValue={text(persona?.strengths, "")} placeholder="강점" />
        </label>
        <label className="y-admin-labeled-field compact">
          <span>대표 키워드</span>
          <input name="keywords" defaultValue={Array.isArray(persona?.keywords) ? persona.keywords.join(" ") : text(persona?.keywords, "")} placeholder="#재회 #짝사랑" />
        </label>
        <select name="is_active" defaultValue={String(persona?.is_active ?? true)}>
          <option value="true">활성</option>
          <option value="false">비활성(삭제 대체)</option>
        </select>
        <button type="submit">페르소나 저장</button>
      </form>
    </details>
  );
}

function TtsVoicesRegistry({
  data,
  adminTtsPreviewToken,
}: {
  data: { rows: Row[]; ready: boolean; error?: string };
  adminTtsPreviewToken?: string | null;
}) {
  if (!data.ready) {
    return (
      <CrudSection id="admin-tts-voices" title="보이스 미리듣기">
        <div className="y-admin-tts-registry">
          <EmptyPanel label="tts_voices" error={data.error} />
        </div>
      </CrudSection>
    );
  }
  const sorted = [...data.rows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const openai = sorted.filter((r) => text(r.provider) === "openai_realtime");
  return (
    <CrudSection id="admin-tts-voices" title="보이스 미리듣기">
      <div className="y-admin-tts-registry">
        <div className="y-admin-tts-preview-grid">
          {openai.length === 0 ? (
            <p className="y-admin-muted" style={{ gridColumn: "1 / -1" }}>
              등록된 OpenAI Realtime 보이스가 없습니다.
            </p>
          ) : (
            openai.map((r) => <TtsVoiceEditor key={text(r.id)} row={r} adminTtsPreviewToken={adminTtsPreviewToken} />)
          )}
        </div>
      </div>
    </CrudSection>
  );
}

function TtsVoiceEditor({ row, adminTtsPreviewToken }: { row: Row; adminTtsPreviewToken?: string | null }) {
  const id = text(row.id, "");
  const editFormId = `edit-tts-${id}`;
  return (
    <details className="y-admin-editor mini" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{text(row.label)}</strong>
          <em>sort {text(row.sort_order)}</em>
        </span>
        <span className="y-admin-tts-summary-actions">
          <TtsVoiceListPreview
            externalId={text(row.external_id, "")}
            provider={text(row.provider, "openai_realtime")}
            adminTtsPreviewToken={adminTtsPreviewToken}
          />
          <form action="/admin/tts-voices/toggle-active" method="post">
            <input type="hidden" name="id" value={text(row.id, "")} />
            <input type="hidden" name="is_active" value={row.is_active === false ? "true" : "false"} />
            <button
              type="submit"
              className={`y-admin-pill-btn y-admin-pill ${row.is_active === false ? "warn" : "good"}`}
            >
              {row.is_active === false ? "비활성" : "활성"}
            </button>
          </form>
        </span>
      </summary>
      <form id={editFormId} action="/admin/tts-voices" method="post" className="y-admin-form y-admin-edit-form">
        <input type="hidden" name="id" value={id} />
        <input name="label" defaultValue={text(row.label, "")} />
        <input name="external_id" defaultValue={text(row.external_id, "")} readOnly={text(row.provider) === "openai_realtime"} aria-readonly={text(row.provider) === "openai_realtime"} />
        <input type="hidden" name="provider" value={text(row.provider, "openai_realtime")} />
        <select name="gender" defaultValue={text(row.gender, "other")}>
          <option value="female">여성</option>
          <option value="male">남성</option>
          <option value="other">기타</option>
        </select>
        <input name="sort_order" defaultValue={text(row.sort_order, "0")} inputMode="numeric" />
        <select name="is_active" defaultValue={String(row.is_active ?? true)}>
          <option value="true">활성</option>
          <option value="false">비활성</option>
        </select>
      </form>
      <AdminCrudEditActions
        saveFormId={editFormId}
        deleteAction="/admin/tts-voices/delete"
        deleteFields={{ id }}
        deleteModalTitle="보이스 삭제"
        deleteItemLabel={text(row.label)}
        deleteLeadSuffix="보이스를 삭제할까요?"
        deleteMeta={`id: ${id}`}
      />
    </details>
  );
}

function CouponList({ data }: { data: { rows: Row[]; ready: boolean; error?: string } }) {
  return (
    <div className="y-admin-card">
      <h3>쿠폰</h3>
      {!data.ready || data.rows.length === 0 ? (
        <EmptyPanel label="쿠폰" error={data.error} />
      ) : (
        <div className="y-admin-mini-list">
          {data.rows.slice(0, 8).map((r) => {
            const id = text(r.id, "");
            const editFormId = `edit-coupon-${id}`;
            return (
            <details key={id} className="y-admin-editor mini" suppressHydrationWarning>
              <summary>
                <span>
                  <strong>{text(r.code)}</strong>
                  <em>{text(r.type)} · {text(r.value)} · used {text(r.used_count)}/{text(r.max_uses)}</em>
                </span>
                <StatusPill tone={r.is_active ? "good" : "warn"}>{r.is_active ? "활성" : "비활성"}</StatusPill>
              </summary>
              <form id={editFormId} action="/admin/coupons" method="post" className="y-admin-form y-admin-edit-form">
                <input type="hidden" name="id" defaultValue={id} />
                <input name="code" defaultValue={text(r.code, "")} />
                <select name="type" defaultValue={text(r.type, "amount")}>
                  <option value="amount">정액 할인</option>
                  <option value="percent">정률 할인</option>
                </select>
                <input name="value" defaultValue={text(r.value, "0")} inputMode="numeric" />
                <input name="max_uses" defaultValue={text(r.max_uses, "")} inputMode="numeric" />
                <select name="is_active" defaultValue={text(r.is_active, "true")}>
                  <option value="true">활성</option>
                  <option value="false">비활성</option>
                </select>
              </form>
              <AdminCrudEditActions
                saveFormId={editFormId}
                deleteAction="/admin/coupons/delete"
                deleteFields={{ id }}
                deleteModalTitle="쿠폰 삭제"
                deleteItemLabel={text(r.code)}
                deleteLeadSuffix="쿠폰을 삭제할까요?"
                deleteMeta={`id: ${id}`}
              />
            </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpsList({
  title,
  data,
  fields,
  fieldLabels,
  detailField,
  detailLabel = "상세",
  table,
  hash = "dashboard",
  statuses = [],
}: {
  title: string;
  data: { rows: Row[]; ready: boolean; error?: string };
  fields: string[];
  fieldLabels?: Record<string, string>;
  detailField?: string;
  detailLabel?: string;
  table?: string;
  hash?: string;
  statuses?: string[];
}) {
  const formatField = (f: string, r: Row) => {
    if (f.includes("amount") || f.includes("cost") || f.includes("price")) return money(r[f]);
    return text(r[f]);
  };

  return (
    <div className="y-admin-card">
      <h3>{title}</h3>
      {!data.ready || data.rows.length === 0 ? (
        <EmptyPanel label={title} error={data.error} />
      ) : (
        <div className="y-admin-mini-list">
          {data.rows.slice(0, 8).map((r, idx) => {
            const detail = detailField ? text(r[detailField], "").trim() : "";
            const statusKey = text(r.status, "").toLowerCase();
            const detailTone =
              statusKey === "failed" || statusKey === "retrying" ? "y-admin-mini-row-detail--warn" : "y-admin-mini-row-detail--info";
            return (
              <div key={`${title}-${idx}`} className="y-admin-mini-row-wrap">
                <div className="y-admin-mini-row">
                  {fields.map((f) => (
                    <span key={f}>
                      <em>{fieldLabels?.[f] ?? f}</em>
                      {formatField(f, r)}
                    </span>
                  ))}
                  {table && text(r.id, "") ? (
                    <form action="/admin/ops-status" method="post" className="y-admin-status-form">
                      <input type="hidden" name="table" value={table} />
                      <input type="hidden" name="id" value={text(r.id, "")} />
                      <input type="hidden" name="hash" value={hash} />
                      <select name="status" defaultValue={text(r.status, statuses[0] ?? "")}>
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button type="submit">상태 저장</button>
                    </form>
                  ) : null}
                </div>
                {detail ? (
                  <p className={`y-admin-mini-row-detail ${detailTone}`}>
                    <em>{detailLabel}</em>
                    {detail}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OpsRunbook({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="y-admin-runbook">
      <strong>{title}</strong>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

