# Cloudways Claude 점사 스트림 서버

Vercel의 함수 한도를 넘기는 **긴 단일 스트림**은 Cloudways에서 받는 편이 유리합니다. 이 서버는 **Anthropic Claude** 프록시이며, **메뉴 점사** 요청에서 모델 id가 `gemini-*`이면 **Google Gemini**(`streamGenerateContent`, SSE)로 섹션 HTML을 **토큰 단위로 스트리밍**해 Claude와 동일한 `chunk` 이벤트를 보냅니다. Nginx에서 보통 **30분(1800s)** 까지 `proxy_read_timeout` / `proxy_send_timeout` 을 둡니다. 연운 Next의 `POST /api/fortune/chat-stream`이 여기 `POST /chat`으로 본문을 넘기면, 동일 SSE 형식(`start` → `chunk` → `done`)으로 브라우저까지 스트리밍합니다.

참고: 연운 `POST /api/fortune/chat-stream-menus`는 Next에서 **한 번** `POST /chat`으로 `fortune_menu_*` 본문을 넘기고, **섹션 루프·Claude 호출은 이 Node에서** 수행한 뒤 SSE를 그대로 이어 줍니다 (reunion `stream-proxy`와 같은 우회 패턴). Nginx 추가 없이 기존 `location /chat`만 사용합니다.

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 조건부 | Claude 사용 시 필수. 메뉴 점사만 Gemini로 쓰는 경우 비메뉴 `/chat`·Claude 경로는 여전히 필요할 수 있음 |
| `GEMINI_API_KEY` 또는 `GOOGLE_AI_API_KEY` | 조건부 | 메뉴 점사에서 `gemini-2.5-pro` 등 Gemini 모델 사용 시 필수 |
| `GEMINI_MENU_CACHE_TTL` | 아니오 | 섹션 루프 모드에서만: `cachedContents` TTL(기본 `600s`) |
| `GEMINI_MENU_SINGLE_STREAM` | 아니오 | Gemini 메뉴: 기본 `1` = 한 번의 stream + 마커 샤딩(reunionf82 유사). `0` = 소제목별 순차 요청 + 캐시 |
| `FORTUNE_MENU_SINGLE_PASS_BATCH_SIZE` | 아니오 | 15구간 초과 시 단일 패스를 몇 구간씩 나눌지(기본 **10**). 30구간·5만자 상품 후반 `섹션 N` 실패 방지 |
| `PORT` | 아니오 | 기본 `3000` |
| `CLOUDWAYS_PROXY_SECRET` | 아니오 | 설정 시 `Authorization: Bearer …` 일치 요청만 허용 |
| `FORTUNE_CLOUDWAYS_MODEL` | 아니오 | 기본 `claude-sonnet-4-6` (만남 음성과 동일 계열) |
| `FORTUNE_MAX_OUTPUT_TOKENS` | 아니오 | **섹션별 루프** 기본 `16384` (hard cap `FORTUNE_MAX_TOKENS_HARD_CAP` 기본 24000) |
| `FORTUNE_TEMPERATURE` | 아니오 | 기본 `0.7` (단일 패스·섹션 루프 공통) |
| `FORTUNE_MENU_SINGLE_PASS_MAX_OUTPUT_TOKENS` | 아니오 | **단일 패스(마커 샤딩)** 출력 상한. 기본 **65536** (reunionf82와 동일). temperature는 0.7 유지 |

## 요청 본문 (`POST /chat`)

```json
{
  "system": "…",
  "user": "…",
  "model": "claude-sonnet-4-6",
  "max_tokens": 16384,
  "temperature": 0.7,
  "order_no": "optional"
}
```

`system` / `user`는 연운 API에서 조립해 전달합니다.

### 메뉴 점사(다구간) — 동일 `POST /chat`

