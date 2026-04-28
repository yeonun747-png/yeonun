# Yeonun 운영요소 인벤토리

이 문서는 현재 프론트에 구성된 UI/기능을 기준으로, 실제 운영 요소와 목업/스텁 요소를 분리한 운영 인벤토리입니다.

## 1. 운영 요소로 확정되는 영역

### 홈/탐색
- `/` (`src/app/page.tsx`)
  - `TopNav`, `HomeHero`, `CharacterCarousel`, `HomeMoreSections`, `BottomNav`로 구성.
  - `HomeMoreSections`는 Supabase `products`, `reviews`를 조회해 홈 상품/후기 섹션에 주입.
  - 운영 성격: 홈 랜딩, 캐릭터 유입, 상품 상세 유입.
- `/meet` (`src/app/meet/page.tsx`)
  - Supabase `characters`를 조회해 음성상담 카드 표시.
  - 운영 성격: 상담자 선택/음성상담 유입.
- `/content` (`src/app/content/page.tsx`)
  - Supabase `categories`, `products` 조회.
  - 운영 성격: 전체 풀이 상품 목록.
- `/content/[slug]` (`src/app/content/[slug]/page.tsx`)
  - Supabase `products`, `reviews` 조회.
  - `?sheet=1`일 때 상세풀이 바텀시트로 렌더링.
  - JSON-LD Product/AggregateRating 구조 포함.
- `/characters/[key]` (`src/app/characters/[key]/page.tsx`)
  - Supabase `characters`, `products`, `reviews` 조회.
  - `?sheet=1&from=home|meet`으로 캐릭터 상세 바텀시트 렌더링.

### 데이터 연동
- Supabase 서버 클라이언트
  - `src/lib/supabase/server.ts`
  - `src/lib/supabase/client.ts`
  - `src/lib/env.ts`
- 운영 테이블로 사용 중인 테이블
  - `categories`: `slug`, `label`, `sort_order`
  - `products`: `slug`, `title`, `quote`, `category_slug`, `badge`, `price_krw`, `character_key`
  - `characters`: `key`, `name`, `han`, `en`, `spec`, `greeting`
  - `reviews`: `id`, `product_slug`, `user_mask`, `stars`, `body`, `tags`, `created_at`

### 어드민/보호
- `/admin/login` (`src/app/admin/login/page.tsx`)
  - 단일 관리자 비밀번호 입력 UI.
- `/admin/login/action` (`src/app/admin/login/action/route.ts`)
  - 관리자 쿠키 `yeonun_admin=1` 발급.
- `/admin` (`src/app/admin/page.tsx`)
  - 현재 상품 추가/삭제 및 목록 확인 중심.
- 보호 로직
  - `src/proxy.ts`
  - `/admin/:path*` 보호, `/admin/login` 예외.

### 공개 API
- `/api/products` (`src/app/api/products/route.ts`)
  - 상품 목록 API.
- `/api/characters` (`src/app/api/characters/route.ts`)
  - 캐릭터 목록 API.

## 2. UI는 있으나 스텁/미완성인 영역

### 결제
- 전역 결제 모달
  - `src/components/modals/PaymentModal.tsx`
  - UI는 주문상품/결제수단/약관/결제버튼으로 구성되어 있으나 실제 PG 요청, 승인 검증, 결제 저장, 실패 처리 없음.
- 결제 관련 페이지
  - `/checkout/credit`, `/checkout/credit/payment`, `/my/payments`
  - 운영 결제 데이터와 직접 연결되지 않은 표시/유도 UI 성격.

### 인증/온보딩
- `src/components/modals/AuthModal.tsx`, `/auth`
  - 카카오/네이버/구글 버튼과 사주 입력 온보딩 UI는 있으나 실제 OAuth/Supabase Auth 연동 없음.

### 음성상담
- `/call` (`src/app/call/page.tsx`)
  - 목업 기반 상담 화면/종료 화면.
  - 실시간 음성 스트리밍, STT/TTS, 상담 세션 저장, 과금 차감은 미구현.
- `/history/calls`, `/history/chats`
  - 실제 세션 데이터 연결 전 운영 히스토리 스텁.

### LLM 점사
- 현재 `yeonun`에는 Claude 스트리밍 점사 API/프록시/결과 저장 테이블이 없음.
- 상세풀이 구매 후 결과 생성/저장 플로우는 미구현.

### 통계/후기 수치
- 홈 누적 수치, 재회 적중률, 일부 카운트는 고정 표시 성격.
- 운영 전환 시 `orders`, `fortune_results`, `reviews` 집계 기반으로 전환 필요.

### 기타 정보 페이지
- `/search`, `/today`, `/library`, `/notices`, `/settings/notifications`, `/partner`, `/support`, `/company/about`, `/legal/*`
  - 운영 화면 구조는 있으나 대부분 정적 정보/목업 기능.

## 3. 운영 전환에 필요한 추가 테이블

### 결제/주문
- `orders`
  - `id`, `order_no`, `user_ref`, `product_slug`, `status`, `amount_krw`, `currency`, `created_at`, `updated_at`
- `payments`
  - `id`, `order_id`, `provider`, `method`, `provider_tid`, `status`, `paid_at`, `raw_payload`
- `refunds`
  - `id`, `payment_id`, `amount_krw`, `reason`, `status`, `processed_at`
- `coupons`
  - `id`, `code`, `type`, `value`, `starts_at`, `ends_at`, `max_uses`, `used_count`, `is_active`
- `webhook_events`
  - `id`, `provider`, `event_type`, `event_id`, `payload`, `processed_at`, `status`

### 음성상담
- `voice_sessions`
  - `id`, `character_key`, `user_ref`, `status`, `started_at`, `ended_at`, `duration_sec`, `cost_krw`, `summary`
- `voice_turns`
  - `id`, `session_id`, `role`, `text`, `audio_url`, `created_at`
- `voice_usage`
  - `id`, `session_id`, `provider`, `input_tokens`, `output_tokens`, `audio_seconds`, `cost_estimate`

### LLM 점사
- `fortune_requests`
  - `id`, `user_ref`, `product_slug`, `order_id`, `status`, `model`, `prompt_version_id`, `payload`, `created_at`
- `fortune_results`
  - `id`, `request_id`, `status`, `html`, `summary`, `raw_stream_url`, `completed_at`
- `fortune_prompt_versions`
  - `id`, `name`, `model`, `system_prompt`, `schema`, `is_active`, `created_at`

## 4. 운영 우선순위

1. 상품/카테고리/캐릭터/리뷰 운영 CRUD 안정화.
2. 결제/주문/웹훅 저장 및 관리자 확인 기능.
3. Claude 점사 요청/스트리밍/결과 저장.
4. 음성상담 세션/턴/사용량 관리.
5. 수치/통계를 실제 DB 집계로 전환.

