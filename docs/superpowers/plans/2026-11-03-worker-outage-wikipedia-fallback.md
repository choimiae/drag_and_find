# Worker 장애 시 위키백과 직접 조회 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Worker 요청 실패나 무료 한도 초과 시 확장이 위키백과 설명을 직접 표시한다.

**Architecture:** 백그라운드의 조회 제공자가 Worker를 우선 호출하고 실패 상태일 때만 기존 위키백과 제공자를 호출한다. 브라우저 요청은 필요한 위키백과 도메인만 허용하며 `Api-User-Agent`로 식별한다.

**Tech Stack:** TypeScript, WXT Manifest V3, Vitest, Playwright.

## Global Constraints

- Worker의 정상 `found` 및 `not_found` 응답은 변경하지 않는다.
- 직접 조회는 네이버 API와 위키데이터를 호출하지 않는다.
- 주변 문맥은 외부 API로 보내지 않는다.
- Worker 요청 제한은 현재 최대 18초이며 실패 후 직접 조회한다.

---

### Task 1: 실패 상태 전환 제공자

**Files:**
- Create: `lib/lookup/fallback-provider.ts`
- Test: `tests/unit/lookup/fallback-provider.test.ts`

**Interfaces:**
- Consumes: `LookupProvider`와 `LookupResult` from `lib/lookup/types.ts`.
- Produces: `withWorkerFailureFallback(worker: LookupProvider, wikipedia: LookupProvider): LookupProvider`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, expect, it, vi } from 'vitest';
import { withWorkerFailureFallback } from '../../../lib/lookup/fallback-provider';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';

const wikiFound: LookupResult = { status: 'found', source: 'wikipedia', title: '고양이', extract: '동물', url: 'https://ko.wikipedia.org/wiki/고양이', isDisambiguation: false };
const provider = (result: LookupResult): LookupProvider => ({ lookup: vi.fn(async () => result) });

describe('withWorkerFailureFallback', () => {
  it.each(['network_error', 'rate_limited'] as const)('uses Wikipedia for %s', async (status) => {
    const wikipedia = provider(wikiFound);
    expect(await withWorkerFailureFallback(provider({ status }), wikipedia).lookup('고양이')).toEqual(wikiFound);
    expect(wikipedia.lookup).toHaveBeenCalledWith('고양이');
  });
  it.each(['found', 'not_found'] as const)('does not retry a normal %s result', async (status) => {
    const result: LookupResult = status === 'found' ? wikiFound : { status };
    const wikipedia = provider({ status: 'network_error' });
    expect(await withWorkerFailureFallback(provider(result), wikipedia).lookup('고양이')).toEqual(result);
    expect(wikipedia.lookup).not.toHaveBeenCalled();
  });
  it('returns the direct lookup error when Wikipedia also fails', async () => {
    expect(await withWorkerFailureFallback(provider({ status: 'network_error' }), provider({ status: 'rate_limited' })).lookup('고양이')).toEqual({ status: 'rate_limited' });
  });
});
```

- [ ] **Step 2: 실패 확인** — `pnpm exec vitest run tests/unit/lookup/fallback-provider.test.ts`; import 실패를 확인한다.
- [ ] **Step 3: 최소 구현**

```ts
import type { LookupProvider } from './types';

