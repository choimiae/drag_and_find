# 확장 사용량 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단어 조회 기능을 실제로 사용한 설치 수와 조회 성공·실패 건수를 관리자 화면에 표시한다.

**Architecture:** 확장 백그라운드가 조회 완료 이벤트를 공개 조회 Worker에 보내고, Worker가 Secret을 사용해 GA4 Measurement Protocol로 전달한다. 관리자 Worker는 GA4 Data API의 집계만 읽는다. 검색어와 방문 URL은 이벤트에 포함하지 않는다.

**Tech Stack:** WXT, TypeScript, Cloudflare Workers, GA4 Measurement Protocol/Data API, Vitest, Playwright.

## Global Constraints

- 설치별 ID는 고유한 사람 수가 아니며, 화면과 개인정보 처리방침에 이 한계를 명시한다.
- 이벤트는 조회 결과를 기다리게 하거나 실패시키지 않는다.
- 이벤트는 식별자·이벤트 이름·확장 버전만 허용한다. 검색어·URL·페이지 문맥·결과 텍스트는 금지한다.
- 새 확장 버전 배포 이후부터만 사용량 집계가 시작된다.
- 커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 한다.

---

### Task 1: 확장 이벤트 송신

**Files:**
- Create: `lib/analytics/client.ts`
- Modify: `entrypoints/background.ts`
- Test: `tests/unit/analytics/client.test.ts`, `tests/unit/analytics/background.test.ts`

**Interfaces:**
- Produces: `recordLookupOutcome(result: LookupResult): Promise<void>`; client sends `{ clientId, event: 'lookup_completed' | 'lookup_failed', version }` to `POST /telemetry`.
- Consumes: `chrome.storage.local`, `browser.runtime.getManifest().version`, existing lookup message handler result.

- [ ] **Step 1: Write failing tests** for stable generated ID, found/not_found/error event mapping, one event after Worker fallback, and ignored network failure.
- [ ] **Step 2: Run** focused Vitest files; expected module or behavior failure.
- [ ] **Step 3: Implement** a storage-backed random client ID and fire-and-forget event after sending the lookup response. Never put the query or sender URL into the event payload.
- [ ] **Step 4: Run** focused tests and E2E; expected unchanged card behavior and one telemetry request per lookup.

### Task 2: 공개 Worker 수신과 GA4 전달

**Files:**
- Create: `worker/telemetry.ts`
- Modify: `worker/index.ts`, `worker/wrangler.jsonc`
- Test: `tests/unit/worker/telemetry.test.ts`, `tests/unit/worker/index.test.ts`

**Interfaces:**
- Produces: `handleTelemetry(request, env, fetchFn): Promise<Response>`.
- Consumes: `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` Worker Secrets and valid `{ clientId, event, version }` body.

- [ ] **Step 1: Write failing tests** for allowlisted fields, wrong method, oversized body, malformed ID/event/version, rate limit, GA4 timeout and successful forwarding.
- [ ] **Step 2: Run** focused tests; expected failure.
- [ ] **Step 3: Implement** strict validation and rate limiting, forward only allowlisted values to GA4, return a small status response with no secret or source content. Keep `/lookup` and `/english-context` behavior unchanged.
- [ ] **Step 4: Run** focused tests; expected pass.

### Task 3: GA4 report and screen

**Files:**
- Create: `admin/src/ga4.ts`
- Modify: `admin/src/api.ts`, `admin/src/main.ts`, `admin/src/types.ts`, `admin/wrangler.jsonc`
- Test: `tests/unit/admin/ga4.test.ts`, `tests/unit/admin/ui.test.ts`

**Interfaces:**
- Produces: `getUsageMetrics(env, days, fetchFn)` returning unique install estimate, completed count, failed count and daily series.
- Consumes: GA4 Data API `runReport`, `GA4_PROPERTY_ID`, read-only service-account credentials.

- [ ] **Step 1: Write failing tests** for signed-token acquisition, GA4 report parsing, missing credentials, empty report, and display of approximate install count.
- [ ] **Step 2: Run** focused tests; expected failure.
- [ ] **Step 3: Implement** server-side GA4 report adapter and connect it to the existing dashboard response. Keep service-account material in Secrets only; show `연결 필요` until configured.
- [ ] **Step 4: Run** focused tests and `pnpm admin:build`; expected pass.

### Task 4: 고지와 최종 검증

**Files:**
- Modify: `README.md`, `PRIVACY.md`, `docs/store/listing.md`, `docs/admin/SETUP.md`

**Interfaces:**
- Documents: event names, install ID, storage duration, destination, no query/URL transfer, start date and reporting limitations.

- [ ] **Step 1: Update** all four documents and Chrome Web Store data-use guidance before producing a release ZIP.
- [ ] **Step 2: Run** `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, `pnpm admin:build`; expected all pass.
- [ ] **Step 3: Verify** production GA4 event delivery and dashboard reports separately from mocked tests after credentials are configured. Do not treat a local mock as evidence of live collection.
