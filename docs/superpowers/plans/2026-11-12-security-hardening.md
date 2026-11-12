# 보안 보완 구현 계획

**Goal:** 공개 Worker 요청의 자원 사용을 제한하고 카드의 외부 링크와 개발 의존성을 검증한다.

**Architecture:** 본문을 바이트 한도까지 읽는 작은 공통 함수를 Worker 두 경로에 적용한다. 출처별 URL 검증은 카드 원문 링크를 생성하기 전에 수행하고 네이버 제공자에서도 같은 호스트를 검사한다.

**Tech Stack:** TypeScript, WXT, Cloudflare Workers, Vitest, pnpm

## Global Constraints

- 기존 공개 API의 JSON 형식과 잘못된 입력의 400 응답을 유지한다.
- 사용자에게 보이는 문구는 한국어로 쓴다.
- 커밋과 배포는 하지 않는다.

### Task 1: Worker 요청 본문 제한

**Files:** `worker/body.ts`, `worker/index.ts`, `worker/telemetry.ts`, `tests/unit/worker/index.test.ts`, `tests/unit/worker/telemetry.test.ts`

- [x] 스트림 본문이 한도를 넘으면 본문 전체를 읽기 전에 거부되는 실패 테스트를 작성한다.
- [x] 요청 제한이 본문 소비 전에 실행되는 실패 테스트를 작성한다.
- [x] 테스트 실패를 확인한다.
- [x] 스트림 본문 읽기 함수와 두 경로 적용을 구현한다.
- [x] 관련 테스트를 통과시킨다.

### Task 2: 원문 URL 검증

**Files:** `lib/ui/card.ts`, `worker/naver.ts`, `tests/unit/ui/card.test.ts`, `tests/unit/worker/naver.test.ts`

- [x] 잘못된 원문 호스트와 스킴을 클릭할 수 없게 하는 실패 테스트를 작성한다.
- [x] 네이버 제공자가 다른 호스트를 거부하는 실패 테스트를 작성한다.
- [x] 테스트 실패를 확인한다.
- [x] 출처별 URL 허용 목록을 적용하고 관련 테스트를 통과시킨다.

### Task 3: 개발 의존성 보완 및 최종 검증

**Files:** `package.json`, `pnpm-lock.yaml`

- [x] 상위 개발 패키지의 호환 업데이트 가능 여부를 확인한다.
- [x] 보안 권고가 사라지도록 가장 작은 호환 변경을 적용한다.
- [x] `pnpm audit`, `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`를 실행한다.
- [x] 변경 파일과 문서 설명을 확인한다.
