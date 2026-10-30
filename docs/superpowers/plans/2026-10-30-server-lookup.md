# 서버 중심 단어 조회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Cloudflare Worker가 네이버 백과를 우선 조회하고 결과 없음·한도 초과 때 위키백과로 전환한다.

**Architecture:** 기존 Wikipedia provider를 Worker에서 재사용한다. Worker는 네이버 provider와 순서 결정기를 조합해 공통 `LookupResult`를 반환한다. 확장은 Worker provider로 교체하고 실제 출처를 카드에 표시한다.

**Tech Stack:** TypeScript, WXT, Vitest, Cloudflare Workers, Wrangler

## Global Constraints

- API HUB Client ID·Secret은 Worker Secrets에만 저장한다.
- Worker에는 검색어만 전송하고 주변 문맥은 브라우저에 남긴다.
- 새 조회 흐름은 네이버 우선순위를 지키기 위해 결과를 캐시하지 않는다.
- 사용자에게 보이는 문구는 한국어다.
- 커밋과 푸시는 사용자가 요청할 때만 한다.

---

### Task 1: 결과 계약과 출처 표시

**Files:** `lib/lookup/types.ts`, `lib/messages.ts`, `lib/ui/card.ts`, `tests/unit/ui/card.test.ts`, `tests/unit/messages.test.ts`

**Interfaces:** `FoundResult.source`는 `'naver' | 'wikipedia'`.

- [x] 새 출처 응답을 카드에 넣었을 때 네이버 출처와 링크가 표시되는 실패 테스트를 쓴다.
- [x] `pnpm test -- tests/unit/ui/card.test.ts tests/unit/messages.test.ts`로 예상 실패를 확인한다.
- [x] 결과 타입, 런타임 검증, 출처별 카드 표시를 구현한다.
- [x] 같은 테스트를 통과시킨다.

### Task 2: Worker 조회와 전환

**Files:** `worker/index.ts`, `worker/naver.ts`, `worker/lookup.ts`, `worker/wrangler.jsonc`, `tests/unit/worker/*.test.ts`

**Interfaces:** `createWorkerHandler(env, fetchFn)`은 `Request`를 받아 `Response`를 반환한다. `lookupSources(query, naver, wikipedia)`는 `LookupResult`를 반환한다.

- [x] 네이버 1건, 0건, 429, 5xx, 위키백과 전환, 잘못된 입력에 대한 실패 테스트를 쓴다.
- [x] `pnpm test -- tests/unit/worker`로 예상 실패를 확인한다.
- [x] 네이버 API HUB 호출기, 순서 결정기, HTTP handler를 구현한다. 위키백과 provider를 재사용한다.
- [x] 같은 테스트를 통과시킨다.

### Task 3: 확장 연결과 캐시 분리

**Files:** `entrypoints/background.ts`, `lib/lookup/worker-client.ts`, `lib/lookup/service.ts`, `wxt.config.ts`, `tests/unit/lookup/service.test.ts`, `tests/unit/lookup/worker-client.test.ts`

**Interfaces:** `createWorkerProvider(baseUrl, fetchFn)`은 `LookupProvider`; `createLookupService`는 네이버 결과를 캐시하지 않는다.

- [x] Worker 정상·오류 응답과 출처별 캐시 동작 실패 테스트를 쓴다.
- [x] `pnpm test -- tests/unit/lookup`로 예상 실패를 확인한다.
- [x] background의 provider를 Worker로 교체하고 manifest 권한을 갱신한다.
- [x] 같은 테스트를 통과시킨다.

### Task 4: 공개 문서와 통합 검증

**Files:** `README.md`, `PRIVACY.md`, `docs/store/listing.md`, `e2e/lookup.spec.ts`, `e2e/fixtures.ts`

- [x] Worker 가짜 응답으로 출처별 카드 흐름을 검증한다.
- [x] 전송처, 출처, 한시적 무료와 계정 설정을 문서화한다.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, `pnpm build` 결과를 확인한다.