본문에 `fortune_menu_sections`( `{ system, user, subtitle_title? }[]` ), `fortune_menu_meta`( `type: "meta"` ), `fortune_menu_toc`( `type: "toc"`, `sections`, `toc_groups` )가 있으면 단일 스트림이 아니라 **메뉴 SSE 계약**(`section_start` → `chunk` → `section_replace` → `section_end` → `done`)으로 응답합니다. 연운 프로덕션은 `chat-stream-menus` API가 이 형식으로만 호출합니다. **모델**은 본문 `model`로 전달되며, `gemini-2.5-pro` 등이면 Gemini 스트림(`chunk` 델타)을 사용하고, 그 외는 Claude 스트림입니다.

Gemini이면서 **`fortune_menu_cached_system`(블록 배열)** 이 있고 `GEMINI_MENU_SINGLE_STREAM`이 끄지 않았으면(기본 켜짐), **한 번의** `streamGenerateContent`(**maxOutputTokens 65536**, **temperature 0.7**)로 전체를 받은 뒤 `<!-- YEONUN_SEC:n -->` … `<!-- /YEONUN_SEC:n -->` 마커로 잘라 **기존과 동일한** `section_start` / `chunk` / `section_replace` / `section_end` 이벤트를 보냅니다(reunionf82 방식 + 연운 UI 유지). `GEMINI_MENU_SINGLE_STREAM=0`이면 **섹션 루프**로 돌아가며, 이때는 `cachedContents`로 공통 system을 캐시해 2번째 소제목부터 TTFT를 줄입니다.

체감: **단일 스트림**은 소제목 **사이**에 새 HTTP/TTFT가 없어 reunionf82에 가깝게 이어집니다.

**30구간·5만자급 후반 `이 구간 생성에 실패` / `섹션 29`:** Vercel 300초가 아니라, **한 번의 응답 출력 한도(약 65k 토큰)** 안에 마커(`<!-- YEONUN_SEC:n -->`)가 끝까지 안 쓰이면 Cloudways 샤더가 남은 구간을 실패 블록으로 채웁니다. 연운은 **10구간 단위 배치** + 누락 구간 **소제목별 1회 재시도**로 보완합니다. 그래도 문제면 `GEMINI_MENU_SINGLE_STREAM=0`(섹션 루프) 또는 `FORTUNE_MENU_SINGLE_PASS_BATCH_SIZE=8` 을 낮춰 보세요.

## Nginx (지원팀 설정과 맞춤)

공개 도메인은 **스킴+호스트만** 연운 환경 변수에 넣습니다. 예: `https://phpstack-1569797-6109694.cloudwaysapps.com` (끝 `/` 없음, **`/chat` 붙이지 않음**).

지원팀이 아래처럼 두면, 브라우저·Vercel은 **`https://호스트/chat`** 으로만 Node에 도달합니다.

```nginx
location /chat {
    proxy_pass http://localhost:3000/chat;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}
```

연운 `POST /api/fortune/chat-stream` → Cloudways **`POST {베이스URL}/chat`** → 위 프록시 → Node `POST /chat`.

**접두 `location /chat` 주의:** `/chat`으로 시작하는 모든 경로(예: `/chat/voice/...`)가 같은 `location`에 걸릴 수 있습니다. 음성 라이브 등이 **다른 백엔드**면 지원팀에 **`location = /chat`(정확히 `/chat`만)** 또는 **`/chat/voice/` 전용 `location`** 을 요청해야 합니다. 점사 전용 Node(`fortune-claude`)에는 `/chat/voice/*` 라우트가 없습니다.

## 배포

1. Cloudways에 Node 앱으로 배포하고 `npm install` 후 `node server.js` (또는 PM2)로 기동합니다.
2. 연운 `.env` / Vercel에 `CLOUDWAYS_FORTUNE_URL` 또는 `CLOUDWAYS_URL` 또는 `NEXT_PUBLIC_CLOUDWAYS_URL`에 **위와 같은 원점 URL만** 넣습니다.
3. `CLOUDWAYS_PROXY_SECRET`을 양쪽에 동일 값으로 넣으면 Bearer로 서버 간 인증합니다.

## 헬스

`GET /health` → `{ "status": "ok", "engine": "claude", ... }`
