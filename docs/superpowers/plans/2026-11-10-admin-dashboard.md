# 관리자 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** maestro가 한 주소에서 Chrome Web Store와 Cloudflare Worker 통계 및 실시간 조회 상태를 확인한다.

**Architecture:** 새 `admin/`에 정적 대시보드와 읽기 전용 API를 둔 Cloudflare Worker를 만든다. Cloudflare Access가 Worker 전체를 보호하며 API는 저장소에 없는 Secret으로 외부 통계를 조회한다. 확장과 공개 조회 Worker의 동작은 이 단계에서 변경하지 않는다.

**Tech Stack:** Node 22, pnpm 12, TypeScript, Vite 8, Vitest 5, Cloudflare Workers/Wrangler 4.

## Global Constraints

- UI는 `docs/superpowers/specs/2026-11-10-admin-dashboard-design.md`의 한 페이지 구성과 확장 카드 색 세트를 따른다.
- 시안 수치는 실제 데이터로 표시하지 않으며 연결되지 않은 출처는 `연결 필요`로 표시한다.
- Chrome Web Store는 게시자에게 등록한 서비스 계정의 `chromewebstore.readonly`, Cloudflare는 `Account Analytics: Read` 권한만 사용한다.
- Secret은 저장소, 클라이언트 응답, 로그에 넣지 않는다.
- 커밋·푸시·배포는 사용자가 명시적으로 요청할 때만 한다.

---

### Task 1: 관리자 앱의 계약과 화면

**Files:**
- Create: `admin/index.html`, `admin/src/main.ts`, `admin/src/styles.css`, `admin/src/types.ts`, `admin/vite.config.ts`, `admin/wrangler.jsonc`
- Modify: `package.json`, `tsconfig.json`, `vitest.config.ts`
- Test: `tests/unit/admin/ui.test.ts`

**Interfaces:**
- Produces: `DashboardResponse` with `store`, `worker`, `health`, `usage` sections; each section has `{ status: 'ready' | 'connection_required' | 'error'; updatedAt?: string; data?: ... }`.
- Consumes: `GET /api/dashboard?days=1|7|30` JSON.

- [ ] **Step 1: Write a failing UI test**: render sample `DashboardResponse` and assert four summary labels, a single-page detail section, `연결 필요`, and an error message. Use `happy-dom` and import a pure `renderDashboard(root, response)` function from `admin/src/main.ts`.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/admin/ui.test.ts`; expected failure: module or function missing.
- [ ] **Step 3: Implement** `renderDashboard(root: HTMLElement, response: DashboardResponse): void` with DOM APIs, safely setting text via `textContent`. Add period select and refresh to fetch `/api/dashboard`, with loading/error state. Create CSS variables copied from `lib/ui/styles.ts`, the 4px green→blue header stripe, solid `#a9c9f3` chart bars, and responsive 4/2/1-column layout. Add `admin:build` script using `vite build --config admin/vite.config.ts`.
- [ ] **Step 4: Run** the focused test, then `pnpm admin:build`; expected pass and `admin/dist/index.html`.

### Task 2: Cloudflare and live-health data

**Files:**
- Create: `admin/src/cloudflare.ts`, `admin/src/health.ts`, `admin/src/api.ts`
- Test: `tests/unit/admin/cloudflare.test.ts`, `tests/unit/admin/health.test.ts`, `tests/unit/admin/api.test.ts`

**Interfaces:**
- Produces: `getWorkerMetrics(token, accountId, scriptName, days, fetchFn)` returning daily requests/errors; `checkLookupHealth(lookupUrl, fetchFn)` returning HTTP status, latency, check time; `handleAdminRequest(request, env, fetchFn)` serving `/api/dashboard` and assets.
- Consumes: Cloudflare GraphQL `workersInvocationsAdaptive`, lookup Worker `GET /lookup?query=온보딩`.

- [ ] **Step 1: Write failing tests** with mocked GraphQL and lookup responses: valid totals, 401, timeout, malformed JSON, bad period, one-source failure preserving other sections.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/admin/cloudflare.test.ts tests/unit/admin/health.test.ts tests/unit/admin/api.test.ts`; expected module failures.
- [ ] **Step 3: Implement** API adapters with fixed endpoints, request timeout, `Cache-Control: no-store`, and strict `days` enum. The health result must validate the lookup response shape from `scripts/check-worker.mjs`. Do not return tokens or upstream response bodies.
- [ ] **Step 4: Run** focused tests; expected pass.

### Task 3: Chrome Web Store metrics and service-account authentication

**Files:**
- Create: `admin/src/webstore.ts`, `admin/src/oauth.ts`
- Modify: `admin/src/api.ts`, `admin/wrangler.jsonc`
- Test: `tests/unit/admin/webstore.test.ts`, `tests/unit/admin/oauth.test.ts`

**Interfaces:**
- Produces: `getWebStoreMetrics(env, days, fetchFn)` returning installs, uninstalls, users, impressions, page views and daily values.
- Consumes: `https://oauth2.googleapis.com/token` using a signed JWT from `GOOGLE_SERVICE_ACCOUNT_JSON`; Web Store V2 `publishers.items.queryMetrics` using `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`.

- [ ] **Step 1: Write failing tests** for JWT token exchange, metrics query encoding, daily aggregation, 401, missing credentials, and an empty response.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/admin/oauth.test.ts tests/unit/admin/webstore.test.ts`; expected module failures.
- [ ] **Step 3: Implement** short-lived token acquisition with the read-only scope, metric parsing with numeric validation, and per-source error mapping. Add required secret names to `wrangler.jsonc` without values.
- [ ] **Step 4: Run** focused tests and `pnpm admin:build`; expected pass.

### Task 4: 운영 안내와 최종 검증

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-11-10-admin-dashboard-design.md` if implementation clarifies an interface
- Create: `docs/admin/SETUP.md`

**Interfaces:**
- Documents: Google service-account read-only authorization, Cloudflare read token, Cloudflare Access single-email policy, secret injection, local preview, build and deploy commands.

- [ ] **Step 1: Document** exact commands and account steps, including Access protection of production and preview URLs and how to verify unauthorized access is blocked.
- [ ] **Step 2: Run** `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, `pnpm admin:build`; expected all pass.
- [ ] **Step 3: Validate** the local dashboard with missing credentials and mocked responses. Live API and deployment checks run only when account secrets and deployment authorization are available.
