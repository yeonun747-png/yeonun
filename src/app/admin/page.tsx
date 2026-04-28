import { supabaseServer } from "@/lib/supabase/server";

import { TtsVoiceListPreview } from "@/components/admin/TtsVoiceListPreview";
import { VoiceCharacterPromptTtsFields, type TtsVoiceOption } from "@/components/admin/VoiceCharacterPromptTtsFields";

type Row = Record<string, unknown>;

async function readRows(table: string, select = "*", order?: string, limit = 20): Promise<{ rows: Row[]; ready: boolean; error?: string }> {
  const supabase = supabaseServer();
  try {
    let q = supabase.from(table).select(select);
    if (order) q = q.order(order, { ascending: false });
    const { data, error } = await q.limit(limit);
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

function money(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? `${n.toLocaleString("ko-KR")}원` : "-";
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
  const [products, characters, personas, servicePrompts, characterModePrompts, ttsVoices, categories, reviews, orders, payments, coupons, webhooks, voiceSessions, fortuneRequests] =
    await Promise.all([
      readRows("products", "slug,title,quote,price_krw,category_slug,character_key,badge", "created_at", 50),
      readRows("characters", "key,name,han,en,spec,greeting", "key", 20),
      readRows("character_personas", "character_key,color_hex,age_impression,voice_tone,honorific_style,field_core,emotional_distance,sentence_tempo,endings,specialties,temperament,speech_style,emotion_style,strengths,keywords,is_active", "character_key", 20),
      readRows("service_prompts", "key,title,prompt,is_active", "created_at", 10),
      readRows("character_mode_prompts", "character_key,mode,title,prompt,is_active,tts_voice_id,updated_at", "updated_at", 50),
      readRows("tts_voices", "id,provider,label,external_id,gender,sort_order,is_active", "sort_order", 100),
      readRows("categories", "slug,label,sort_order", "sort_order", 50),
      readRows("reviews", "id,product_slug,user_mask,stars,body,tags,created_at", "created_at", 30),
      readRows("orders", "id,order_no,product_slug,status,amount_krw,created_at", "created_at", 20),
      readRows("payments", "id,order_id,provider,method,status,paid_at,raw_payload", "paid_at", 20),
      readRows("coupons", "id,code,type,value,is_active,used_count,max_uses", "created_at", 20),
      readRows("webhook_events", "id,provider,event_type,status,processed_at", "processed_at", 20),
      readRows("voice_sessions", "id,character_key,status,started_at,ended_at,duration_sec,cost_krw,summary", "started_at", 20),
      readRows("fortune_requests", "id,product_slug,status,model,created_at", "created_at", 20),
    ]);

  const ttsVoiceOptionsActive: TtsVoiceOption[] = ttsVoices.rows
    .filter((r) => r.is_active !== false)
    .map((r) => ({ id: text(r.id), label: text(r.label), external_id: text(r.external_id) }))
    .sort((a, b) => text(a.label).localeCompare(text(b.label), "ko"));

  const kpis = [
    { label: "상품", value: products.rows.length, hint: products.ready ? "운영" : "확인 필요" },
    { label: "캐릭터", value: characters.rows.length, hint: characters.ready ? "운영" : "확인 필요" },
    { label: "리뷰", value: reviews.rows.length, hint: reviews.ready ? "운영" : "확인 필요" },
    { label: "결제", value: payments.rows.length, hint: payments.ready ? "연결됨" : "스키마 준비" },
    { label: "음성 세션", value: voiceSessions.rows.length, hint: voiceSessions.ready ? "연결됨" : "스키마 준비" },
    { label: "점사 요청", value: fortuneRequests.rows.length, hint: fortuneRequests.ready ? "연결됨" : "스키마 준비" },
  ];

  return (
    <div className="y-admin-shell">
      <aside className="y-admin-side">
        <div className="y-admin-brand">연운 管理</div>
        <p>운영, 결제, 점사, 음성상담을 한 화면에서 관리합니다.</p>
        <nav className="y-admin-nav" aria-label="어드민 메뉴">
          <a href="#dashboard">Dashboard</a>
          <a href="#content">Content</a>
          <a href="#commerce">Orders</a>
          <a href="#voice">VoiceOps</a>
          <a href="#fortune">Fortune</a>
          <a href="#logs">Logs</a>
        </nav>
      </aside>

      <main className="y-admin-main">
        <section id="dashboard" className="y-admin-hero">
          <div>
            <div className="y-admin-eyebrow">YEONUN OPS CONSOLE</div>
            <h1>운영 대시보드</h1>
            <p>현재 운영 가능한 데이터와 준비가 필요한 백오피스 영역을 분리해 관리합니다.</p>
          </div>
          <div className="y-admin-hero-card">
            <span>Auth</span>
            <strong>Single Admin Cookie</strong>
            <small>`src/proxy.ts` 보호 적용</small>
          </div>
        </section>

        <section className="y-admin-kpis" aria-label="운영 지표">
          {kpis.map((k) => (
            <div key={k.label} className="y-admin-kpi">
              <span>{k.label}</span>
              <strong>{k.value}</strong>
              <small>{k.hint}</small>
            </div>
          ))}
        </section>

        <section id="content" className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">CONTENT OPS</span>
              <h2>콘텐츠 운영</h2>
            </div>
            <StatusPill tone="good">CRUD 활성</StatusPill>
          </div>
          <div className="y-admin-toolbar">
            <a href="#admin-products">상품 {products.rows.length}</a>
            <a href="#admin-categories">카테고리 {categories.rows.length}</a>
            <a href="#admin-characters">캐릭터 {characters.rows.length}</a>
            <a href="#admin-personas">페르소나 {personas.rows.length}</a>
            <a href="#admin-reviews">리뷰 {reviews.rows.length}</a>
          </div>

          <div className="y-admin-grid two">
            <div className="y-admin-card">
              <h3>상품 저장</h3>
              <form action="/admin/products" method="post" className="y-admin-form">
                <input name="slug" placeholder="slug (reunion-maybe)" />
                <input name="title" placeholder="상품명" />
                <textarea name="quote" placeholder="상세 설명/카피" />
                <input name="price_krw" inputMode="numeric" placeholder="가격 (14900)" />
                <select name="category_slug">
                  {categories.rows.map((c) => (
                    <option key={text(c.slug)} value={text(c.slug)}>
                      {text(c.label)} ({text(c.slug)})
                    </option>
                  ))}
                </select>
                <select name="character_key">
                  {characters.rows.map((c) => (
                    <option key={text(c.key)} value={text(c.key)}>
                      {text(c.name)} ({text(c.key)})
                    </option>
                  ))}
                </select>
                <input name="badge" placeholder="HOT / NEW / 2026 / SIGNATURE" />
                <button type="submit">상품 저장</button>
              </form>
            </div>

            <div className="y-admin-card">
              <h3>카테고리/리뷰 빠른 저장</h3>
              <form action="/admin/categories" method="post" className="y-admin-form compact">
                <input name="slug" placeholder="category slug" />
                <input name="label" placeholder="카테고리명" />
                <input name="sort_order" inputMode="numeric" placeholder="정렬" />
                <button type="submit">카테고리 저장</button>
              </form>
              <form action="/admin/reviews" method="post" className="y-admin-form compact">
                <input name="product_slug" placeholder="product slug" />
                <input name="user_mask" placeholder="사용자 표시명" />
                <input name="stars" inputMode="numeric" placeholder="별점 1-5" />
                <textarea name="body" placeholder="후기 내용" />
                <input name="tags" placeholder="#재회 #인연" />
                <button type="submit">리뷰 저장</button>
              </form>
            </div>
          </div>

          <CrudSection id="admin-products" title="상품 목록" hint="slug 기준 upsert. 펼쳐서 바로 수정할 수 있습니다.">
            {products.rows.length === 0 ? <EmptyPanel label="상품" error={products.error} /> : products.rows.map((p) => (
              <ProductEditor key={text(p.slug)} row={p} categories={categories.rows} characters={characters.rows} />
            ))}
          </CrudSection>

          <CrudSection id="admin-categories" title="카테고리 목록" hint="홈/전체 풀이 탭의 라벨과 정렬 순서입니다.">
            {categories.rows.length === 0 ? <EmptyPanel label="카테고리" error={categories.error} /> : categories.rows.map((c) => (
              <CategoryEditor key={text(c.slug)} row={c} />
            ))}
          </CrudSection>

          <CrudSection id="admin-characters" title="캐릭터 목록" hint="인연 안내자 카드, 만남 탭, 캐릭터 상세의 원천 데이터입니다.">
            {characters.rows.length === 0 ? <EmptyPanel label="캐릭터" error={characters.error} /> : characters.rows.map((c) => (
              <CharacterEditor key={text(c.key)} row={c} />
            ))}
          </CrudSection>

          <CrudSection id="admin-personas" title="캐릭터 페르소나/전문영역" hint="4명 고정 캐릭터의 UI 페르소나와 LLM/음성상담 시스템 프롬프트입니다.">
            {characters.rows.map((c) => {
              const persona = personas.rows.find((p) => text(p.character_key) === text(c.key));
              return <PersonaEditor key={text(c.key)} character={c} persona={persona} />;
            })}
          </CrudSection>

          <CrudSection id="admin-reviews" title="리뷰 목록" hint="상품 상세의 최근 후기와 운영 신뢰도 요소입니다.">
            {reviews.rows.length === 0 ? <EmptyPanel label="리뷰" error={reviews.error} /> : reviews.rows.map((r) => (
              <ReviewEditor key={text(r.id)} row={r} products={products.rows} />
            ))}
          </CrudSection>
        </section>

        <section id="commerce" className="y-admin-section">
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

        <section id="voice" className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">VOICE OPS</span>
              <h2>음성상담 운영</h2>
            </div>
            <StatusPill tone={voiceSessions.ready ? "good" : "warn"}>{voiceSessions.ready ? "세션 연결" : "스키마 준비"}</StatusPill>
          </div>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>공통 프롬프트 — 음성상담형</h3>
            <ServicePromptEditor row={servicePrompts.rows.find((p) => text(p.key) === "yeonun_common_system")} />
          </div>
          <TtsVoicesRegistry data={ttsVoices} />
          <CrudSection
            id="admin-character-voice-prompts"
            title="캐릭터별 프롬프트 — 음성상담형"
            hint="음성 상담에서 캐릭터 말투/역할을 고정하는 프롬프트입니다. (공통 프롬프트 + 캐릭터 프롬프트로 합성)"
          >
            {characters.rows.map((c) => {
              const row = characterModePrompts.rows.find(
                (p) => text(p.character_key) === text(c.key) && text(p.mode) === "voice",
              );
              return (
                <CharacterModePromptEditor
                  key={`${text(c.key)}-voice`}
                  character={c}
                  mode="voice"
                  row={row}
                  defaultTitle={`${text(c.name)} — 음성상담형`}
                  ttsVoiceOptions={ttsVoiceOptionsActive}
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

        <section id="fortune" className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">FORTUNE OPS</span>
              <h2>Claude 점사 운영</h2>
            </div>
            <StatusPill tone={fortuneRequests.ready ? "good" : "warn"}>{fortuneRequests.ready ? "요청 연결" : "스키마 준비"}</StatusPill>
          </div>
          <div className="y-admin-card" style={{ marginBottom: 12 }}>
            <h3>공통 프롬프트 — 텍스트 점사형</h3>
            <ServicePromptEditorKey
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
                <CharacterModePromptEditor
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
            <OpsList title="점사 요청" data={fortuneRequests} fields={["product_slug", "status", "model", "created_at"]} table="fortune_requests" hash="fortune" statuses={["queued", "streaming", "completed", "failed", "retrying"]} />
          </div>
          <OpsRunbook
            title="Claude 점사 운영 체크"
            items={["fortune_requests 상태 전이 확인", "Cloudways SSE 프록시 health 확인", "프롬프트 활성 버전과 모델명 관리", "결과 HTML sanitize 후 fortune_results 저장"]}
          />
        </section>

        <section id="logs" className="y-admin-section">
          <div className="y-admin-section-head">
            <div>
              <span className="y-admin-eyebrow">LOGS</span>
              <h2>웹훅/프록시 로그</h2>
            </div>
            <StatusPill tone={webhooks.ready ? "good" : "warn"}>{webhooks.ready ? "로그 연결" : "스키마 준비"}</StatusPill>
          </div>
          <OpsList title="웹훅 이벤트" data={webhooks} fields={["provider", "event_type", "status", "processed_at"]} table="webhook_events" hash="logs" statuses={["received", "processed", "failed", "ignored"]} />
        </section>
      </main>
    </div>
  );
}

function CrudSection({ id, title, hint, children }: { id: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section id={id} className="y-admin-crud-section">
      <div className="y-admin-subhead">
        <div>
          <h3>{title}</h3>
          <p>{hint}</p>
        </div>
      </div>
      <div className="y-admin-crud-list">{children}</div>
    </section>
  );
}

function ProductEditor({ row, categories, characters }: { row: Row; categories: Row[]; characters: Row[] }) {
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{text(row.title)}</strong>
          <em>{text(row.slug)} · {text(row.category_slug)} · {text(row.character_key)} · {text(row.badge)}</em>
        </span>
        <StatusPill tone="rose">{money(row.price_krw)}</StatusPill>
      </summary>
      <form action="/admin/products" method="post" className="y-admin-form y-admin-edit-form">
        <input name="slug" defaultValue={text(row.slug, "")} placeholder="slug" />
        <input name="title" defaultValue={text(row.title, "")} placeholder="상품명" />
        <textarea name="quote" defaultValue={text(row.quote, "")} placeholder="상세 설명/카피" />
        <input name="price_krw" defaultValue={text(row.price_krw, "")} inputMode="numeric" placeholder="가격" />
        <select name="category_slug" defaultValue={text(row.category_slug, "")}>
          {categories.map((c) => <option key={text(c.slug)} value={text(c.slug)}>{text(c.label)} ({text(c.slug)})</option>)}
        </select>
        <select name="character_key" defaultValue={text(row.character_key, "")}>
          {characters.map((c) => <option key={text(c.key)} value={text(c.key)}>{text(c.name)} ({text(c.key)})</option>)}
        </select>
        <input name="badge" defaultValue={text(row.badge, "")} placeholder="badge" />
        <div className="y-admin-edit-actions">
          <button type="submit">수정 저장</button>
          <button form={`delete-product-${text(row.slug)}`} type="submit" className="y-admin-danger">삭제</button>
        </div>
      </form>
      <form id={`delete-product-${text(row.slug)}`} action="/admin/products/delete" method="post">
        <input type="hidden" name="slug" value={text(row.slug, "")} />
      </form>
    </details>
  );
}

function CategoryEditor({ row }: { row: Row }) {
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span><strong>{text(row.label)}</strong><em>{text(row.slug)} · sort {text(row.sort_order)}</em></span>
        <StatusPill>카테고리</StatusPill>
      </summary>
      <form action="/admin/categories" method="post" className="y-admin-form y-admin-edit-form">
        <input name="slug" defaultValue={text(row.slug, "")} />
        <input name="label" defaultValue={text(row.label, "")} />
        <input name="sort_order" defaultValue={text(row.sort_order, "0")} inputMode="numeric" />
        <div className="y-admin-edit-actions">
          <button type="submit">수정 저장</button>
          <button form={`delete-category-${text(row.slug)}`} type="submit" className="y-admin-danger">삭제</button>
        </div>
      </form>
      <form id={`delete-category-${text(row.slug)}`} action="/admin/categories/delete" method="post">
        <input type="hidden" name="slug" value={text(row.slug, "")} />
      </form>
    </details>
  );
}

function CharacterEditor({ row }: { row: Row }) {
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span><strong>{text(row.name)} · {text(row.han)}</strong><em>{text(row.key)} · {text(row.spec)}</em></span>
        <StatusPill tone="good">캐릭터</StatusPill>
      </summary>
      <form action="/admin/characters" method="post" className="y-admin-form y-admin-edit-form">
        <input name="key" defaultValue={text(row.key, "")} />
        <input name="name" defaultValue={text(row.name, "")} />
        <input name="han" defaultValue={text(row.han, "")} />
        <input name="en" defaultValue={text(row.en, "")} />
        <input name="spec" defaultValue={text(row.spec, "")} />
        <textarea name="greeting" defaultValue={text(row.greeting, "")} />
        <div className="y-admin-edit-actions">
          <button type="submit">수정 저장</button>
          <button form={`delete-character-${text(row.key)}`} type="submit" className="y-admin-danger">삭제</button>
        </div>
      </form>
      <form id={`delete-character-${text(row.key)}`} action="/admin/characters/delete" method="post">
        <input type="hidden" name="key" value={text(row.key, "")} />
      </form>
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

function ServicePromptEditor({ row }: { row?: Row }) {
  return (
    <form action="/admin/service-prompts" method="post" className="y-admin-form">
      <input type="hidden" name="key" value="yeonun_common_system" />
      <input name="title" defaultValue={text(row?.title, "공통 프롬프트 — 음성상담형")} placeholder="프롬프트명" />
      <textarea name="prompt" defaultValue={text(row?.prompt, "")} placeholder="공통 시스템 프롬프트" />
      <select name="is_active" defaultValue={String(row?.is_active ?? true)}>
        <option value="true">활성</option>
        <option value="false">비활성</option>
      </select>
      <button type="submit">프롬프트 저장</button>
    </form>
  );
}

function ServicePromptEditorKey({
  promptKey,
  defaultTitle,
  row,
}: {
  promptKey: string;
  defaultTitle: string;
  row?: Row;
}) {
  return (
    <form action="/admin/service-prompts" method="post" className="y-admin-form">
      <input type="hidden" name="key" value={promptKey} />
      <input name="title" defaultValue={text(row?.title, defaultTitle)} placeholder="프롬프트명" />
      <textarea name="prompt" defaultValue={text(row?.prompt, "")} placeholder="공통 프롬프트" />
      <select name="is_active" defaultValue={String(row?.is_active ?? true)}>
        <option value="true">활성</option>
        <option value="false">비활성</option>
      </select>
      <button type="submit">프롬프트 저장</button>
    </form>
  );
}

function CharacterModePromptEditor({
  character,
  mode,
  row,
  defaultTitle,
  ttsVoiceOptions,
}: {
  character: Row;
  mode: "voice" | "fortune_text";
  row?: Row;
  defaultTitle: string;
  ttsVoiceOptions?: TtsVoiceOption[];
}) {
  const summary = mode === "voice" ? "음성상담형" : "텍스트 점사형";
  const defaultVoiceId = row?.tts_voice_id != null ? text(row.tts_voice_id, "") : "";
  return (
    <details className="y-admin-editor" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{text(character.name)} · {summary}</strong>
          <em>{text(character.key)} · updated {text(row?.updated_at, "-")}</em>
        </span>
        <StatusPill tone={row?.is_active === false ? "warn" : "good"}>{row?.is_active === false ? "비활성" : "활성"}</StatusPill>
      </summary>
      <form action="/admin/character-prompts" method="post" className="y-admin-form y-admin-edit-form">
        <input type="hidden" name="character_key" value={text(character.key, "")} />
        <input type="hidden" name="mode" value={mode} />
        <input name="title" defaultValue={text(row?.title, defaultTitle)} placeholder="프롬프트명" />
        <textarea name="prompt" defaultValue={text(row?.prompt, "")} placeholder="캐릭터 프롬프트" />
        {mode === "voice" && ttsVoiceOptions ? (
          <div className="y-admin-voice-prompt-foot">
            <VoiceCharacterPromptTtsFields
              voices={ttsVoiceOptions}
              defaultVoiceId={defaultVoiceId}
              isActiveDefault={String(row?.is_active ?? true)}
            />
            <button type="submit">프롬프트 저장</button>
          </div>
        ) : (
          <>
            <select name="is_active" defaultValue={String(row?.is_active ?? true)}>
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            <button type="submit">프롬프트 저장</button>
          </>
        )}
      </form>
    </details>
  );
}

function TtsVoicesRegistry({ data }: { data: { rows: Row[]; ready: boolean; error?: string } }) {
  if (!data.ready) {
    return (
      <CrudSection id="admin-tts-voices" title="Cartesia TTS 보이스 등록" hint="Cartesia 콘솔의 Voice ID(UUID)를 등록합니다. 캐릭터 음성 프롬프트에서 선택·미리듣기합니다.">
        <div className="y-admin-tts-registry">
          <EmptyPanel label="tts_voices" error={data.error} />
        </div>
      </CrudSection>
    );
  }
  const sorted = [...data.rows].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const female = sorted.filter((r) => text(r.gender) === "female");
  const male = sorted.filter((r) => text(r.gender) === "male");
  const other = sorted.filter((r) => !["female", "male"].includes(text(r.gender)));
  return (
    <CrudSection
      id="admin-tts-voices"
      title="Cartesia TTS 보이스 등록"
      hint="라벨·성별·Cartesia Voice UUID(external_id)를 관리합니다. 아래 「캐릭터별 프롬프트 — 음성상담형」에서 드롭다운으로 연결합니다."
    >
      <div className="y-admin-tts-registry">
        <div className="y-admin-card y-admin-tts-quick">
          <h4>보이스 추가</h4>
          <form action="/admin/tts-voices" method="post" className="y-admin-form">
            <input name="label" placeholder="표시명 (예: 지현 - 앵커우먼)" />
            <input name="external_id" placeholder="Cartesia Voice UUID" />
            <select name="gender" defaultValue="female">
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타</option>
            </select>
            <input name="sort_order" inputMode="numeric" placeholder="정렬 (작을수록 위)" defaultValue="100" />
            <select name="is_active" defaultValue="true">
              <option value="true">활성</option>
              <option value="false">비활성</option>
            </select>
            <button type="submit">보이스 저장</button>
          </form>
        </div>
        <div className="y-admin-tts-duo">
          <TtsVoiceGroup title="여성 보이스" rows={female} />
          <TtsVoiceGroup title="남성 보이스" rows={male} />
        </div>
        {other.length > 0 ? <TtsVoiceGroup title="기타" rows={other} /> : null}
      </div>
    </CrudSection>
  );
}

function TtsVoiceGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="y-admin-tts-group">
      <h4>{title}</h4>
      {rows.length === 0 ? (
        <p className="y-admin-muted">등록된 보이스가 없습니다.</p>
      ) : (
        rows.map((r) => <TtsVoiceEditor key={text(r.id)} row={r} />)
      )}
    </div>
  );
}

function TtsVoiceEditor({ row }: { row: Row }) {
  return (
    <details className="y-admin-editor mini" suppressHydrationWarning>
      <summary>
        <span>
          <strong>{text(row.label)}</strong>
          <em>sort {text(row.sort_order)}</em>
        </span>
        <span className="y-admin-tts-summary-actions">
          <TtsVoiceListPreview externalId={text(row.external_id, "")} />
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
      <form action="/admin/tts-voices" method="post" className="y-admin-form y-admin-edit-form">
        <input type="hidden" name="id" value={text(row.id, "")} />
        <input name="label" defaultValue={text(row.label, "")} />
        <input name="external_id" defaultValue={text(row.external_id, "")} />
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
        <div className="y-admin-edit-actions">
          <button type="submit">수정 저장</button>
          <button form={`delete-tts-${text(row.id)}`} type="submit" className="y-admin-danger">
            삭제
          </button>
        </div>
      </form>
      <form id={`delete-tts-${text(row.id)}`} action="/admin/tts-voices/delete" method="post">
        <input type="hidden" name="id" value={text(row.id, "")} />
      </form>
    </details>
  );
}

function ReviewEditor({ row, products }: { row: Row; products: Row[] }) {
  return (
    <details className="y-admin-editor y-admin-review-editor" suppressHydrationWarning>
      <summary className="y-admin-review-summary">
        <div className="y-admin-review-head">
          <div className="y-admin-review-avatar">{text(row.user_mask).slice(0, 1)}</div>
          <div className="y-admin-review-meta">
            <strong>{text(row.user_mask)}</strong>
            <span>{text(row.product_slug)}</span>
          </div>
          <StatusPill tone="warn">★ {text(row.stars)}</StatusPill>
        </div>
        <p className="y-admin-review-body">{text(row.body)}</p>
        <div className="y-admin-review-tags">
          {(Array.isArray(row.tags) ? row.tags : text(row.tags).split(/[,\s]+/)).filter(Boolean).map((tag) => (
            <span key={String(tag)}>{String(tag)}</span>
          ))}
        </div>
      </summary>
      <form action="/admin/reviews" method="post" className="y-admin-form y-admin-edit-form">
        <input type="hidden" name="id" defaultValue={text(row.id, "")} />
        <select name="product_slug" defaultValue={text(row.product_slug, "")}>
          {products.map((p) => <option key={text(p.slug)} value={text(p.slug)}>{text(p.title)} ({text(p.slug)})</option>)}
        </select>
        <input name="user_mask" defaultValue={text(row.user_mask, "")} />
        <input name="stars" defaultValue={text(row.stars, "5")} inputMode="numeric" />
        <textarea name="body" defaultValue={text(row.body, "")} />
        <input name="tags" defaultValue={Array.isArray(row.tags) ? row.tags.join(" ") : text(row.tags, "")} />
        <div className="y-admin-edit-actions">
          <button type="submit">수정 저장</button>
          <button form={`delete-review-${text(row.id)}`} type="submit" className="y-admin-danger">삭제</button>
        </div>
      </form>
      <form id={`delete-review-${text(row.id)}`} action="/admin/reviews/delete" method="post">
        <input type="hidden" name="id" value={text(row.id, "")} />
      </form>
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
          {data.rows.slice(0, 8).map((r) => (
            <details key={text(r.id)} className="y-admin-editor mini" suppressHydrationWarning>
              <summary>
                <span>
                  <strong>{text(r.code)}</strong>
                  <em>{text(r.type)} · {text(r.value)} · used {text(r.used_count)}/{text(r.max_uses)}</em>
                </span>
                <StatusPill tone={r.is_active ? "good" : "warn"}>{r.is_active ? "활성" : "비활성"}</StatusPill>
              </summary>
              <form action="/admin/coupons" method="post" className="y-admin-form y-admin-edit-form">
                <input type="hidden" name="id" defaultValue={text(r.id, "")} />
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
                <div className="y-admin-edit-actions">
                  <button type="submit">수정 저장</button>
                  <button form={`delete-coupon-${text(r.id)}`} type="submit" className="y-admin-danger">삭제</button>
                </div>
              </form>
              <form id={`delete-coupon-${text(r.id)}`} action="/admin/coupons/delete" method="post">
                <input type="hidden" name="id" value={text(r.id, "")} />
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function OpsList({
  title,
  data,
  fields,
  table,
  hash = "dashboard",
  statuses = [],
}: {
  title: string;
  data: { rows: Row[]; ready: boolean; error?: string };
  fields: string[];
  table?: string;
  hash?: string;
  statuses?: string[];
}) {
  return (
    <div className="y-admin-card">
      <h3>{title}</h3>
      {!data.ready || data.rows.length === 0 ? (
        <EmptyPanel label={title} error={data.error} />
      ) : (
        <div className="y-admin-mini-list">
          {data.rows.slice(0, 8).map((r, idx) => (
            <div key={`${title}-${idx}`} className="y-admin-mini-row">
              {fields.map((f) => (
                <span key={f}>
                  <em>{f}</em>
                  {f.includes("amount") || f.includes("cost") ? money(r[f]) : text(r[f])}
                </span>
              ))}
              {table && text(r.id, "") ? (
                <form action="/admin/ops-status" method="post" className="y-admin-status-form">
                  <input type="hidden" name="table" value={table} />
                  <input type="hidden" name="id" value={text(r.id, "")} />
                  <input type="hidden" name="hash" value={hash} />
                  <select name="status" defaultValue={text(r.status, statuses[0] ?? "")}>
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button type="submit">상태 저장</button>
                </form>
              ) : null}
            </div>
          ))}
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

