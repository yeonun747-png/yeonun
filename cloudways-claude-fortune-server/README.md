# Cloudways Claude 점사 스트림 서버

Vercel 타임아웃을 피하기 위해 Cloudways에서 장시간 실행하는 **Anthropic Claude** 전용 프록시입니다. 연운 Next의 `POST /api/fortune/chat-stream`이 여기 `POST /chat`으로 본문을 넘기면, 동일 SSE 형식(`start` → `chunk` → `done`)으로 브라우저까지 스트리밍합니다.

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 예 | Anthropic API 키 |
| `PORT` | 아니오 | 기본 `3000` |
| `CLOUDWAYS_PROXY_SECRET` | 아니오 | 설정 시 `Authorization: Bearer …` 일치 요청만 허용 |
| `FORTUNE_CLOUDWAYS_MODEL` | 아니오 | 기본 `claude-sonnet-4-6` (만남 음성과 동일 계열) |
| `FORTUNE_MAX_OUTPUT_TOKENS` | 아니오 | 기본 `16384` |
| `FORTUNE_TEMPERATURE` | 아니오 | 기본 `0.7` |

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
