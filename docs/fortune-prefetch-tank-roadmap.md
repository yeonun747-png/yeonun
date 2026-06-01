# 메뉴카드 점사 · 서버 Tank 프리페치 로드맵

> PG 결제 중에도 Step6 백그라운드 점사가 끊기지 않도록 한 **아이디어 정리**, **MVP 구현 현황**, **추가 진행 항목** 문서입니다.  
> 관련 커밋: `296f2dd`(Tank MVP), `51db438`(나가기 버튼 `complete` 정규화), `585ed8e`·`c617ad8`(PG → Step7).

---

## 1. 배경 문제

| 상황 | 기존 한계 |
|------|-----------|
| Step6에서 PG(카드·휴대폰) 팝업 | 브라우저가 백그라운드로 가며 **클라이언트 SSE 스트림이 스로틀·중단**될 수 있음 |
| 결제 완료 후 Step7 | 프리페치가 덜 쌓이면 결과·나가기 UI가 오래 잠김 |
| Vercel Serverless | 함수당 **Hobby 300초 / Pro 최대 800초** (장시간 점사는 상한 존재) |
| Cloudways `server.js` | **약 30분** 타임아웃 — 점사 **생성 엔진**용 |

---

## 2. 아이디어 리스트 (검토·논의)

### 2.1 아키텍처 후보

| # | 아이디어 | 요약 | 장점 | 단점 |
|---|----------|------|------|------|
| A | **브라우저 직접 스트림 유지** (`fetchFortuneMenuStream` direct) | Step6에서 클라이언트가 Cloudways/Vercel proxy에 직접 SSE | 구현 단순 | PG·탭 이탈 시 **끊김** |
| B | **Vercel `stream-proxy` drain** (reunionf82 패턴) | 클라이언트 Abort 무시, upstream 끝까지 읽기 | 기존 코드 재사용 | 여전히 **Vercel 함수 시간** 안에서만 동작 |
| C | **서버 Tank + DB 스냅샷 폴링** (채택 MVP) | `prefetch-start` → `after()` drain → `fortune_requests.payload.prefetch_snapshot` → 클라이언트 폴링 | PG 창 열어도 **서버에서 계속 점사** | Vercel 타임아웃(실무상 PG 대기 구간은 보통 문제 없음) |
| D | **Cloudways 전담 장시간 Job** (`/chat/record` 등) | drain·저장을 `server.js`(30분)에서 수행 | **10분+ 장문** 완주 보장 | 배포·운영·`request_id` 콜백 설계 추가 |
| E | **Detached Job 큐** (Redis/DB worker) | Vercel은 enqueue만, 워커가 drain | 확장성 | 인프라·복잡도 증가 |

### 2.2 reunionf82에서 가져온 패턴

- **`stream-proxy`**: 클라이언트 `AbortSignal`을 upstream에 넘기지 않고 Cloudways SSE를 **끝까지 drain**.
- **`fortune_requests`**: 스트리밍 중 `streaming` → 완료 시 `completed` / 실패 시 `failed`.
- **클라이언트 이탈 후 저장**: 프록시가 스트림을 끝까지 읽은 뒤 결과 저장 API 호출(연운은 Tank에서 스냅샷 ingest).

### 2.3 설계 메모 (Tank MVP)

```
Step6 진입 / 생년 제출
  → POST /api/fortune/prefetch-start
  → fortune_requests INSERT (status: streaming, payload.cloudways_upstream)
  → after() → runFortuneServerPrefetchJob (Cloudways /chat SSE drain)
  → payload.prefetch_snapshot 갱신 (FortunePrefetchV1, ~600ms 스로틀)

PG 결제 중 (브라우저)
  → GET /api/fortune/prefetch-snapshot?request_id= (1.2s 폴링)
  → sessionStorage + Step6/7 UI 패치

Step7
  → 기존 fortuneResultFromPrefetch / 실시간 스트림 이어받기
  → result.complete === true 시 나가기·이탈 잠금 해제
```

### 2.4 Vercel vs Cloudways 역할 (결정)

| 레이어 | 역할 |
|--------|------|
| **Vercel** | Tank 시작·DB·결제·폴링·`fortune_requests` / Supabase |
| **Cloudways** | Claude 점사 **생성** (`/chat`), 30분까지 가능 |
| **MVP에서 Vercel Tank를 쓴 이유** | 이미 Next API + DB + PG + 폴링이 한곳에 있어 **연동이 가장 빠름**. PG 수 분 대기 + 일반 점사 길이면 **300~800초로 실무상 충분**하다고 판단. |
| **2단계에서 Cloudways로 옮길 때** | 점사가 자주 5~10분을 넘기거나 Vercel 타임아웃 로그가 보일 때 |

### 2.5 기타 연관 아이디어 (같은 대화 맥락)

- **`order_no`**: Job 재시작 키가 아니라 **결제·주문 링크**용. 프리페치 `request_id`와 별도.
- **브라우저 direct 비활성**: Step6 detached 경로는 서버 Tank 기본 (`NEXT_PUBLIC_FORTUNE_SERVER_PREFETCH=0` 시 레거시 클라이언트 스트림 폴백).
- **나가기 버튼**: `result.complete` + `inferFortunePrefetchComplete`(SSE `done` 없이 본문만 채워진 경우 보정).
- **음성 상담(캐릭터 시트)**: 바텀시트 위 `router.push` 대신 **`window.location.assign('/call-dcc')`** + 백드롭 스냅샷 제거.

---

## 3. MVP로 실행한 것 (구현 완료)

### 3.1 서버 Tank 프리페치