export function withWorkerFailureFallback(worker: LookupProvider, wikipedia: LookupProvider): LookupProvider {
  return { async lookup(query) {
    const result = await worker.lookup(query);
    return result.status === 'network_error' || result.status === 'rate_limited'
      ? wikipedia.lookup(query)
      : result;
  } };
}
```

- [ ] **Step 4: 단위 테스트 통과 확인** — 같은 명령을 실행한다.
- [ ] **Step 5: 커밋** — `git add lib/lookup/fallback-provider.ts tests/unit/lookup/fallback-provider.test.ts && git commit -m "feat: fall back to Wikipedia when Worker fails"`.

### Task 2: 브라우저 위키백과 조회 연결

**Files:**
- Create: `lib/lookup/browser-wikipedia.ts`
- Modify: `entrypoints/background.ts`
- Modify: `wxt.config.ts`
- Test: `tests/unit/lookup/browser-wikipedia.test.ts`
- Test: `tests/unit/lookup/worker-client.test.ts`

**Interfaces:**
- Consumes: `createWikipediaKoProvider`, `withEnglishWikipediaFallback`, `withWorkerFailureFallback`, `createWorkerProvider`.
- Produces: `createBrowserWikipediaProvider(fetchFn?: FetchFn): LookupProvider`.

- [ ] **Step 1: 실패 테스트 작성** — 브라우저 제공자가 한국어 문서를 찾고 영문 검색어에는 언어 연결 문서를 찾는지 검증한다. 주입한 `fetchFn`에서 모든 요청 호스트가 `ko.wikipedia.org` 또는 `en.wikipedia.org`인지, `Api-User-Agent`가 있고 `User-Agent`를 전달하지 않는지 확인한다. `tests/unit/lookup/worker-client.test.ts`에는 Worker의 HTTP 429와 1027이 각각 `rate_limited`와 `network_error`로 매핑되는 사례를 추가한다.

```ts
const fetchFn = vi.fn<FetchFn>(async (url, init) => {
  expect(['ko.wikipedia.org', 'en.wikipedia.org']).toContain(new URL(url).hostname);
  expect(new Headers(init?.headers).has('Api-User-Agent')).toBe(true);
  expect(new Headers(init?.headers).has('User-Agent')).toBe(false);
  return Response.json({ title: '고양이', extract: '동물' });
});
const result = await createBrowserWikipediaProvider(fetchFn).lookup('고양이');
expect(result.status).toBe('found');
```

- [ ] **Step 2: 실패 확인** — `pnpm exec vitest run tests/unit/lookup/browser-wikipedia.test.ts tests/unit/lookup/worker-client.test.ts`.
- [ ] **Step 3: 최소 구현** — `browser-wikipedia.ts`에서 현재 위키백과 제공자 두 개를 조합한다. 주입된 `fetchFn` 앞에 어댑터를 두어 브라우저 요청의 `User-Agent`를 제거하고 `Api-User-Agent`는 유지한다. 백그라운드에서 이 제공자를 Task 1의 `withWorkerFailureFallback`에 넣는다. `wxt.config.ts`에 정확히 `https://ko.wikipedia.org/*`, `https://en.wikipedia.org/*` 권한을 추가한다.

```ts
const worker = createWorkerProvider(workerUrl);
const wikipedia = createBrowserWikipediaProvider();
const provider = withWorkerFailureFallback(worker, wikipedia);
```

- [ ] **Step 4: 테스트·타입·manifest 확인** — `pnpm exec vitest run tests/unit/lookup/browser-wikipedia.test.ts tests/unit/lookup/worker-client.test.ts tests/unit/lookup/fallback-provider.test.ts`, `pnpm compile`, `WXT_LOOKUP_API_URL=https://example.com pnpm build`; `.output/chrome-mv3/manifest.json`에 Worker와 두 위키백과 호스트가 있는지 확인한다.
- [ ] **Step 5: 커밋** — `git add lib/lookup/browser-wikipedia.ts entrypoints/background.ts wxt.config.ts tests/unit/lookup/browser-wikipedia.test.ts tests/unit/lookup/worker-client.test.ts && git commit -m "feat: query Wikipedia directly during Worker outages"`.

### Task 3: 안내 문구와 전체 검증

**Files:**
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `docs/store/listing.md`

- [ ] **Step 1: 안내 수정** — Worker 장애 시 검색어만 위키백과로 직접 보내는 동작과 두 호스트 권한의 이유를 세 파일에 명시한다. Worker 정상 응답 시 기존 경로를 설명한다.
- [ ] **Step 2: 검증** — `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `WXT_LOOKUP_API_URL=https://example.com pnpm build`, `pnpm test:e2e`를 실행한다. 빌드된 manifest 권한을 확인한다.
- [ ] **Step 3: 커밋** — `git add README.md PRIVACY.md docs/store/listing.md && git commit -m "docs: explain direct Wikipedia outage fallback"`.
