# reunionf82 참고 모듈 분석

`C:\Users\goric\reunionf82` 프로젝트에서 Yeonun에 참조할 음성대화, PG결제, LLM 점사, Cloudways 프록시 구조를 정리한 문서입니다.

## 1. PG 결제 흐름

### 핵심 파일
- `app/api/payment/request/route.ts`
- `app/api/payment/save/route.ts`
- `app/api/payment/status/route.ts`
- `app/api/payment/wait-status/route.ts`
- `app/api/payment/callback/route.ts`
- `lib/payment-utils.ts`
- `lib/payment-event-log.ts`

### 동작 구조
1. 클라이언트가 `/api/payment/request`로 결제 요청 데이터를 전달.
2. 서버가 `oid`를 생성하거나 클라이언트 전달값을 사용.
3. 결제수단에 따라 외부 결제 URL을 선택.
   - 카드: `https://www.fortune82.com/api/payment/reqcard.html`
   - 휴대폰: `https://www.fortune82.com/api/payment/reqhp.html`
4. 성공/실패 URL을 생성해 결제사 formData에 포함.
5. `/api/payment/save`에서 `payments` 테이블에 `pending/success/failed` 상태를 upsert.
6. `oid` 기준으로 중복 저장을 방지하고, UNIQUE 제약이 없을 때는 select/update/insert로 우회.
7. `callback` 라우트는 `X-Portal-Signature`, `X-Portal-Timestamp`로 포털 콜백 검증 구조를 갖고 있음.

### Yeonun 반영
- `orders`와 `payments`를 분리한다.
- 결제 버튼은 바로 PG를 호출하지 않고 `order_no` 생성 후 결제 요청으로 이동한다.
- 모든 결제 이벤트는 `webhook_events` 또는 `payment_events`에 원본 payload로 저장한다.
- 관리자에서 `pending`, `paid`, `failed`, `refunded` 필터와 원본 로그 확인을 제공한다.

## 2. LLM 점사 스트리밍

### 핵심 파일
- `app/api/jeminai/stream-proxy/route.ts`
- `app/api/jeminai/route.ts`
- `app/api/fortune-complete/save/route.ts`
- `cloudways-server.js`
- `cloudways-html-safety.js`
- `cloudways-streaming-config.js`

### 동작 구조
1. Vercel API는 `requestKey`만 받는다.
2. `temp_requests`에서 실제 payload를 조회한다.
3. Vercel API가 Cloudways `/chat`으로 요청을 전달한다.
4. Cloudways는 장시간 LLM 스트림을 처리한다.
5. Vercel API는 Cloudways 스트림을 그대로 클라이언트에 전달한다.
6. 클라이언트가 이탈해도 Vercel API는 Cloudways 스트림을 끝까지 읽고, 종료 후 `/api/fortune-complete/save`로 저장한다.
7. 저장 라우트는 결과 HTML을 `saved_results`에 저장하고 `payments`, `user_credentials`, `temp_requests` 상태를 갱신한다.

### Yeonun 반영
- Gemini 대신 Claude 4.6 Sonnet 스트리밍 프록시를 사용한다.
- Vercel Route Handler는 짧은 검증/중계만 맡긴다.
- 장시간 점사 생성, 2차 요청, HTML 안전 경계는 Cloudways 서버가 담당한다.
- `fortune_requests`, `fortune_results`, `fortune_prompt_versions`를 중심으로 상태를 관리한다.

## 3. 음성대화 모듈

### 핵심 파일
- `components/voice-mvp/VoiceMvpSessionLiveClient.tsx`
- `app/api/voice-mvp/sessions/route.ts`
- `app/api/voice-mvp/sessions/[id]/turn/route.ts`
- `pages/api/voice-mvp/live-proxy.ts`
- `scripts/vertex-live-proxy-server.js`
- `lib/voice-mvp/genai-live/*`
- `app/api/voice/deepgram-token/route.ts`
- `app/api/voice/cartesia-preview/route.ts`

### 동작 구조
1. 세션 생성 API가 `voice_mvp_sessions`에 상담 세션을 생성.
2. 생성 시 만세력 번들, 상담 모드, 상담자 페르소나, 음성 설정 스냅샷을 저장.
3. 텍스트 턴 API는 최근 대화, 세션 설정, 만세력 데이터를 읽어 LLM 응답을 생성하고 메시지 테이블에 저장.
4. Live 클라이언트는 브라우저 오디오 녹음/재생을 처리.
5. WebSocket 프록시는 Gemini Live / GPT Realtime / xAI / Hume 등으로 연결 가능하도록 추상화.
6. Cloudways/Node 프록시는 Vercel의 WebSocket/장시간 연결 한계를 우회한다.

### Yeonun 반영
- `/call`은 현재 목업 UI이므로 `voice_sessions`, `voice_turns`, `voice_usage`와 연결해야 한다.
- 캐릭터별 음성/페르소나/상담 스타일을 관리자에서 조정 가능하게 한다.
- 실시간 음성은 Cloudways WebSocket 프록시를 두고, Next.js는 세션 생성/상태조회/관리만 담당한다.

## 4. 관리자 참고 구조

### 핵심 파일
- `app/admin/page.tsx`
- `components/AdminForm.tsx`
- `components/voice-mvp/admin/VoiceMvpAdminClient.tsx`
- `app/api/admin/payments/stats/route.ts`
- `app/api/admin/voice/*`
- `app/api/admin/content/*`

### Yeonun 반영
- 현재 Yeonun의 `/admin`은 상품 추가/삭제 수준이므로, 운영 메뉴를 분리해야 한다.
- 1차 인증은 단일 쿠키를 유지하되, 모든 관리자 API는 `/admin` 보호 규칙과 동일한 기준을 가져야 한다.
- 프론트와 같은 심미적 디자인 토큰을 쓰되 운영 화면은 정보 밀도와 필터/상태 뱃지를 강화한다.

## 5. 주의점

- reunionf82 일부 라우트는 `TODO`, 원문 개인정보 저장, 레거시 환경변수 fallback이 남아 있다.
- Yeonun 반영 시 개인정보/생년월일/음성 데이터는 암호화 또는 최소 저장 원칙이 필요하다.
- Cloudways CORS `origin: *`는 운영에서 Yeonun 도메인으로 제한해야 한다.
- LLM 결과 HTML 저장 시 sanitize/allowed tags 정책이 필요하다.
- 결제 콜백/웹훅은 HMAC 검증과 idempotency key가 필수다.