| 항목 | 경로 / 설명 |
|------|-------------|
| Job 시작 | `POST /api/fortune/prefetch-start` — `maxDuration: 800`, `after(runFortuneServerPrefetchJob)` |
| 스냅샷 조회 | `GET /api/fortune/prefetch-snapshot?request_id=` |
| Cloudways upstream | `src/lib/fortune-menu-stream-upstream.ts` |
| SSE 파싱 공용 | `src/lib/fortune-prefetch-sse-engine.ts` |
| 스트림 body 빌드 | `src/lib/fortune-prefetch-stream-body.ts` |
| 서버 drain·DB | `src/lib/fortune-server-prefetch.ts` |
| 클라이언트 폴링 | `src/lib/fortune-prefetch-runner.ts` (기본 서버 Tank, 실패 시 브라우저 스트림 폴백) |
| 스토리지 | `fortune_requests.payload.prefetch_snapshot`, `sessionStorage` `yeonun_fortune_server_request_{slug}` |
| 비활성화 | `NEXT_PUBLIC_FORTUNE_SERVER_PREFETCH=0` |

### 3.2 PG · 메뉴카드 플로우 (동일 기간)

- 포춘82 PG (reunionf82 패턴): `payment_code` 1000~ / 크레딧 9001~9003.
- Step6 PG → storage 브리지 → Step7 자동 전환 (`payment-pg-flow`, `FortunePage` 핸들러 고정).
- 결제 팝업 중에도 **prefetch는 abort하지 않음**.

### 3.3 Step7 나가기 버튼 (`51db438`)

- **원인**: DB `status: completed`인데 `prefetch_snapshot.complete === false` (SSE `done` 미수신).
- **수정**: `inferFortunePrefetchComplete` / `normalizeFortunePrefetchSnapshot` — 전 섹션 HTML 채워지면 완료 처리.

### 3.4 UX (동일 커밋 묶음)

- 홈 캐릭터 시트 → 음성 상담: `MeetCallButton` `fullPageTransition`, `clearSheetBackdropSnapshot`.

---

## 4. 아직 하지 않은 것 · 추가 진행

### 4.1 우선순위 높음

| # | 항목 | 설명 |
|---|------|------|
| 1 | **E2E 검증** | Step6 PG → Step7, PG 창 열린 채 `prefetch-snapshot` 증가, 완료 후 나가기·헤더 백 활성 |
| 2 | **`request_id` ↔ `order_id` 연결** | `prefetch-start`/`payment/complete` 시 동일 `fortune_requests` 행으로 묶기 (현재 결제 완료 시 **별도 queued 행** 생성 가능) |
| 3 | **프로덕션 모니터링** | `fortune_requests` `streaming` 장시간 체류, `prefetch_error`, Vercel function timeout 로그 |

### 4.2 2단계 (장시간·안정성)

| # | 항목 | 설명 |
|---|------|------|
| 4 | **Cloudways 전담 drain** | Vercel은 start만, `server.js`에서 SSE 끝까지 + DB/웹훅 ingest (30분 활용) |
| 5 | **`/chat/record` 또는 전용 worker 라우트** | Vercel 800초를 넘는 상품·궁합 장문 대비 |
| 6 | **끊김 시 재개** | timeout 후 `request_id`로 worker 재시작 또는 이어받기 (부분 스냅샷 + `last_section_index`) |
| 7 | **`POST /api/fortune/prefetch-abort`** | 사용자 취소 시 서버 job 정리 (선택) |

### 4.3 개선·정리

| # | 항목 | 설명 |
|---|------|------|
| 8 | **direct 스트림 완전 제거** | Step6 detached에서 `fetchFortuneMenuStream` direct 경로 정리 (폴백만 유지할지 정책 결정) |
| 9 | **어드민 Ops** | `fortune_requests` Tank 상태·`prefetch_snapshot` 크기·실패 사유 대시보드 |
| 10 | **서버 지갑 CS** | 별도 스레드 — 어드민 크레딧 조정이 유저 기기에 반영되도록 (로컬 지갑 한계) |

### 4.4 알려진 제약 (의도적)

- Vercel `after()`는 **같은 invocation** 안에서 `maxDuration` 적용 (별도 무제한 워커 아님).
- Hobby **300초**, Pro **최대 800초** — PG 대기만으로는 보통 무관, **초장문 점사**만 Cloudways 이전 검토.
- 브라우저 **백그라운드 탭 스로틀**은 서버 Tank로 우회; 클라이언트 폴백 경로만 해당.

---

## 5. 환경 변수 · 운영 체크리스트

```env
# Tank 끄기 (로컬 디버그·레거시 스트림)
NEXT_PUBLIC_FORTUNE_SERVER_PREFETCH=0

# 기존 Cloudways (Tank upstream)
CLOUDWAYS_FORTUNE_URL / CLOUDWAYS_URL / NEXT_PUBLIC_CLOUDWAYS_URL
CLOUDWAYS_PROXY_SECRET
```

배포 후 확인:

1. Network: `prefetch-start` → `prefetch-snapshot` 폴링
2. Supabase: `fortune_requests.status` `streaming` → `completed`, `payload.prefetch_snapshot.complete`
3. Step7: 마지막 파트에서 **나가기** 링크 활성

---

## 6. 참고 문서·파일

| 문서/코드 | 내용 |
|-----------|------|
| `docs/cloudways-proxy-role-and-yeonun-apply.md` | Cloudways vs Vercel 역할 |
| `docs/reunionf82-reference.md` | PG·결제 참고 |
| `src/app/api/fortune/stream-proxy/route.ts` | reunionf82형 SSE proxy (Step7 실시간용) |
| `cloudways-claude-fortune-server/server.js` | Cloudways 점사 엔진 |

---

*마지막 갱신: 2026-05-17 (커밋 `51db438` 기준)*
