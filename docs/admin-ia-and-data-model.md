# Yeonun 어드민 IA 및 데이터모델

## 1. 운영 IA

### Dashboard
- 오늘 처리해야 할 운영 상태를 한 화면에서 확인.
- 상품/리뷰/결제/점사/음성 세션 KPI.
- Cloudways/Claude/PG 상태 점검 링크.

### Content
- 상품, 카테고리, 캐릭터, 리뷰 CRUD.
- 홈 노출/배지/캐릭터 테마/가격/카테고리 관리.
- SEO용 slug, quote, badge, JSON-LD에 쓰이는 가격 데이터 관리.

### Orders & Payments
- 주문, 결제, 환불, 쿠폰, 웹훅 로그 관리.
- 결제 상태 필터: `pending`, `paid`, `failed`, `refunded`.
- 원본 PG payload 추적.

### Voice Ops
- 음성상담 세션/턴/사용량/에러 확인.
- 캐릭터별 voice/persona/routing 설정.
- 운영자 수동 종료/시간 보정/장애 대응.

### Fortune Ops
- Claude 점사 요청/결과/프롬프트 버전 관리.
- 요청 상태: `queued`, `streaming`, `completed`, `failed`, `retrying`.
- 프롬프트 활성 버전 전환.

### Logs & Settings
- Cloudways 프록시 로그, 웹훅 로그, 관리자 보안 설정.
- 1차는 단일 관리자 쿠키 유지.

## 2. 데이터모델

### 현재 운영 테이블
- `products(slug, title, quote, category_slug, badge, price_krw, character_key)`
- `categories(slug, label, sort_order)`
- `characters(key, name, han, en, spec, greeting)`
- `reviews(id, product_slug, user_mask, stars, body, tags, created_at)`

### 신규 운영 테이블 초안
- `orders(id, order_no, user_ref, product_slug, status, amount_krw, currency, created_at, updated_at)`
- `payments(id, order_id, provider, method, provider_tid, status, paid_at, raw_payload)`
- `refunds(id, payment_id, amount_krw, reason, status, processed_at)`
- `coupons(id, code, type, value, starts_at, ends_at, max_uses, used_count, is_active)`
- `webhook_events(id, provider, event_type, event_id, payload, processed_at, status)`
- `voice_sessions(id, character_key, user_ref, status, started_at, ended_at, duration_sec, cost_krw, summary)`
- `voice_turns(id, session_id, role, text, audio_url, created_at)`
- `voice_usage(id, session_id, provider, input_tokens, output_tokens, audio_seconds, cost_estimate)`
- `fortune_requests(id, user_ref, product_slug, order_id, status, model, prompt_version_id, payload, created_at)`
- `fortune_results(id, request_id, status, html, summary, raw_stream_url, completed_at)`
- `fortune_prompt_versions(id, name, model, system_prompt, schema, is_active, created_at)`

## 3. UI 원칙

- 프론트와 동일한 `var(--y-*)` 색상, 둥근 카드, 얇은 border, 세리프 타이틀을 사용.
- 운영자는 모바일/데스크톱 모두에서 빠르게 처리해야 하므로 480px 모바일 톤을 유지하되 grid는 데스크톱에서 확장.
- 데이터가 없거나 테이블이 아직 없을 때 화면이 깨지지 않고 “스키마 준비 필요”로 표시.

