# Drag and Find 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹페이지에서 드래그한 단어의 한국어 위키백과 요약을 선택 위치 아래 카드로 보여 주고, 구글·네이버 검색으로 바로 넘길 수 있는 크롬 확장(Manifest V3)을 만든다.

**Architecture:** WXT로 빌드하는 크롬 확장. 페이지 쪽 content script(선택 감지·아이콘·카드)와 백그라운드 service worker(단축키·위키백과 조회·캐시)가 메시지로만 통신한다. 순수 로직(검색어 정리, URL 생성, 위키백과 응답 해석, 카드 위치 계산)은 `lib/`의 독립 모듈로 두고 단위 테스트한다. 검색 출처는 `LookupProvider` 인터페이스 뒤에 숨겨 나중에 교체·추가할 수 있게 한다.

**Tech Stack:** TypeScript ~5.9, WXT 0.21.4 (Vite 기반), Vitest 5 + happy-dom 21 + `wxt/testing`, Playwright 1.64 (Chromium), ESLint 10 + typescript-eslint 8, Prettier 3, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-23-drag-and-find-design.md`

## Global Constraints

- 런타임: Node 22, pnpm 12. 패키지는 모두 `devDependencies`.
- `typescript`는 `~5.9`로 고정한다 (typescript-eslint 8의 peer 범위가 `<6.1.0`).
- WXT 자동 import를 끈다(`imports: false`). `browser`, `defineBackground`, `defineContentScript`는 항상 명시적으로 import 한다.
- 검색어 최대 길이: `50`자(문자 단위, `Array.from` 기준).
- 위키백과 요청 타임아웃 `5000`ms, 자동 재시도는 연결 오류·5xx일 때 1회만. 429는 재시도하지 않는다.
- 캐시: `browser.storage.session`, 최대 `200`건, `found`·`not_found`만 저장.
- 단축키 명령 이름 `lookup-selection`, 기본 키 `Alt+Shift+F` (Mac도 `Alt+Shift+F` = `⌥⇧F`).
- 권한: `permissions: ['storage']`, `host_permissions: ['https://ko.wikipedia.org/*']`, content script `matches: ['<all_urls>']`. 그 외 권한 추가 금지.
- 요청 헤더 `Api-User-Agent: DragAndFind/<manifest version>`. 개인 정보(이메일 등)를 넣지 않는다.
- 외부 데이터(위키백과 응답, 메시지)는 검증한 뒤 쓴다. 화면에는 `textContent`로만 넣고 `innerHTML`을 쓰지 않는다.
- 카드 문구(정확히 이대로):
  - 찾는 중: `찾는 중…`
  - 동음이의: `뜻이 여러 개인 단어입니다`
  - 없음: `위키백과에 문서가 없습니다`
  - 429: `요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요`
  - 연결 실패: `연결에 실패했습니다` + 버튼 `다시 시도`
  - 너무 김: `선택이 너무 깁니다 (50자 이하)`
  - 링크·버튼: `위키백과에서 보기 →`, `구글 검색`, `네이버 검색`
- 검색 URL: `https://www.google.com/search?q=<encodeURIComponent>`, `https://search.naver.com/search.naver?query=<encodeURIComponent>`
- 커밋 메시지: `<type>: <쉬운 한국어 한 줄>`, 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- 조사가 붙은 채 드래그한 단어(`온보딩을`)는 제목이 앞부분과 같은 문서(`온보딩`)를 찾아야 한다 → Task 3 테스트.
- 양끝 따옴표·문장부호·줄바꿈이 섞인 선택(`"온보딩",`, `온보딩\n과정`)은 정리된 검색어로 찾아야 한다 → Task 2 테스트.
- 단어를 빠르게 연달아 찾으면, 먼저 보낸 요청의 응답이 늦게 와도 마지막 단어의 결과만 보여야 한다 → Task 7 테스트.
- 카드를 닫은 뒤에 응답이 도착해도 카드가 다시 열리면 안 된다 → Task 7 테스트.
- 확장이 업데이트·재시작되어 페이지와 연결이 끊긴 뒤 검색하거나, 응답 형식이 깨져 있으면 예외 없이 `연결에 실패했습니다` 카드가 떠야 한다 → Task 7 테스트.

---

## 파일 구조

```
.gitignore                       (수정) 빌드 산출물 추가
CLAUDE.md                        (수정) 빌드/검증 명령
package.json
tsconfig.json
wxt.config.ts                    매니페스트(이름·권한·단축키)
vitest.config.ts
playwright.config.ts
eslint.config.js
.prettierrc.json
.prettierignore
public/icon/*.png                WXT 기본 아이콘(디자인 단계에서 교체)
entrypoints/
  background.ts                  조회 서비스·단축키 연결
  content.ts                     컨트롤러·오버레이 연결
  options/index.html             설정 화면 마크업
  options/main.ts                설정 화면 연결
lib/
  selection.ts                   검색어 정리·길이 판정·편집 영역 판정
  search-urls.ts                 구글·네이버 검색 URL
  storage.ts                     KeyValueArea 타입
  settings.ts                    설정 읽기·쓰기·검증
  messages.ts                    메시지 타입과 검증
  shortcut.ts                    단축키 처리
  lookup/types.ts                LookupResult, LookupProvider
  lookup/wikipedia.ts            위키백과 조회·관련성 판정
  lookup/cache.ts                결과 캐시
  lookup/service.ts              캐시 + 출처 조합
  lookup/message-handler.ts      백그라운드 메시지 처리
  lookup/client.ts               content script → 백그라운드 요청
  ui/position.ts                 카드·아이콘 위치 계산(순수)
  ui/styles.ts                   Shadow DOM CSS
  ui/card.ts                     카드 내용 렌더링
  ui/overlay.ts                  Shadow DOM 호스트·아이콘·카드 배치
  content/controller.ts          선택·클릭·키 입력 → 오버레이 제어
  options-page.ts                설정 화면 로직
tests/unit/                      lib 구조를 그대로 따른다
e2e/
  fixtures.ts                    확장 설치 크롬 + 가짜 응답
  lookup.spec.ts
```

---

### Task 1: 프로젝트 뼈대

**Files:**
- Create: `package.json`, `tsconfig.json`, `wxt.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `entrypoints/background.ts`, `entrypoints/content.ts`, `public/icon/*.png`, `tests/unit/setup.test.ts`
- Modify: `.gitignore`, `CLAUDE.md`

**Interfaces:**
- Consumes: 없음
- Produces: `pnpm build | test | lint | compile | format:check` 스크립트, 매니페스트 기본값

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "drag-and-find",
  "description": "드래그한 단어의 위키백과 요약을 페이지 위에 바로 보여 주는 크롬 확장",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip",
    "compile": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:e2e": "wxt build && playwright test",
    "postinstall": "wxt prepare"
  }
}
```

- [ ] **Step 2: 의존성 설치**

Run:
```bash
pnpm add -D wxt@0.21.4 vite@^8 typescript@~5.9 vitest@^5 happy-dom@^21 @playwright/test@^1.64 eslint@^10 @eslint/js@^10 typescript-eslint@^8 prettier@^3
pnpm exec playwright install chromium
```
Expected: 설치 성공, `postinstall`의 `wxt prepare`가 `.wxt/` 생성

- [ ] **Step 3: 설정 파일 작성**

`tsconfig.json`
```json
{
  "extends": "./.wxt/tsconfig.json"
}
```

`wxt.config.ts`
```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  imports: false,
  manifest: {
    name: 'Drag and Find',
    description:
      '모르는 단어를 드래그하고 🔍 또는 Alt+Shift+F를 누르면 위키백과 요약을 바로 보여 줍니다.',
    permissions: ['storage'],
    host_permissions: ['https://ko.wikipedia.org/*'],
    commands: {
      'lookup-selection': {
        suggested_key: { default: 'Alt+Shift+F', mac: 'Alt+Shift+F' },
        description: '선택한 단어 찾기',
      },
    },
  },
});
```

`vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    include: ['tests/unit/**/*.test.ts'],
  },
});
```

`eslint.config.js`
```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/',
      '.wxt/',
      '.superpowers/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
```

`.prettierrc.json`
```json
{
  "singleQuote": true,
  "printWidth": 100
}
```

`.prettierignore`
```
.output/
.wxt/
.superpowers/
node_modules/
playwright-report/
test-results/
pnpm-lock.yaml
**/*.md
```

`.gitignore` 끝에 추가
```
# 빌드·테스트 산출물
node_modules/
.output/
.wxt/
playwright-report/
test-results/
```

- [ ] **Step 4: 최소 entrypoint와 아이콘**

`entrypoints/background.ts`
```ts
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {});
```

`entrypoints/content.ts`
```ts
import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {},
});
```

아이콘은 WXT 템플릿에서 복사한다(디자인 단계에서 교체):
```bash
pnpm dlx wxt@0.21.4 init .wxt-template -t vanilla --pm pnpm
mkdir -p public && cp -R .wxt-template/public/icon public/
rm -rf .wxt-template
```

- [ ] **Step 5: 테스트 실행 환경 확인용 테스트 작성**

`tests/unit/setup.test.ts`
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('test setup', () => {
  beforeEach(() => fakeBrowser.reset());

  it('provides a fake extension storage', async () => {
    await browser.storage.local.set({ ready: true });
    expect(await browser.storage.local.get('ready')).toEqual({ ready: true });
  });
});
```

- [ ] **Step 6: 전체 검증**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 테스트 1개 통과, 타입·린트 오류 없음, `.output/chrome-mv3/manifest.json` 생성

Run: `node -e "const m=require('./.output/chrome-mv3/manifest.json');console.log(m.name,m.version,m.permissions,m.host_permissions,Object.keys(m.commands))"`
Expected: `Drag and Find 0.1.0 [ 'storage' ] [ 'https://ko.wikipedia.org/*' ] [ 'lookup-selection' ]`

- [ ] **Step 7: CLAUDE.md 빌드/검증 명령 갱신**

`CLAUDE.md`의 `## 빌드/검증 명령` 섹션 본문을 다음으로 교체:
```markdown
| 목적 | 명령 |
|---|---|
| 개발(크롬 자동 실행·변경 즉시 반영) | `pnpm dev` |
| 빌드 (`.output/chrome-mv3/`) | `pnpm build` |
| 단위 테스트 | `pnpm test` |
| E2E 테스트 (빌드 포함) | `pnpm test:e2e` |
| 타입 검사 | `pnpm compile` |
| 린트 | `pnpm lint` |
| 포맷 검사 / 적용 | `pnpm format:check` / `pnpm format` |
| 웹스토어 업로드용 zip | `pnpm zip` |

커밋 전 전체 검증: `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`

크롬에 직접 올려 보기: `pnpm build` → `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3` 선택
```

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: 크롬 확장 개발 환경 구성" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 검색어 정리와 검색 URL

**Files:**
- Create: `lib/selection.ts`, `lib/search-urls.ts`
- Test: `tests/unit/selection.test.ts`, `tests/unit/search-urls.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `MAX_QUERY_LENGTH: 50`
  - `type SelectionCheck = { kind: 'ok'; query: string } | { kind: 'empty' } | { kind: 'too_long'; length: number }`
  - `normalizeQuery(raw: string): string`
  - `checkSelection(raw: string): SelectionCheck`
  - `isInEditableContext(anchorNode: Node | null, activeElement: Element | null): boolean`
  - `googleSearchUrl(query: string): string`, `naverSearchUrl(query: string): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/selection.test.ts`
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_QUERY_LENGTH,
  checkSelection,
  isInEditableContext,
  normalizeQuery,
} from '../../lib/selection';

describe('normalizeQuery', () => {
  it('collapses line breaks and repeated spaces into one space', () => {
    expect(normalizeQuery('  온보딩\n   과정  ')).toBe('온보딩 과정');
  });

  it('strips quotes, brackets and punctuation at both ends', () => {
    expect(normalizeQuery('"온보딩",')).toBe('온보딩');
    expect(normalizeQuery('(SaaS).')).toBe('SaaS');
    expect(normalizeQuery('「퍼널」')).toBe('퍼널');
    expect(normalizeQuery('…레버리지!?')).toBe('레버리지');
  });

  it('keeps symbols that belong to the term', () => {
    expect(normalizeQuery('C++')).toBe('C++');
    expect(normalizeQuery('TCP/IP')).toBe('TCP/IP');
  });
});

describe('checkSelection', () => {
  it('reports empty for blank or punctuation-only text', () => {
    expect(checkSelection('')).toEqual({ kind: 'empty' });
    expect(checkSelection('   ')).toEqual({ kind: 'empty' });
    expect(checkSelection('".,"')).toEqual({ kind: 'empty' });
  });

  it('accepts a single character', () => {
    expect(checkSelection('온')).toEqual({ kind: 'ok', query: '온' });
  });

  it('accepts exactly the maximum length', () => {
    const text = '가'.repeat(MAX_QUERY_LENGTH);
    expect(checkSelection(text)).toEqual({ kind: 'ok', query: text });
  });

  it('rejects one character over the maximum', () => {
    expect(checkSelection('가'.repeat(MAX_QUERY_LENGTH + 1))).toEqual({
      kind: 'too_long',
      length: MAX_QUERY_LENGTH + 1,
    });
  });

  it('counts emoji as one character each', () => {
    const text = '😀'.repeat(MAX_QUERY_LENGTH);
    expect(checkSelection(text)).toEqual({ kind: 'ok', query: text });
  });

  it('returns the normalized query', () => {
    expect(checkSelection(' "온보딩", ')).toEqual({ kind: 'ok', query: '온보딩' });
  });
});

describe('isInEditableContext', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="plain">글</p>
      <textarea id="area">메모</textarea>
      <div contenteditable="true"><span id="editable">편집</span></div>
      <div contenteditable="false"><span id="locked">고정</span></div>`;
  });

  const textOf = (id: string) => document.getElementById(id)!.firstChild;

  it('is false for normal page text', () => {
    expect(isInEditableContext(textOf('plain'), document.body)).toBe(false);
  });

  it('is true while a textarea or input has focus', () => {
    expect(isInEditableContext(textOf('plain'), document.getElementById('area'))).toBe(true);
  });

  it('is true inside contenteditable', () => {
    expect(isInEditableContext(textOf('editable'), document.body)).toBe(true);
  });

  it('is false inside contenteditable="false"', () => {
    expect(isInEditableContext(textOf('locked'), document.body)).toBe(false);
  });

  it('is false when there is no node', () => {
    expect(isInEditableContext(null, null)).toBe(false);
  });
});
```

`tests/unit/search-urls.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { googleSearchUrl, naverSearchUrl } from '../../lib/search-urls';

describe('search urls', () => {
  it('builds a Google search url with the encoded query', () => {
    expect(googleSearchUrl('온보딩')).toBe(
      'https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('builds a Naver search url with the encoded query', () => {
    expect(naverSearchUrl('온보딩')).toBe(
      'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('encodes characters that would break the url', () => {
    expect(naverSearchUrl('A&B #1?')).toBe(
      'https://search.naver.com/search.naver?query=A%26B%20%231%3F',
    );
    expect(googleSearchUrl('TCP/IP')).toBe('https://www.google.com/search?q=TCP%2FIP');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/selection.test.ts tests/unit/search-urls.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/selection"` 등

- [ ] **Step 3: 구현**

`lib/selection.ts`
```ts
/** 검색어로 허용하는 최대 글자 수. */
export const MAX_QUERY_LENGTH = 50;

const EDGE_CHARACTERS = `\\s"'“”‘’「」『』()\\[\\]{}<>.,!?;:·…~\\-`;
const EDGE_PATTERN = new RegExp(`^[${EDGE_CHARACTERS}]+|[${EDGE_CHARACTERS}]+$`, 'gu');
const EDITABLE_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

export type SelectionCheck =
  | { kind: 'ok'; query: string }
  | { kind: 'empty' }
  | { kind: 'too_long'; length: number };

/** 줄바꿈·연속 공백을 합치고 양끝 따옴표·괄호·문장부호를 걷어 낸다. */
export function normalizeQuery(raw: string): string {
  return raw.replace(/\s+/gu, ' ').replace(EDGE_PATTERN, '');
}

/** 선택 문자열을 정리하고 검색 가능한 길이인지 판정한다. */
export function checkSelection(raw: string): SelectionCheck {
  const query = normalizeQuery(raw);
  const length = Array.from(query).length;
  if (length === 0) return { kind: 'empty' };
  if (length > MAX_QUERY_LENGTH) return { kind: 'too_long', length };
  return { kind: 'ok', query };
}

/** 선택이 입력칸·편집 영역 안에서 일어났는지 판정한다. */
export function isInEditableContext(
  anchorNode: Node | null,
  activeElement: Element | null,
): boolean {
  if (activeElement?.matches('input, textarea')) return true;
  const element = anchorNode instanceof Element ? anchorNode : (anchorNode?.parentElement ?? null);
  return element?.closest(EDITABLE_SELECTOR) != null;
}
```

`lib/search-urls.ts`
```ts
/** 검색어로 구글 검색 결과 주소를 만든다. */
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** 검색어로 네이버 통합검색 결과 주소를 만든다. */
export function naverSearchUrl(query: string): string {
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test tests/unit/selection.test.ts tests/unit/search-urls.test.ts && pnpm compile && pnpm lint`
Expected: PASS, 오류 없음

- [ ] **Step 5: Commit**

```bash
git add lib/selection.ts lib/search-urls.ts tests/unit/selection.test.ts tests/unit/search-urls.test.ts
git commit -m "feat: 드래그한 글자를 검색어로 다듬는 규칙과 검색 주소 추가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 위키백과 조회

**Files:**
- Create: `lib/lookup/types.ts`, `lib/lookup/wikipedia.ts`
- Test: `tests/unit/lookup/wikipedia.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type LookupResult = { status: 'found'; title: string; extract: string; url: string; isDisambiguation: boolean } | { status: 'not_found' } | { status: 'rate_limited' } | { status: 'network_error' }`
  - `interface LookupProvider { lookup(query: string): Promise<LookupResult> }`
  - `type FetchFn = (input: string, init?: RequestInit) => Promise<Response>`
  - `createWikipediaKoProvider(options: { userAgent: string; fetchFn?: FetchFn }): LookupProvider`
  - `isRelevantTitle(query: string, title: string): boolean`
  - `REQUEST_TIMEOUT_MS: 5000`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/lookup/wikipedia.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import {
  createWikipediaKoProvider,
  isRelevantTitle,
  type FetchFn,
} from '../../../lib/lookup/wikipedia';

const SUMMARY_PATH = '/api/rest_v1/page/summary/';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const summary = (title: string, extra: Record<string, unknown> = {}) =>
  json({
    type: 'standard',
    title,
    extract: `${title} 설명`,
    content_urls: {
      desktop: { page: `https://ko.wikipedia.org/wiki/${encodeURIComponent(title)}` },
    },
    ...extra,
  });

const notFound = () => json({ type: 'not_found' }, 404);
const searchHits = (titles: string[]) =>
  json({ query: { search: titles.map((title) => ({ title })) } });

const summaryTitleOf = (url: URL) => decodeURIComponent(url.pathname.slice(SUMMARY_PATH.length));
const isSummary = (url: URL) => url.pathname.startsWith(SUMMARY_PATH);

function fakeFetch(route: (url: URL) => Response | Promise<Response>) {
  const fn = vi.fn<FetchFn>(async (input) => route(new URL(input)));
  return fn;
}

function provider(fetchFn: FetchFn) {
  return createWikipediaKoProvider({ userAgent: 'DragAndFind/test', fetchFn });
}

describe('createWikipediaKoProvider', () => {
  it('returns the summary of an exactly matching article', async () => {
    const fetchFn = fakeFetch((url) => (summaryTitleOf(url) === '온보딩' ? summary('온보딩') : notFound()));

    const result = await provider(fetchFn).lookup('온보딩');

    expect(result).toEqual({
      status: 'found',
      title: '온보딩',
      extract: '온보딩 설명',
      url: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
      isDisambiguation: false,
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends the Api-User-Agent header and a timeout signal', async () => {
    const fetchFn = fakeFetch(() => summary('온보딩'));

    await provider(fetchFn).lookup('온보딩');

    const init = fetchFn.mock.calls[0][1];
    expect(init?.headers).toEqual({ 'Api-User-Agent': 'DragAndFind/test' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('follows redirects returned by the summary endpoint', async () => {
    const fetchFn = fakeFetch(() => summary('서비스형 소프트웨어'));

    const result = await provider(fetchFn).lookup('SaaS');

    expect(result).toMatchObject({ status: 'found', title: '서비스형 소프트웨어' });
  });

  it('marks disambiguation pages', async () => {
    const fetchFn = fakeFetch(() => summary('POC', { type: 'disambiguation' }));

    const result = await provider(fetchFn).lookup('POC');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
  });

  it('encodes titles that contain a slash', async () => {
    const fetchFn = fakeFetch(() => summary('TCP/IP'));

    await provider(fetchFn).lookup('TCP/IP');

    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://ko.wikipedia.org/api/rest_v1/page/summary/TCP%2FIP',
    );
  });

  it('replaces a non-Wikipedia article url with a ko.wikipedia.org url', async () => {
    const fetchFn = fakeFetch(() =>
      summary('온보딩', { content_urls: { desktop: { page: 'https://evil.example/x' } } }),
    );

    const result = await provider(fetchFn).lookup('온보딩');

    expect(result).toMatchObject({
      url: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
    });
  });

  it('falls back to search and accepts a title that contains the query', async () => {
    const fetchFn = fakeFetch((url) => {
      if (!isSummary(url)) return searchHits(['마케팅 퍼널']);
      return summaryTitleOf(url) === '마케팅 퍼널' ? summary('마케팅 퍼널') : notFound();
    });

    const result = await provider(fetchFn).lookup('퍼널');

    expect(result).toMatchObject({ status: 'found', title: '마케팅 퍼널' });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('accepts a title the query starts with, for words with a particle attached', async () => {
    const fetchFn = fakeFetch((url) => {
      if (!isSummary(url)) return searchHits(['온보딩']);
      return summaryTitleOf(url) === '온보딩' ? summary('온보딩') : notFound();
    });

    const result = await provider(fetchFn).lookup('온보딩을');

    expect(result).toMatchObject({ status: 'found', title: '온보딩' });
  });

  it.each([
    ['이탈률', '유체이탈'],
    ['갓생', '세조 (조선)'],
    ['리스킬링', '유재석'],
  ])('rejects an unrelated search hit (%s → %s)', async (query, hit) => {
    const fetchFn = fakeFetch((url) => (isSummary(url) ? notFound() : searchHits([hit])));

    const result = await provider(fetchFn).lookup(query);

    expect(result).toEqual({ status: 'not_found' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns not_found when search has no hits', async () => {
    const fetchFn = fakeFetch((url) => (isSummary(url) ? notFound() : searchHits([])));

    expect(await provider(fetchFn).lookup('없는말')).toEqual({ status: 'not_found' });
  });

  it('returns rate_limited on 429 without retrying', async () => {
    const fetchFn = fakeFetch(() => new Response('', { status: 429 }));

    expect(await provider(fetchFn).lookup('온보딩')).toEqual({ status: 'rate_limited' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries once after a server error', async () => {
    let calls = 0;
    const fetchFn = fakeFetch(() => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 503 }) : summary('온보딩');
    });

    expect(await provider(fetchFn).lookup('온보딩')).toMatchObject({ status: 'found' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns network_error after the retry also fails', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => {
      throw new TypeError('Failed to fetch');
    });

    expect(await provider(fetchFn).lookup('온보딩')).toEqual({ status: 'network_error' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe('isRelevantTitle', () => {
  it('accepts titles containing the query, ignoring case and spaces', () => {
    expect(isRelevantTitle('퍼널', '마케팅 퍼널')).toBe(true);
    expect(isRelevantTitle('saas', 'SaaS')).toBe(true);
    expect(isRelevantTitle('마케팅퍼널', '마케팅 퍼널')).toBe(true);
  });

  it('accepts a title the query starts with only when the title has 2+ characters', () => {
    expect(isRelevantTitle('온보딩을', '온보딩')).toBe(true);
    expect(isRelevantTitle('가나다', '가')).toBe(false);
  });

  it('rejects unrelated titles', () => {
    expect(isRelevantTitle('이탈률', '유체이탈')).toBe(false);
    expect(isRelevantTitle('PoC', '개념 증명')).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/lookup/wikipedia.test.ts`
Expected: FAIL — `Failed to resolve import "../../../lib/lookup/wikipedia"`

- [ ] **Step 3: 구현**

`lib/lookup/types.ts`
```ts
/** 검색 출처가 돌려주는 결과. 출처가 바뀌어도 이 형식은 유지한다. */
export type LookupResult =
  | { status: 'found'; title: string; extract: string; url: string; isDisambiguation: boolean }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'network_error' };

/** 검색어 하나를 받아 결과를 돌려주는 검색 출처. */
export interface LookupProvider {
  lookup(query: string): Promise<LookupResult>;
}
```

`lib/lookup/wikipedia.ts`
```ts
import type { LookupProvider, LookupResult } from './types';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const ORIGIN = 'https://ko.wikipedia.org';
export const REQUEST_TIMEOUT_MS = 5000;
/** 최초 요청 1회 + 연결 오류·5xx일 때 자동 재시도 1회. */
const MAX_ATTEMPTS = 2;
const MIN_PREFIX_TITLE_LENGTH = 2;

interface SummaryResponse {
  type?: string;
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

interface SearchResponse {
  query?: { search?: Array<{ title?: string }> };
}

class RateLimitedError extends Error {}
class ServerError extends Error {}

interface WikipediaOptions {
  userAgent: string;
  fetchFn?: FetchFn;
}

/** 한국어 위키백과에서 검색어의 요약을 찾는 출처를 만든다. */
export function createWikipediaKoProvider({
  userAgent,
  fetchFn = (input, init) => fetch(input, init),
}: WikipediaOptions): LookupProvider {
  async function requestJson<T>(url: string): Promise<T | null> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const response = await fetchFn(url, {
          headers: { 'Api-User-Agent': userAgent },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (response.status === 429) throw new RateLimitedError();
        if (response.status >= 500) throw new ServerError(`HTTP ${response.status}`);
        if (!response.ok) return null;
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof RateLimitedError || attempt >= MAX_ATTEMPTS) throw error;
      }
    }
  }

  async function fetchSummary(title: string): Promise<LookupResult | null> {
    const data = await requestJson<SummaryResponse>(
      `${ORIGIN}/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!data?.title) return null;
    return {
      status: 'found',
      title: data.title,
      extract: data.extract ?? '',
      url: articleUrl(data.content_urls?.desktop?.page, data.title),
      isDisambiguation: data.type === 'disambiguation',
    };
  }

  async function searchTopTitle(query: string): Promise<string | null> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: '1',
      format: 'json',
    });
    const data = await requestJson<SearchResponse>(`${ORIGIN}/w/api.php?${params}`);
    return data?.query?.search?.[0]?.title ?? null;
  }

  return {
    async lookup(query) {
      try {
        const direct = await fetchSummary(query);
        if (direct) return direct;
        const candidate = await searchTopTitle(query);
        if (!candidate || !isRelevantTitle(query, candidate)) return { status: 'not_found' };
        return (await fetchSummary(candidate)) ?? { status: 'not_found' };
      } catch (error) {
        if (error instanceof RateLimitedError) return { status: 'rate_limited' };
        return { status: 'network_error' };
      }
    },
  };
}

/** 검색 결과 제목이 검색어와 관련 있는지 판정한다(엉뚱한 결과 거르기). */
export function isRelevantTitle(query: string, title: string): boolean {
  const normalizedQuery = normalizeForMatch(query);
  const normalizedTitle = normalizeForMatch(title);
  if (normalizedTitle.includes(normalizedQuery)) return true;
  return (
    Array.from(normalizedTitle).length >= MIN_PREFIX_TITLE_LENGTH &&
    normalizedQuery.startsWith(normalizedTitle)
  );
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[\s_]+/gu, '');
}

function articleUrl(candidate: string | undefined, title: string): string {
  if (candidate?.startsWith(`${ORIGIN}/`)) return candidate;
  return `${ORIGIN}/wiki/${encodeURIComponent(title)}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test tests/unit/lookup/wikipedia.test.ts && pnpm compile && pnpm lint`
Expected: PASS, 오류 없음

- [ ] **Step 5: Commit**

```bash
git add lib/lookup tests/unit/lookup/wikipedia.test.ts
git commit -m "feat: 한국어 위키백과에서 단어 요약을 찾는 기능 추가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 캐시·메시지·백그라운드

**Files:**
- Create: `lib/storage.ts`, `lib/lookup/cache.ts`, `lib/lookup/service.ts`, `lib/lookup/message-handler.ts`, `lib/messages.ts`, `lib/shortcut.ts`
- Modify: `entrypoints/background.ts`
- Test: `tests/unit/lookup/cache.test.ts`, `tests/unit/lookup/service.test.ts`, `tests/unit/lookup/message-handler.test.ts`, `tests/unit/messages.test.ts`, `tests/unit/shortcut.test.ts`

**Interfaces:**
- Consumes: Task 3의 `LookupResult`, `LookupProvider`, `createWikipediaKoProvider`
- Produces:
  - `interface KeyValueArea { get(key: string): Promise<Record<string, unknown>>; set(items: Record<string, unknown>): Promise<void> }`
  - `createLookupCache(area: KeyValueArea): LookupCache` — `LookupCache = { get(query): Promise<LookupResult | undefined>; set(query, result): Promise<void> }`, `MAX_CACHE_ENTRIES: 200`
  - `type LookupService = (query: string) => Promise<LookupResult>`, `createLookupService(provider, cache): LookupService`
  - `createLookupMessageHandler(lookup: LookupService): (message: unknown) => Promise<LookupResult> | undefined`
  - `LOOKUP_MESSAGE = 'lookup'`, `TRIGGER_MESSAGE = 'trigger-from-shortcut'`, `LookupRequest`, `TriggerRequest`, `isLookupRequest`, `isTriggerRequest`, `isLookupResult`
  - `LOOKUP_COMMAND = 'lookup-selection'`, `createShortcutHandler(deps): (command: string, tabId?: number) => Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/memory-area.ts` (테스트 도우미)
```ts
import type { KeyValueArea } from '../../lib/storage';

/** 테스트용 메모리 저장소. */
export function memoryArea(initial: Record<string, unknown> = {}): KeyValueArea {
  let data = { ...initial };
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(items) {
      data = { ...data, ...items };
    },
  };
}
```

`tests/unit/lookup/cache.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { MAX_CACHE_ENTRIES, createLookupCache } from '../../../lib/lookup/cache';
import type { LookupResult } from '../../../lib/lookup/types';
import { memoryArea } from '../memory-area';

const found = (title: string): LookupResult => ({
  status: 'found',
  title,
  extract: `${title} 설명`,
  url: `https://ko.wikipedia.org/wiki/${title}`,
  isDisambiguation: false,
});

describe('createLookupCache', () => {
  it('returns a stored found result', async () => {
    const cache = createLookupCache(memoryArea());

    await cache.set('온보딩', found('온보딩'));

    expect(await cache.get('온보딩')).toEqual(found('온보딩'));
  });

  it('stores not_found results', async () => {
    const cache = createLookupCache(memoryArea());

    await cache.set('갓생', { status: 'not_found' });

    expect(await cache.get('갓생')).toEqual({ status: 'not_found' });
  });

  it.each([{ status: 'rate_limited' }, { status: 'network_error' }] as const)(
    'does not store $status',
    async (result) => {
      const cache = createLookupCache(memoryArea());

      await cache.set('온보딩', result);

      expect(await cache.get('온보딩')).toBeUndefined();
    },
  );

  it('drops the oldest entry beyond the limit', async () => {
    const cache = createLookupCache(memoryArea());

    for (let index = 0; index <= MAX_CACHE_ENTRIES; index += 1) {
      await cache.set(`q${index}`, found(`q${index}`));
    }

    expect(await cache.get('q0')).toBeUndefined();
    expect(await cache.get('q1')).toEqual(found('q1'));
    expect(await cache.get(`q${MAX_CACHE_ENTRIES}`)).toEqual(found(`q${MAX_CACHE_ENTRIES}`));
  });

  it('ignores a corrupted stored value', async () => {
    const cache = createLookupCache(memoryArea({ lookupCache: 'broken' }));

    expect(await cache.get('온보딩')).toBeUndefined();
  });
});
```

`tests/unit/lookup/service.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { createLookupCache } from '../../../lib/lookup/cache';
import { createLookupService } from '../../../lib/lookup/service';
import type { LookupProvider, LookupResult } from '../../../lib/lookup/types';
import { memoryArea } from '../memory-area';

const FOUND: LookupResult = {
  status: 'found',
  title: 'SaaS',
  extract: '설명',
  url: 'https://ko.wikipedia.org/wiki/SaaS',
  isDisambiguation: false,
};

function fakeProvider(result: LookupResult) {
  return { lookup: vi.fn<LookupProvider['lookup']>(async () => result) };
}

describe('createLookupService', () => {
  it('asks the provider once and then serves from cache', async () => {
    const provider = fakeProvider(FOUND);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    expect(await lookup('SaaS')).toEqual(FOUND);
    expect(await lookup('SaaS')).toEqual(FOUND);
    expect(provider.lookup).toHaveBeenCalledTimes(1);
  });

  it('treats different letter case as the same query', async () => {
    const provider = fakeProvider(FOUND);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('SaaS');
    await lookup('saas');

    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(provider.lookup).toHaveBeenCalledWith('SaaS');
  });

  it('asks again after a network error', async () => {
    const provider = fakeProvider({ status: 'network_error' });
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('온보딩');
    await lookup('온보딩');

    expect(provider.lookup).toHaveBeenCalledTimes(2);
  });
});
```

`tests/unit/lookup/message-handler.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { createLookupMessageHandler } from '../../../lib/lookup/message-handler';
import type { LookupService } from '../../../lib/lookup/service';

describe('createLookupMessageHandler', () => {
  it('looks up the query of a lookup message', async () => {
    const lookup = vi.fn<LookupService>(async () => ({ status: 'not_found' }));
    const handle = createLookupMessageHandler(lookup);

    expect(await handle({ type: 'lookup', query: '갓생' })).toEqual({ status: 'not_found' });
    expect(lookup).toHaveBeenCalledWith('갓생');
  });

  it('ignores other messages', () => {
    const lookup = vi.fn<LookupService>();
    const handle = createLookupMessageHandler(lookup);

    expect(handle({ type: 'something-else' })).toBeUndefined();
    expect(lookup).not.toHaveBeenCalled();
  });
});
```

`tests/unit/messages.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { isLookupRequest, isLookupResult, isTriggerRequest } from '../../lib/messages';

describe('isLookupRequest', () => {
  it('accepts a lookup message with a string query', () => {
    expect(isLookupRequest({ type: 'lookup', query: '온보딩' })).toBe(true);
  });

  it.each([null, 'lookup', { type: 'lookup' }, { type: 'lookup', query: 3 }, { query: 'x' }])(
    'rejects %j',
    (message) => {
      expect(isLookupRequest(message)).toBe(false);
    },
  );
});

describe('isTriggerRequest', () => {
  it('accepts only the trigger message', () => {
    expect(isTriggerRequest({ type: 'trigger-from-shortcut' })).toBe(true);
    expect(isTriggerRequest({ type: 'lookup', query: 'x' })).toBe(false);
    expect(isTriggerRequest(undefined)).toBe(false);
  });
});

describe('isLookupResult', () => {
  it('accepts a complete found result', () => {
    expect(
      isLookupResult({
        status: 'found',
        title: '온보딩',
        extract: '설명',
        url: 'https://ko.wikipedia.org/wiki/x',
        isDisambiguation: false,
      }),
    ).toBe(true);
  });

  it.each(['not_found', 'rate_limited', 'network_error'])('accepts %s', (status) => {
    expect(isLookupResult({ status })).toBe(true);
  });

  it.each([
    undefined,
    { status: 'found', title: '온보딩' },
    { status: 'unknown' },
    'found',
  ])('rejects %j', (value) => {
    expect(isLookupResult(value)).toBe(false);
  });
});
```

`tests/unit/shortcut.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { LOOKUP_COMMAND, createShortcutHandler, type ShortcutDeps } from '../../lib/shortcut';

function deps(activeTabId: number | null = 7) {
  return {
    getActiveTabId: vi.fn<ShortcutDeps['getActiveTabId']>(async () => activeTabId ?? undefined),
    sendToTab: vi.fn<ShortcutDeps['sendToTab']>(async () => undefined),
  };
}

describe('createShortcutHandler', () => {
  it('sends the trigger message to the tab the command came from', async () => {
    const d = deps();

    await createShortcutHandler(d)(LOOKUP_COMMAND, 3);

    expect(d.sendToTab).toHaveBeenCalledWith(3, { type: 'trigger-from-shortcut' });
    expect(d.getActiveTabId).not.toHaveBeenCalled();
  });

  it('falls back to the active tab', async () => {
    const d = deps(7);

    await createShortcutHandler(d)(LOOKUP_COMMAND);

    expect(d.sendToTab).toHaveBeenCalledWith(7, { type: 'trigger-from-shortcut' });
  });

  it('ignores other commands', async () => {
    const d = deps();

    await createShortcutHandler(d)('other-command', 3);

    expect(d.sendToTab).not.toHaveBeenCalled();
  });

  it('does nothing without a tab', async () => {
    const d = deps(null);

    await createShortcutHandler(d)(LOOKUP_COMMAND);

    expect(d.sendToTab).not.toHaveBeenCalled();
  });

  it('does not throw when the tab has no content script', async () => {
    const d = deps();
    d.sendToTab.mockRejectedValue(new Error('Receiving end does not exist.'));

    await expect(createShortcutHandler(d)(LOOKUP_COMMAND, 3)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/lookup tests/unit/messages.test.ts tests/unit/shortcut.test.ts`
Expected: FAIL — 새 모듈 import 실패

- [ ] **Step 3: 구현**

`lib/storage.ts`
```ts
/** chrome.storage 영역 중 이 확장이 쓰는 최소 기능. 테스트에서 메모리 저장소로 바꿔 끼운다. */
export interface KeyValueArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}
```

`lib/messages.ts`
```ts
import type { LookupResult } from './lookup/types';

export const LOOKUP_MESSAGE = 'lookup';
export const TRIGGER_MESSAGE = 'trigger-from-shortcut';

export interface LookupRequest {
  type: typeof LOOKUP_MESSAGE;
  query: string;
}

export interface TriggerRequest {
  type: typeof TRIGGER_MESSAGE;
}

/** 페이지 → 백그라운드 조회 요청인지 확인한다. */
export function isLookupRequest(message: unknown): message is LookupRequest {
  return isRecord(message) && message.type === LOOKUP_MESSAGE && typeof message.query === 'string';
}

/** 백그라운드 → 페이지 단축키 알림인지 확인한다. */
export function isTriggerRequest(message: unknown): message is TriggerRequest {
  return isRecord(message) && message.type === TRIGGER_MESSAGE;
}

/** 백그라운드가 돌려준 응답이 올바른 조회 결과인지 확인한다. */
export function isLookupResult(value: unknown): value is LookupResult {
  if (!isRecord(value)) return false;
  switch (value.status) {
    case 'found':
      return (
        typeof value.title === 'string' &&
        typeof value.extract === 'string' &&
        typeof value.url === 'string' &&
        typeof value.isDisambiguation === 'boolean'
      );
    case 'not_found':
    case 'rate_limited':
    case 'network_error':
      return true;
    default:
      return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
```

`lib/lookup/cache.ts`
```ts
import type { KeyValueArea } from '../storage';
import type { LookupResult } from './types';

export const CACHE_STORAGE_KEY = 'lookupCache';
export const MAX_CACHE_ENTRIES = 200;

type CacheableResult = Extract<LookupResult, { status: 'found' | 'not_found' }>;
type CacheEntry = [query: string, result: CacheableResult];

export interface LookupCache {
  get(query: string): Promise<LookupResult | undefined>;
  set(query: string, result: LookupResult): Promise<void>;
}

/** 조회 결과를 저장소에 오래된 순으로 최대 200건까지 보관한다. 오류 결과는 보관하지 않는다. */
export function createLookupCache(area: KeyValueArea): LookupCache {
  async function readEntries(): Promise<CacheEntry[]> {
    const stored = (await area.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY];
    return Array.isArray(stored) ? (stored as CacheEntry[]) : [];
  }

  return {
    async get(query) {
      return (await readEntries()).find(([key]) => key === query)?.[1];
    },
    async set(query, result) {
      if (result.status !== 'found' && result.status !== 'not_found') return;
      const others = (await readEntries()).filter(([key]) => key !== query);
      const next: CacheEntry[] = [...others, [query, result] as CacheEntry].slice(
        -MAX_CACHE_ENTRIES,
      );
      await area.set({ [CACHE_STORAGE_KEY]: next });
    },
  };
}
```

`lib/lookup/service.ts`
```ts
import type { LookupCache } from './cache';
import type { LookupProvider, LookupResult } from './types';

export type LookupService = (query: string) => Promise<LookupResult>;

/** 캐시를 먼저 보고, 없으면 출처에 물어 저장한다. 대소문자만 다른 검색어는 같은 것으로 본다. */
export function createLookupService(provider: LookupProvider, cache: LookupCache): LookupService {
  return async (query) => {
    const key = query.toLowerCase();
    const cached = await cache.get(key);
    if (cached) return cached;
    const result = await provider.lookup(query);
    await cache.set(key, result);
    return result;
  };
}
```

`lib/lookup/message-handler.ts`
```ts
import { isLookupRequest } from '../messages';
import type { LookupService } from './service';
import type { LookupResult } from './types';

/** 백그라운드로 온 메시지 중 조회 요청만 처리한다. 다른 메시지면 undefined. */
export function createLookupMessageHandler(
  lookup: LookupService,
): (message: unknown) => Promise<LookupResult> | undefined {
  return (message) => (isLookupRequest(message) ? lookup(message.query) : undefined);
}
```

`lib/shortcut.ts`
```ts
import { TRIGGER_MESSAGE, type TriggerRequest } from './messages';

export const LOOKUP_COMMAND = 'lookup-selection';

export interface ShortcutDeps {
  getActiveTabId(): Promise<number | undefined>;
  sendToTab(tabId: number, message: TriggerRequest): Promise<unknown>;
}

/** 단축키가 눌리면 해당 탭의 페이지 쪽에 "지금 선택으로 찾기"를 알린다. */
export function createShortcutHandler(
  deps: ShortcutDeps,
): (command: string, tabId?: number) => Promise<void> {
  return async (command, tabId) => {
    if (command !== LOOKUP_COMMAND) return;
    const target = tabId ?? (await deps.getActiveTabId());
    if (target === undefined) return;
    try {
      await deps.sendToTab(target, { type: TRIGGER_MESSAGE });
    } catch {
      // chrome:// 페이지·웹스토어처럼 content script가 없는 탭은 받을 쪽이 없다. 할 일이 없으므로 무시한다.
    }
  };
}
```

`entrypoints/background.ts`
```ts
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { createLookupCache } from '../lib/lookup/cache';
import { createLookupMessageHandler } from '../lib/lookup/message-handler';
import { createLookupService } from '../lib/lookup/service';
import { createWikipediaKoProvider } from '../lib/lookup/wikipedia';
import { createShortcutHandler } from '../lib/shortcut';

export default defineBackground(() => {
  const provider = createWikipediaKoProvider({
    userAgent: `DragAndFind/${browser.runtime.getManifest().version}`,
  });
  const lookup = createLookupService(provider, createLookupCache(browser.storage.session));
  const handleLookup = createLookupMessageHandler(lookup);

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const pending = handleLookup(message);
    if (!pending) return undefined;
    void pending.then(sendResponse);
    return true;
  });

  const handleShortcut = createShortcutHandler({
    getActiveTabId: async () =>
      (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id,
    sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
  });

  browser.commands.onCommand.addListener((command, tab) => {
    void handleShortcut(command, tab?.id);
  });
});
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm build`
Expected: 전체 PASS, 오류 없음. `browser.storage.session`이 `KeyValueArea`에 맞지 않는다는 타입 오류가 나면 `lib/storage.ts`의 `get` 시그니처를 `get(keys: string): Promise<{ [key: string]: unknown }>`로 맞추고 다시 실행한다.

- [ ] **Step 5: Commit**

```bash
git add lib tests/unit entrypoints/background.ts
git commit -m "feat: 찾은 결과 기억하기와 단축키 처리를 백그라운드에 연결" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 카드·아이콘 위치 계산

**Files:**
- Create: `lib/ui/position.ts`
- Test: `tests/unit/ui/position.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface Rect { top: number; left: number; bottom: number; right: number }` (화면 좌표)
  - `interface Viewport { width: number; height: number; scrollX: number; scrollY: number }`
  - `interface CardSize { width: number; height: number }`
  - `interface CardPlacement { top: number; left: number; maxHeight: number; placement: 'below' | 'above' }` (문서 좌표)
  - `computeCardPlacement(anchor: Rect, card: CardSize, viewport: Viewport): CardPlacement`
  - `computeIconPosition(anchor: Rect, viewport: Viewport): { top: number; left: number }`
  - 상수 `CARD_GAP = 8`, `VIEWPORT_MARGIN = 8`, `MIN_CARD_HEIGHT = 80`, `ICON_SIZE = 28`, `ICON_GAP = 4`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/ui/position.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { computeCardPlacement, computeIconPosition, type Viewport } from '../../../lib/ui/position';

const VIEWPORT: Viewport = { width: 1000, height: 800, scrollX: 0, scrollY: 0 };
const CARD = { width: 320, height: 200 };
const anchorAt = (top: number, left = 50) => ({ top, bottom: top + 20, left, right: left + 60 });

describe('computeCardPlacement', () => {
  it('places the card below the selection', () => {
    expect(computeCardPlacement(anchorAt(100), CARD, VIEWPORT)).toEqual({
      top: 128,
      left: 50,
      maxHeight: 200,
      placement: 'below',
    });
  });

  it('converts to document coordinates using the scroll offset', () => {
    const scrolled = { ...VIEWPORT, scrollX: 10, scrollY: 500 };

    expect(computeCardPlacement(anchorAt(100), CARD, scrolled)).toMatchObject({
      top: 628,
      left: 60,
    });
  });

  it('flips above when there is not enough room below', () => {
    expect(computeCardPlacement(anchorAt(700), CARD, VIEWPORT)).toEqual({
      top: 492,
      left: 50,
      maxHeight: 200,
      placement: 'above',
    });
  });

  it('pushes the card back inside the right edge', () => {
    expect(computeCardPlacement(anchorAt(100, 900), CARD, VIEWPORT).left).toBe(672);
  });

  it('pushes the card back inside the left edge', () => {
    expect(computeCardPlacement(anchorAt(100, -20), CARD, VIEWPORT).left).toBe(8);
  });

  it('shrinks the card when neither side has enough room', () => {
    const short = { ...VIEWPORT, height: 300 };

    expect(computeCardPlacement(anchorAt(140), CARD, short)).toEqual({
      top: 168,
      left: 50,
      maxHeight: 124,
      placement: 'below',
    });
  });

  it('never shrinks below the minimum height', () => {
    const tiny = { ...VIEWPORT, height: 150 };

    expect(computeCardPlacement(anchorAt(60), CARD, tiny).maxHeight).toBe(80);
  });
});

describe('computeIconPosition', () => {
  it('places the icon above and right of the selection end', () => {
    expect(computeIconPosition({ top: 100, bottom: 120, left: 50, right: 200 }, VIEWPORT)).toEqual({
      top: 68,
      left: 204,
    });
  });

  it('places the icon below when the selection is at the top edge', () => {
    expect(computeIconPosition({ top: 10, bottom: 30, left: 50, right: 200 }, VIEWPORT).top).toBe(
      34,
    );
  });

  it('keeps the icon inside the right edge', () => {
    expect(computeIconPosition({ top: 100, bottom: 120, left: 900, right: 990 }, VIEWPORT).left).toBe(
      964,
    );
  });

  it('adds the scroll offset', () => {
    const scrolled = { ...VIEWPORT, scrollX: 5, scrollY: 300 };

    expect(computeIconPosition({ top: 100, bottom: 120, left: 50, right: 200 }, scrolled)).toEqual({
      top: 368,
      left: 209,
    });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/ui/position.test.ts`
Expected: FAIL — `Failed to resolve import "../../../lib/ui/position"`

- [ ] **Step 3: 구현**

`lib/ui/position.ts`
```ts
export const CARD_GAP = 8;
export const VIEWPORT_MARGIN = 8;
export const MIN_CARD_HEIGHT = 80;
export const ICON_SIZE = 28;
export const ICON_GAP = 4;

/** 화면(뷰포트) 기준 사각형. */
export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Viewport {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
}

export interface CardSize {
  width: number;
  height: number;
}

/** 문서 기준 좌표. 문서 좌표로 두면 스크롤해도 선택한 단어를 따라간다. */
export interface CardPlacement {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

/** 카드를 선택 아래에 두되, 공간이 부족하면 위로 뒤집고 좌우·높이를 화면 안으로 맞춘다. */
export function computeCardPlacement(anchor: Rect, card: CardSize, viewport: Viewport): CardPlacement {
  const spaceBelow = viewport.height - anchor.bottom - CARD_GAP - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - CARD_GAP - VIEWPORT_MARGIN;
  const placeBelow = card.height <= spaceBelow || spaceBelow >= spaceAbove;
  const available = placeBelow ? spaceBelow : spaceAbove;
  const height = Math.min(card.height, Math.max(available, MIN_CARD_HEIGHT));
  const top = placeBelow ? anchor.bottom + CARD_GAP : anchor.top - CARD_GAP - height;
  const left = clamp(anchor.left, VIEWPORT_MARGIN, viewport.width - VIEWPORT_MARGIN - card.width);
  return {
    top: top + viewport.scrollY,
    left: left + viewport.scrollX,
    maxHeight: height,
    placement: placeBelow ? 'below' : 'above',
  };
}

/** 아이콘을 선택 끝의 오른쪽 위에 두고, 위쪽이 막히면 아래로 내린다. */
export function computeIconPosition(anchor: Rect, viewport: Viewport): { top: number; left: number } {
  const aboveTop = anchor.top - ICON_SIZE - ICON_GAP;
  const top = aboveTop >= 0 ? aboveTop : anchor.bottom + ICON_GAP;
  const left = Math.min(anchor.right + ICON_GAP, viewport.width - VIEWPORT_MARGIN - ICON_SIZE);
  return { top: top + viewport.scrollY, left: left + viewport.scrollX };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test tests/unit/ui/position.test.ts && pnpm compile && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ui/position.ts tests/unit/ui/position.test.ts
git commit -m "feat: 카드와 아이콘이 화면 밖으로 나가지 않게 위치 계산" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 카드·아이콘 화면

**Files:**
- Create: `lib/ui/styles.ts`, `lib/ui/card.ts`, `lib/ui/overlay.ts`
- Test: `tests/unit/ui/card.test.ts`, `tests/unit/ui/overlay.test.ts`

**Interfaces:**
- Consumes: Task 2 `googleSearchUrl`, `naverSearchUrl`, `MAX_QUERY_LENGTH`; Task 3 `LookupResult`; Task 5 `Rect`, `Viewport`, `computeCardPlacement`, `computeIconPosition`
- Produces:
  - `type CardState = { kind: 'loading' } | { kind: 'result'; result: LookupResult } | { kind: 'too_long' }`
  - `interface CardHandlers { onClose(): void; onRetry(): void }`
  - `renderCard(card: HTMLElement, query: string, state: CardState, handlers: CardHandlers): void`
  - `HOST_TAG = 'drag-and-find-root'`
  - `interface Overlay { showIcon(anchor: Rect, onActivate: () => void): void; hideIcon(): void; showCard(anchor: Rect, query: string, state: CardState, handlers: CardHandlers): void; hideCard(): void; contains(event: Event): boolean }`
  - `createOverlay(doc: Document, win: Window): Overlay`
  - 요소 표식 `data-role`: `icon`, `card`, `title`, `body`, `extract`, `wiki-link`, `retry`, `close`, `google`, `naver`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/ui/card.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderCard, type CardHandlers } from '../../../lib/ui/card';

let card: HTMLElement;
let handlers: CardHandlers;

const part = (role: string) => card.querySelector<HTMLElement>(`[data-role="${role}"]`);

beforeEach(() => {
  card = document.createElement('section');
  handlers = { onClose: vi.fn(), onRetry: vi.fn() };
});

describe('renderCard', () => {
  it('shows loading text with the query and search buttons', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    expect(part('title')?.textContent).toBe('온보딩');
    expect(part('body')?.textContent).toBe('찾는 중…');
    expect(part('google')?.getAttribute('href')).toBe(
      'https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
    expect(part('naver')?.getAttribute('href')).toBe(
      'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
    );
  });

  it('opens search buttons in a new tab safely', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    for (const role of ['google', 'naver']) {
      expect(part(role)?.getAttribute('target')).toBe('_blank');
      expect(part(role)?.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });

  it('shows the article title, extract and wiki link when found', () => {
    renderCard(
      card,
      'SaaS',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: '서비스형 소프트웨어',
          extract: '응용 소프트웨어를 서비스로 제공하는 방식',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(part('title')?.textContent).toBe('서비스형 소프트웨어');
    expect(part('extract')?.textContent).toBe('응용 소프트웨어를 서비스로 제공하는 방식');
    expect(part('wiki-link')?.getAttribute('href')).toBe('https://ko.wikipedia.org/wiki/x');
    expect(part('wiki-link')?.textContent).toBe('위키백과에서 보기 →');
    expect(part('google')?.getAttribute('href')).toBe('https://www.google.com/search?q=SaaS');
  });

  it('never turns the extract into HTML', () => {
    renderCard(
      card,
      'x',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'x',
          extract: '<img src=x onerror=alert(1)>',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );

    expect(card.querySelector('img')).toBeNull();
    expect(part('extract')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('shows the disambiguation notice with the wiki link', () => {
    renderCard(
      card,
      'POC',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'POC',
          extract: '여러 뜻',
          url: 'https://ko.wikipedia.org/wiki/POC',
          isDisambiguation: true,
        },
      },
      handlers,
    );

    expect(part('body')?.textContent).toContain('뜻이 여러 개인 단어입니다');
    expect(part('extract')).toBeNull();
    expect(part('wiki-link')).not.toBeNull();
  });

  it.each([
    ['not_found', '위키백과에 문서가 없습니다'],
    ['rate_limited', '요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요'],
  ] as const)('shows the %s message with search buttons', (status, message) => {
    renderCard(card, '갓생', { kind: 'result', result: { status } }, handlers);

    expect(part('body')?.textContent).toBe(message);
    expect(part('google')).not.toBeNull();
    expect(part('naver')).not.toBeNull();
  });

  it('offers a retry button on network errors', () => {
    renderCard(card, '온보딩', { kind: 'result', result: { status: 'network_error' } }, handlers);

    expect(part('body')?.textContent).toContain('연결에 실패했습니다');
    part('retry')?.click();
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the too-long notice without search buttons', () => {
    renderCard(card, '', { kind: 'too_long' }, handlers);

    expect(part('body')?.textContent).toBe('선택이 너무 깁니다 (50자 이하)');
    expect(part('google')).toBeNull();
    expect(part('naver')).toBeNull();
  });

  it('calls onClose from the close button', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    part('close')?.click();

    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous content on re-render', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);
    renderCard(card, '온보딩', { kind: 'result', result: { status: 'not_found' } }, handlers);

    expect(card.querySelectorAll('[data-role="body"]')).toHaveLength(1);
  });
});
```

`tests/unit/ui/overlay.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HOST_TAG, createOverlay } from '../../../lib/ui/overlay';

const ANCHOR = { top: 100, bottom: 120, left: 50, right: 110 };
const handlers = () => ({ onClose: vi.fn(), onRetry: vi.fn() });

beforeEach(() => {
  document.querySelectorAll(HOST_TAG).forEach((host) => host.remove());
});

const host = () => document.querySelector(HOST_TAG) as HTMLElement | null;
const inShadow = (role: string) =>
  host()?.shadowRoot?.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? null;

describe('createOverlay', () => {
  it('mounts a single shadow host on the html element at the top layer', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());

    expect(document.querySelectorAll(HOST_TAG)).toHaveLength(1);
    expect(host()?.parentElement).toBe(document.documentElement);
    expect(host()?.shadowRoot).not.toBeNull();
    expect(host()?.style.zIndex).toBe('2147483647');
  });

  it('shows an icon at document coordinates that runs the callback when clicked', () => {
    const overlay = createOverlay(document, window);
    const onActivate = vi.fn();

    overlay.showIcon(ANCHOR, onActivate);
    const icon = inShadow('icon');

    expect(icon?.style.top).toBe('68px');
    expect(icon?.style.left).toBe('114px');
    icon?.click();
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('keeps only one icon', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.showIcon(ANCHOR, vi.fn());

    expect(host()?.shadowRoot?.querySelectorAll('[data-role="icon"]')).toHaveLength(1);
  });

  it('removes the icon', () => {
    const overlay = createOverlay(document, window);

    overlay.showIcon(ANCHOR, vi.fn());
    overlay.hideIcon();

    expect(inShadow('icon')).toBeNull();
  });

  it('places the card below the selection and reuses it on update', () => {
    const overlay = createOverlay(document, window);

    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());
    overlay.showCard(ANCHOR, '온보딩', { kind: 'result', result: { status: 'not_found' } }, handlers());

    const cards = host()?.shadowRoot?.querySelectorAll('[data-role="card"]');
    expect(cards).toHaveLength(1);
    expect(inShadow('card')?.style.top).toBe('128px');
    expect(inShadow('card')?.style.left).toBe('50px');
    expect(inShadow('body')?.textContent).toBe('위키백과에 문서가 없습니다');
  });

  it('removes the card', () => {
    const overlay = createOverlay(document, window);

    overlay.showCard(ANCHOR, '온보딩', { kind: 'loading' }, handlers());
    overlay.hideCard();

    expect(inShadow('card')).toBeNull();
  });

  it('tells whether an event happened inside the overlay', () => {
    const overlay = createOverlay(document, window);
    overlay.showIcon(ANCHOR, vi.fn());
    const seen: boolean[] = [];
    document.addEventListener('mousedown', (event) => seen.push(overlay.contains(event)), {
      capture: true,
      once: true,
    });

    inShadow('icon')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(seen).toEqual([true]);
    expect(overlay.contains(new MouseEvent('mousedown'))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/ui`
Expected: FAIL — `Failed to resolve import "../../../lib/ui/card"` 등

- [ ] **Step 3: 구현**

`lib/ui/styles.ts`
```ts
/** Shadow DOM 안에서만 적용되는 임시 스타일. 시각 디자인은 공개 전 시안 단계에서 교체한다. */
export const OVERLAY_CSS = `
:host {
  --dnf-surface: #ffffff;
  --dnf-text: #1f2328;
  --dnf-muted: #59636e;
  --dnf-border: #d0d7de;
  --dnf-accent: #0969da;
  --dnf-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
  --dnf-radius: 10px;
  font-family: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host {
    --dnf-surface: #1f2328;
    --dnf-text: #e6edf3;
    --dnf-muted: #9198a1;
    --dnf-border: #3d444d;
    --dnf-accent: #4493f8;
  }
}
.icon {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 1px solid var(--dnf-border);
  border-radius: 50%;
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.card {
  position: absolute;
  box-sizing: border-box;
  width: 320px;
  overflow: auto;
  border: 1px solid var(--dnf-border);
  border-radius: var(--dnf-radius);
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  color: var(--dnf-text);
  font-size: 14px;
  line-height: 1.5;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 4px;
}
.card-title { font-weight: 700; font-size: 15px; }
.card-close { border: 0; background: none; color: var(--dnf-muted); cursor: pointer; font-size: 14px; }
.card-body { padding: 0 12px 10px; }
.card-extract {
  margin: 0 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-message { margin: 0 0 6px; color: var(--dnf-muted); }
.card-link { color: var(--dnf-accent); text-decoration: none; font-size: 13px; }
.card-retry { margin-left: 6px; cursor: pointer; }
.card-actions { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--dnf-border); }
.card-action {
  flex: 1;
  padding: 6px 0;
  border: 1px solid var(--dnf-border);
  border-radius: 6px;
  color: var(--dnf-text);
  text-align: center;
  text-decoration: none;
  font-size: 13px;
}
.card-action:hover, .card-action:focus-visible { border-color: var(--dnf-accent); color: var(--dnf-accent); }
`;
```

`lib/ui/card.ts`
```ts
import type { LookupResult } from '../lookup/types';
import { googleSearchUrl, naverSearchUrl } from '../search-urls';
import { MAX_QUERY_LENGTH } from '../selection';

export type CardState =
  | { kind: 'loading' }
  | { kind: 'result'; result: LookupResult }
  | { kind: 'too_long' };

export interface CardHandlers {
  onClose(): void;
  onRetry(): void;
}

interface ElementOptions {
  className?: string;
  role?: string;
  text?: string;
}

/** 카드 내용을 상태에 맞게 다시 그린다. 외부 문자열은 모두 textContent로만 넣는다. */
export function renderCard(
  card: HTMLElement,
  query: string,
  state: CardState,
  handlers: CardHandlers,
): void {
  const doc = card.ownerDocument;
  const header = buildHeader(doc, titleFor(query, state), handlers.onClose);
  const body = element(doc, 'div', { className: 'card-body', role: 'body' });
  body.append(...bodyContent(doc, state, handlers.onRetry));
  const actions = state.kind === 'too_long' ? [] : [buildActions(doc, query)];
  card.replaceChildren(header, body, ...actions);
}

function titleFor(query: string, state: CardState): string {
  if (state.kind === 'too_long') return '선택한 글';
  if (state.kind === 'result' && state.result.status === 'found') return state.result.title;
  return query;
}

function bodyContent(doc: Document, state: CardState, onRetry: () => void): Node[] {
  if (state.kind === 'loading') return [doc.createTextNode('찾는 중…')];
  if (state.kind === 'too_long') {
    return [doc.createTextNode(`선택이 너무 깁니다 (${MAX_QUERY_LENGTH}자 이하)`)];
  }
  const { result } = state;
  switch (result.status) {
    case 'found':
      return result.isDisambiguation
        ? [message(doc, '뜻이 여러 개인 단어입니다'), wikiLink(doc, result.url)]
        : [
            element(doc, 'p', { className: 'card-extract', role: 'extract', text: result.extract }),
            wikiLink(doc, result.url),
          ];
    case 'not_found':
      return [doc.createTextNode('위키백과에 문서가 없습니다')];
    case 'rate_limited':
      return [doc.createTextNode('요청이 많아 잠시 막혔습니다. 잠시 후 다시 시도해 주세요')];
    case 'network_error':
      return [doc.createTextNode('연결에 실패했습니다'), retryButton(doc, onRetry)];
  }
}

function buildHeader(doc: Document, title: string, onClose: () => void): HTMLElement {
  const header = element(doc, 'header', { className: 'card-header' });
  const close = element(doc, 'button', { className: 'card-close', role: 'close', text: '✕' });
  close.setAttribute('type', 'button');
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', onClose);
  header.append(element(doc, 'strong', { className: 'card-title', role: 'title', text: title }), close);
  return header;
}

function buildActions(doc: Document, query: string): HTMLElement {
  const actions = element(doc, 'footer', { className: 'card-actions' });
  actions.append(
    externalLink(doc, googleSearchUrl(query), '구글 검색', 'google', 'card-action'),
    externalLink(doc, naverSearchUrl(query), '네이버 검색', 'naver', 'card-action'),
  );
  return actions;
}

function message(doc: Document, text: string): HTMLElement {
  return element(doc, 'p', { className: 'card-message', text });
}

function wikiLink(doc: Document, url: string): HTMLElement {
  return externalLink(doc, url, '위키백과에서 보기 →', 'wiki-link', 'card-link');
}

function retryButton(doc: Document, onRetry: () => void): HTMLElement {
  const button = element(doc, 'button', { className: 'card-retry', role: 'retry', text: '다시 시도' });
  button.setAttribute('type', 'button');
  button.addEventListener('click', onRetry);
  return button;
}

function externalLink(
  doc: Document,
  href: string,
  text: string,
  role: string,
  className: string,
): HTMLElement {
  const link = element(doc, 'a', { className, role, text });
  link.setAttribute('href', href);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener noreferrer');
  return link;
}

function element(doc: Document, tag: string, options: ElementOptions): HTMLElement {
  const node = doc.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.role) node.dataset.role = options.role;
  if (options.text !== undefined) node.textContent = options.text;
  return node;
}
```

`lib/ui/overlay.ts`
```ts
import { renderCard, type CardHandlers, type CardState } from './card';
import { computeCardPlacement, computeIconPosition, type Rect, type Viewport } from './position';
import { OVERLAY_CSS } from './styles';

export const HOST_TAG = 'drag-and-find-root';
const TOP_LAYER_Z_INDEX = '2147483647';

export interface Overlay {
  showIcon(anchor: Rect, onActivate: () => void): void;
  hideIcon(): void;
  showCard(anchor: Rect, query: string, state: CardState, handlers: CardHandlers): void;
  hideCard(): void;
  contains(event: Event): boolean;
}

/** 페이지 CSS와 격리된 Shadow DOM에 아이콘과 카드를 문서 좌표로 띄운다. */
export function createOverlay(doc: Document, win: Window): Overlay {
  const host = doc.createElement(HOST_TAG);
  Object.assign(host.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '0',
    height: '0',
    zIndex: TOP_LAYER_Z_INDEX,
  });
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = OVERLAY_CSS;
  shadow.append(style);

  let icon: HTMLElement | null = null;
  let card: HTMLElement | null = null;

  const viewport = (): Viewport => ({
    width: win.innerWidth,
    height: win.innerHeight,
    scrollX: win.scrollX,
    scrollY: win.scrollY,
  });

  const mount = () => {
    if (!host.isConnected) doc.documentElement.append(host);
  };

  const place = (target: HTMLElement, top: number, left: number) => {
    target.style.top = `${top}px`;
    target.style.left = `${left}px`;
  };

  return {
    showIcon(anchor, onActivate) {
      mount();
      icon?.remove();
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'icon';
      button.dataset.role = 'icon';
      button.setAttribute('aria-label', '선택한 단어 찾기');
      button.textContent = '🔍';
      button.addEventListener('click', onActivate);
      const position = computeIconPosition(anchor, viewport());
      place(button, position.top, position.left);
      shadow.append(button);
      icon = button;
    },
    hideIcon() {
      icon?.remove();
      icon = null;
    },
    showCard(anchor, query, state, handlers) {
      mount();
      if (!card) {
        card = doc.createElement('section');
        card.className = 'card';
        card.dataset.role = 'card';
        shadow.append(card);
      }
      renderCard(card, query, state, handlers);
      card.style.maxHeight = '';
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      const placement = computeCardPlacement(anchor, size, viewport());
      place(card, placement.top, placement.left);
      card.style.maxHeight = `${placement.maxHeight}px`;
    },
    hideCard() {
      card?.remove();
      card = null;
    },
    contains(event) {
      return event.composedPath().includes(host);
    },
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test tests/unit/ui && pnpm compile && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ui tests/unit/ui
git commit -m "feat: 검색 아이콘과 결과 카드 화면 추가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 페이지 쪽 연결 (선택 → 아이콘 → 카드)

**Files:**
- Create: `lib/settings.ts`, `lib/lookup/client.ts`, `lib/content/controller.ts`
- Modify: `entrypoints/content.ts`
- Test: `tests/unit/settings.test.ts`, `tests/unit/lookup/client.test.ts`, `tests/unit/content/controller.test.ts`

**Interfaces:**
- Consumes: Task 2 `checkSelection`, `isInEditableContext`; Task 3 `LookupResult`; Task 4 `KeyValueArea`, `LOOKUP_MESSAGE`, `isLookupResult`, `isTriggerRequest`; Task 5 `Rect`; Task 6 `Overlay`, `CardState`, `createOverlay`
- Produces:
  - `SETTINGS_KEY = 'settings'`, `interface Settings { showIcon: boolean }`, `DEFAULT_SETTINGS`, `parseSettings(raw: unknown): Settings`, `loadSettings(area): Promise<Settings>`, `saveSettings(area, settings): Promise<void>`
  - `createLookupClient(send: (message: LookupRequest) => Promise<unknown>): (query: string) => Promise<LookupResult>`
  - `interface ControllerDeps { win: Window; overlay: Overlay; requestLookup(query: string): Promise<LookupResult>; isIconEnabled(): Promise<boolean> }`
  - `createController(deps): Controller` — `Controller = { handleMouseUp(event: Event): void; handleMouseDown(event: Event): void; handleKeyDown(event: KeyboardEvent): void; handleShortcut(): void }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/settings.test.ts`
```ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings } from '../../lib/settings';
import { memoryArea } from './memory-area';

describe('settings', () => {
  it('uses defaults when nothing is stored', async () => {
    expect(await loadSettings(memoryArea())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.showIcon).toBe(true);
  });

  it('reads what was saved', async () => {
    const area = memoryArea();

    await saveSettings(area, { showIcon: false });

    expect(await loadSettings(area)).toEqual({ showIcon: false });
  });

  it.each([null, 'off', { showIcon: 'no' }, []])('falls back to defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });
});
```

`tests/unit/lookup/client.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest';
import { createLookupClient } from '../../../lib/lookup/client';
import type { LookupRequest } from '../../../lib/messages';

type Send = (message: LookupRequest) => Promise<unknown>;

describe('createLookupClient', () => {
  it('sends a lookup message and returns a valid result', async () => {
    const send = vi.fn<Send>(async () => ({ status: 'not_found' }));

    const result = await createLookupClient(send)('갓생');

    expect(send).toHaveBeenCalledWith({ type: 'lookup', query: '갓생' });
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns network_error when the extension connection is gone', async () => {
    const send = vi.fn<Send>(async () => {
      throw new Error('Extension context invalidated.');
    });

    expect(await createLookupClient(send)('온보딩')).toEqual({ status: 'network_error' });
  });

  it('returns network_error for a malformed response', async () => {
    const send = vi.fn<Send>(async () => ({ status: 'found' }));

    expect(await createLookupClient(send)('온보딩')).toEqual({ status: 'network_error' });
  });
});
```

`tests/unit/content/controller.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createController, type ControllerDeps } from '../../../lib/content/controller';
import type { LookupResult } from '../../../lib/lookup/types';
import type { Overlay } from '../../../lib/ui/overlay';

const FOUND: LookupResult = {
  status: 'found',
  title: '온보딩',
  extract: '설명',
  url: 'https://ko.wikipedia.org/wiki/x',
  isDisambiguation: false,
};

function fakeOverlay() {
  return {
    showIcon: vi.fn<Overlay['showIcon']>(),
    hideIcon: vi.fn<Overlay['hideIcon']>(),
    showCard: vi.fn<Overlay['showCard']>(),
    hideCard: vi.fn<Overlay['hideCard']>(),
    contains: vi.fn<Overlay['contains']>(() => false),
  };
}

function setup(overrides: Partial<ControllerDeps> = {}) {
  const overlay = fakeOverlay();
  const requestLookup = vi.fn<ControllerDeps['requestLookup']>(async () => FOUND);
  const controller = createController({
    win: window,
    overlay,
    requestLookup,
    isIconEnabled: async () => true,
    ...overrides,
  });
  return { overlay, requestLookup, controller };
}

function selectContentsOf(id: string) {
  const range = document.createRange();
  range.selectNodeContents(document.getElementById(id)!);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const settle = async () => {
  await tick();
  await tick();
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const lastCardState = (overlay: ReturnType<typeof fakeOverlay>) =>
  overlay.showCard.mock.calls.at(-1)?.[2];

beforeEach(() => {
  document.body.innerHTML = `
    <p>요즘 <span id="term">온보딩</span> 과정을 다룬다.</p>
    <p><span id="quoted">"온보딩",</span></p>
    <p><span id="long">${'가'.repeat(51)}</span></p>
    <div contenteditable="true"><span id="editable">온보딩</span></div>`;
  window.getSelection()?.removeAllRanges();
});

describe('mouse selection', () => {
  it('shows the icon after selecting a word', async () => {
    const { overlay, controller } = setup();
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).toHaveBeenCalledTimes(1);
  });

  it('does not show the icon when it is turned off', async () => {
    const { overlay, controller } = setup({ isIconEnabled: async () => false });
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
    expect(overlay.hideIcon).toHaveBeenCalled();
  });

  it.each(['editable', 'long'])('does not show the icon for the %s selection', async (id) => {
    const { overlay, controller } = setup();
    selectContentsOf(id);

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
  });

  it('ignores mouseup inside the overlay', async () => {
    const { overlay, controller } = setup();
    overlay.contains.mockReturnValue(true);
    selectContentsOf('term');

    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    expect(overlay.showIcon).not.toHaveBeenCalled();
  });

  it('clicking the icon shows loading and then the result', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('quoted');
    controller.handleMouseUp(new MouseEvent('mouseup'));
    await settle();

    overlay.showIcon.mock.calls[0][1]();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩');
    expect(overlay.showCard.mock.calls[0][2]).toEqual({ kind: 'loading' });
    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: FOUND });
    expect(overlay.hideIcon).toHaveBeenCalled();
  });
});

describe('shortcut', () => {
  it('looks up the normalized selection', async () => {
    const { requestLookup, controller } = setup();
    selectContentsOf('quoted');

    controller.handleShortcut();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩');
  });

  it('shows the too-long card without looking up', () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('long');

    controller.handleShortcut();

    expect(lastCardState(overlay)).toEqual({ kind: 'too_long' });
    expect(requestLookup).not.toHaveBeenCalled();
  });

  it('does nothing without a selection', () => {
    const { overlay, controller } = setup();

    controller.handleShortcut();

    expect(overlay.showCard).not.toHaveBeenCalled();
  });

  it('does nothing inside an editable area', () => {
    const { overlay, controller } = setup();
    selectContentsOf('editable');

    controller.handleShortcut();

    expect(overlay.showCard).not.toHaveBeenCalled();
  });
});

describe('late responses', () => {
  it('shows only the latest lookup when an earlier response arrives late', async () => {
    const first = deferred<LookupResult>();
    const second = deferred<LookupResult>();
    const requestLookup = vi
      .fn<ControllerDeps['requestLookup']>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { overlay, controller } = setup({ requestLookup });
    selectContentsOf('term');

    controller.handleShortcut();
    controller.handleShortcut();
    second.resolve({ status: 'not_found' });
    await settle();
    first.resolve(FOUND);
    await settle();

    expect(lastCardState(overlay)).toEqual({ kind: 'result', result: { status: 'not_found' } });
  });

  it('does not reopen the card when a response arrives after closing with Esc', async () => {
    const pending = deferred<LookupResult>();
    const { overlay, controller } = setup({ requestLookup: () => pending.promise });
    selectContentsOf('term');

    controller.handleShortcut();
    controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    const callsAfterClose = overlay.showCard.mock.calls.length;
    pending.resolve(FOUND);
    await settle();

    expect(overlay.hideCard).toHaveBeenCalled();
    expect(overlay.showCard.mock.calls).toHaveLength(callsAfterClose);
  });

  it('retry looks up the same word again', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onRetry();
    await settle();

    expect(requestLookup).toHaveBeenCalledTimes(2);
    expect(requestLookup).toHaveBeenLastCalledWith('온보딩');
  });
});

describe('closing', () => {
  it('closes on mousedown outside the overlay', () => {
    const { overlay, controller } = setup();

    controller.handleMouseDown(new MouseEvent('mousedown'));

    expect(overlay.hideCard).toHaveBeenCalled();
    expect(overlay.hideIcon).toHaveBeenCalled();
  });

  it('stays open on mousedown inside the overlay', () => {
    const { overlay, controller } = setup();
    overlay.contains.mockReturnValue(true);

    controller.handleMouseDown(new MouseEvent('mousedown'));

    expect(overlay.hideCard).not.toHaveBeenCalled();
  });

  it('ignores keys other than Escape', () => {
    const { overlay, controller } = setup();

    controller.handleKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(overlay.hideCard).not.toHaveBeenCalled();
  });

  it('the close button handler closes the card', async () => {
    const { overlay, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onClose();

    expect(overlay.hideCard).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/settings.test.ts tests/unit/lookup/client.test.ts tests/unit/content`
Expected: FAIL — 새 모듈 import 실패

- [ ] **Step 3: 구현**

`lib/settings.ts`
```ts
import type { KeyValueArea } from './storage';

export const SETTINGS_KEY = 'settings';

export interface Settings {
  showIcon: boolean;
}

export const DEFAULT_SETTINGS: Settings = { showIcon: true };

/** 저장된 값을 검증해 설정으로 바꾼다. 형식이 틀리면 기본값을 쓴다. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const { showIcon } = raw as Record<string, unknown>;
  return { showIcon: typeof showIcon === 'boolean' ? showIcon : DEFAULT_SETTINGS.showIcon };
}

/** 저장소에서 설정을 읽는다. */
export async function loadSettings(area: KeyValueArea): Promise<Settings> {
  return parseSettings((await area.get(SETTINGS_KEY))[SETTINGS_KEY]);
}

/** 설정을 저장소에 쓴다. */
export async function saveSettings(area: KeyValueArea, settings: Settings): Promise<void> {
  await area.set({ [SETTINGS_KEY]: settings });
}
```

`lib/lookup/client.ts`
```ts
import { LOOKUP_MESSAGE, isLookupResult, type LookupRequest } from '../messages';
import type { LookupResult } from './types';

/** 페이지 쪽에서 백그라운드에 조회를 요청한다. 연결이 끊기거나 응답이 깨지면 network_error. */
export function createLookupClient(
  send: (message: LookupRequest) => Promise<unknown>,
): (query: string) => Promise<LookupResult> {
  return async (query) => {
    try {
      const response = await send({ type: LOOKUP_MESSAGE, query });
      return isLookupResult(response) ? response : { status: 'network_error' };
    } catch {
      // 확장이 업데이트·재시작되면 이미 열린 페이지와의 연결이 끊긴다. 사용자에게는 연결 실패로 보여 준다.
      return { status: 'network_error' };
    }
  };
}
```

`lib/content/controller.ts`
```ts
import type { LookupResult } from '../lookup/types';
import { checkSelection, isInEditableContext } from '../selection';
import type { CardState } from '../ui/card';
import type { Overlay } from '../ui/overlay';
import type { Rect } from '../ui/position';

export interface ControllerDeps {
  win: Window;
  overlay: Overlay;
  requestLookup(query: string): Promise<LookupResult>;
  isIconEnabled(): Promise<boolean>;
}

export interface Controller {
  handleMouseUp(event: Event): void;
  handleMouseDown(event: Event): void;
  handleKeyDown(event: KeyboardEvent): void;
  handleShortcut(): void;
}

interface SelectionSnapshot {
  text: string;
  anchor: Rect;
}

/** 선택·클릭·키 입력을 받아 아이콘과 카드를 제어한다. 마지막 요청의 결과만 카드에 반영한다. */
export function createController(deps: ControllerDeps): Controller {
  const { win, overlay } = deps;
  let latestRequestId = 0;

  function readSelection(): SelectionSnapshot | null {
    const selection = win.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    if (isInEditableContext(selection.anchorNode, win.document.activeElement)) return null;
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rects = range.getClientRects();
    const last = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect();
    return {
      text: selection.toString(),
      anchor: { top: last.top, left: last.left, bottom: last.bottom, right: last.right },
    };
  }

  function closeAll(): void {
    latestRequestId += 1;
    overlay.hideCard();
    overlay.hideIcon();
  }

  function showCard(anchor: Rect, query: string, state: CardState): void {
    overlay.showCard(anchor, query, state, {
      onClose: closeAll,
      onRetry: () => void lookUp(query, anchor),
    });
  }

  async function lookUp(query: string, anchor: Rect): Promise<void> {
    latestRequestId += 1;
    const requestId = latestRequestId;
    overlay.hideIcon();
    showCard(anchor, query, { kind: 'loading' });
    const result = await deps.requestLookup(query);
    if (requestId !== latestRequestId) return;
    showCard(anchor, query, { kind: 'result', result });
  }

  async function showIconForSelection(): Promise<void> {
    const snapshot = readSelection();
    const check = snapshot ? checkSelection(snapshot.text) : null;
    if (!snapshot || check?.kind !== 'ok' || !(await deps.isIconEnabled())) {
      overlay.hideIcon();
      return;
    }
    overlay.showIcon(snapshot.anchor, () => void lookUp(check.query, snapshot.anchor));
  }

  return {
    handleMouseUp(event) {
      if (overlay.contains(event)) return;
      // 클릭으로 선택이 풀리는 경우 mouseup 직후에야 선택 상태가 확정된다.
      win.setTimeout(() => void showIconForSelection(), 0);
    },
    handleMouseDown(event) {
      if (!overlay.contains(event)) closeAll();
    },
    handleKeyDown(event) {
      if (event.key === 'Escape') closeAll();
    },
    handleShortcut() {
      const snapshot = readSelection();
      if (!snapshot) return;
      const check = checkSelection(snapshot.text);
      if (check.kind === 'empty') return;
      if (check.kind === 'too_long') {
        latestRequestId += 1;
        overlay.hideIcon();
        showCard(snapshot.anchor, '', { kind: 'too_long' });
        return;
      }
      void lookUp(check.query, snapshot.anchor);
    },
  };
}
```

`entrypoints/content.ts`
```ts
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { createController } from '../lib/content/controller';
import { createLookupClient } from '../lib/lookup/client';
import { isTriggerRequest } from '../lib/messages';
import { loadSettings } from '../lib/settings';
import { createOverlay } from '../lib/ui/overlay';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    const controller = createController({
      win: window,
      overlay: createOverlay(document, window),
      requestLookup: createLookupClient((message) => browser.runtime.sendMessage(message)),
      isIconEnabled: async () => (await loadSettings(browser.storage.local)).showIcon,
    });

    document.addEventListener('mouseup', controller.handleMouseUp, true);
    document.addEventListener('mousedown', controller.handleMouseDown, true);
    document.addEventListener('keydown', controller.handleKeyDown, true);
    browser.runtime.onMessage.addListener((message) => {
      if (isTriggerRequest(message)) controller.handleShortcut();
    });
  },
});
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm build`
Expected: 전체 PASS, 빌드 성공

- [ ] **Step 5: 크롬에서 직접 확인**

`pnpm build` 후 `chrome://extensions`에서 `.output/chrome-mv3`를 로드(이미 로드했다면 새로고침)한다. 아무 한국어 기사에서:
- 단어를 더블클릭 → 🔍 표시 → 클릭 → 카드에 위키백과 요약 표시
- Esc, 바깥 클릭으로 닫힘
- 화면 맨 아래 단어 → 카드가 위로 뜸

- [ ] **Step 6: Commit**

```bash
git add lib tests/unit entrypoints/content.ts
git commit -m "feat: 드래그하면 아이콘을 띄우고 누르면 결과 카드를 보여 주도록 연결" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 설정 화면

**Files:**
- Create: `lib/options-page.ts`, `entrypoints/options/index.html`, `entrypoints/options/main.ts`
- Test: `tests/unit/options-page.test.ts`

**Interfaces:**
- Consumes: Task 4 `KeyValueArea`, `LOOKUP_COMMAND`; Task 7 `loadSettings`, `saveSettings`
- Produces:
  - `interface OptionsPageDeps { area: KeyValueArea; getShortcut(): Promise<string | undefined>; openShortcutSettings(): Promise<void> }`
  - `initOptionsPage(doc: Document, deps: OptionsPageDeps): Promise<void>`
  - 마크업 id: `show-icon`(checkbox), `shortcut`(표시), `change-shortcut`(버튼)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/options-page.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initOptionsPage, type OptionsPageDeps } from '../../lib/options-page';
import { loadSettings, saveSettings } from '../../lib/settings';
import { memoryArea } from './memory-area';

const MARKUP = `
  <input id="show-icon" type="checkbox" />
  <span id="shortcut"></span>
  <button id="change-shortcut" type="button"></button>`;

function deps(overrides: Partial<OptionsPageDeps> = {}): OptionsPageDeps {
  return {
    area: memoryArea(),
    getShortcut: async () => '⌥⇧F',
    openShortcutSettings: vi.fn(async () => undefined),
    ...overrides,
  };
}

const checkbox = () => document.getElementById('show-icon') as HTMLInputElement;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.body.innerHTML = MARKUP;
});

describe('initOptionsPage', () => {
  it('shows the stored icon setting', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: false });

    await initOptionsPage(document, deps({ area }));

    expect(checkbox().checked).toBe(false);
  });

  it('saves the icon setting when toggled', async () => {
    const area = memoryArea();
    await initOptionsPage(document, deps({ area }));

    checkbox().checked = false;
    checkbox().dispatchEvent(new Event('change'));
    await flush();

    expect(await loadSettings(area)).toEqual({ showIcon: false });
  });

  it('shows the current shortcut', async () => {
    await initOptionsPage(document, deps());

    expect(document.getElementById('shortcut')?.textContent).toBe('⌥⇧F');
  });

  it('says when no shortcut is assigned', async () => {
    await initOptionsPage(document, deps({ getShortcut: async () => undefined }));

    expect(document.getElementById('shortcut')?.textContent).toBe('지정되지 않음');
  });

  it('opens the browser shortcut settings', async () => {
    const d = deps();
    await initOptionsPage(document, d);

    document.getElementById('change-shortcut')?.click();

    expect(d.openShortcutSettings).toHaveBeenCalledTimes(1);
  });

  it('fails clearly when the markup is missing', async () => {
    document.body.innerHTML = '';

    await expect(initOptionsPage(document, deps())).rejects.toThrow('#show-icon');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/options-page.test.ts`
Expected: FAIL — `Failed to resolve import "../../lib/options-page"`

- [ ] **Step 3: 구현**

`lib/options-page.ts`
```ts
import { loadSettings, saveSettings } from './settings';
import type { KeyValueArea } from './storage';

const NO_SHORTCUT_TEXT = '지정되지 않음';

export interface OptionsPageDeps {
  area: KeyValueArea;
  getShortcut(): Promise<string | undefined>;
  openShortcutSettings(): Promise<void>;
}

/** 설정 화면의 아이콘 켜기·끄기와 단축키 안내를 연결한다. */
export async function initOptionsPage(doc: Document, deps: OptionsPageDeps): Promise<void> {
  const checkbox = requireElement<HTMLInputElement>(doc, '#show-icon');
  const shortcutLabel = requireElement<HTMLElement>(doc, '#shortcut');
  const shortcutButton = requireElement<HTMLButtonElement>(doc, '#change-shortcut');

  const settings = await loadSettings(deps.area);
  checkbox.checked = settings.showIcon;
  checkbox.addEventListener('change', () => {
    void saveSettings(deps.area, { ...settings, showIcon: checkbox.checked });
  });

  shortcutLabel.textContent = (await deps.getShortcut()) || NO_SHORTCUT_TEXT;
  shortcutButton.addEventListener('click', () => void deps.openShortcutSettings());
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`설정 화면 요소가 없습니다: ${selector}`);
  return found;
}
```

`entrypoints/options/index.html`
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Drag and Find 설정</title>
    <style>
      body {
        margin: 0;
        padding: 16px 20px;
        font-family: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
        font-size: 14px;
        line-height: 1.6;
      }
      section + section { margin-top: 16px; }
      .hint { color: #59636e; font-size: 13px; margin: 2px 0 0; }
      kbd { padding: 1px 6px; border: 1px solid #d0d7de; border-radius: 4px; }
    </style>
  </head>
  <body>
    <section>
      <label><input id="show-icon" type="checkbox" /> 드래그하면 🔍 아이콘 보여 주기</label>
      <p class="hint">끄면 단축키로만 찾을 수 있습니다.</p>
    </section>
    <section>
      <div>단축키: <kbd id="shortcut"></kbd></div>
      <button id="change-shortcut" type="button">단축키 바꾸기</button>
    </section>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`entrypoints/options/main.ts`
```ts
import { browser } from 'wxt/browser';
import { initOptionsPage } from '../../lib/options-page';
import { LOOKUP_COMMAND } from '../../lib/shortcut';

void initOptionsPage(document, {
  area: browser.storage.local,
  getShortcut: async () =>
    (await browser.commands.getAll()).find((command) => command.name === LOOKUP_COMMAND)
      ?.shortcut || undefined,
  openShortcutSettings: async () => {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  },
});
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm build`
Expected: 전체 PASS. `node -e "console.log(require('./.output/chrome-mv3/manifest.json').options_ui)"` → `{ open_in_tab: false, page: 'options.html' }`

- [ ] **Step 5: Commit**

```bash
git add lib/options-page.ts entrypoints/options tests/unit/options-page.test.ts
git commit -m "feat: 아이콘 켜기·끄기와 단축키 안내 설정 화면 추가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 실제 크롬 E2E 테스트와 마무리 확인

**Files:**
- Create: `playwright.config.ts`, `e2e/fixtures.ts`, `e2e/lookup.spec.ts`

**Interfaces:**
- Consumes: 빌드 결과 `.output/chrome-mv3`, `data-role` 표식, 설정 화면 id
- Produces: `pnpm test:e2e`

- [ ] **Step 1: Playwright 설정과 픽스처 작성**

`playwright.config.ts`
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 30_000,
  reporter: 'line',
});
```

`e2e/fixtures.ts`
```ts
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
export const ARTICLE_URL = 'https://example.test/article';

const ARTICLE_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>기사</title></head>
<body style="padding:40px;font-size:18px">
  <p>요즘 스타트업에서는 <span id="known">온보딩</span> 과정을 자동화하는 사례가 늘고 있다.</p>
  <p>젊은 세대 사이에서는 <span id="unknown">갓생</span> 이라는 말이 유행한다.</p>
</body></html>`;

const SUMMARIES: Record<string, object> = {
  온보딩: {
    type: 'standard',
    title: '온보딩',
    extract: '온보딩은 신입 직원이 조직에 적응하도록 돕는 과정이다.',
    content_urls: {
      desktop: { page: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9' },
    },
  },
};

async function routeFakeNetwork(context: BrowserContext): Promise<void> {
  await context.route('https://example.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML }),
  );
  await context.route('https://ko.wikipedia.org/api/rest_v1/page/summary/**', (route) => {
    const title = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop() ?? '');
    const body = SUMMARIES[title];
    return body
      ? route.fulfill({ json: body })
      : route.fulfill({ status: 404, json: { type: 'not_found' } });
  });
  await context.route(/ko\.wikipedia\.org\/w\/api\.php/, (route) =>
    route.fulfill({ json: { query: { search: [] } } }),
  );
  await context.route(/^https:\/\/(www\.google\.com|search\.naver\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>search</p>' }),
  );
}

export const test = base.extend<{ context: BrowserContext; serviceWorker: Worker; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright 픽스처는 첫 인자를 구조 분해 형태로 요구한다
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await routeFakeNetwork(context);
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
```

- [ ] **Step 2: E2E 테스트 작성**

`e2e/lookup.spec.ts`
```ts
import type { Page } from '@playwright/test';
import { ARTICLE_URL, expect, test } from './fixtures';

const role = (page: Page, name: string) => page.locator(`[data-role="${name}"]`);

async function openArticleAndLookUp(page: Page, wordId: string): Promise<void> {
  await page.goto(ARTICLE_URL);
  await page.locator(`#${wordId}`).dblclick();
  await role(page, 'icon').click();
}

test('드래그 후 아이콘을 누르면 위키백과 요약 카드가 뜬다', async ({ page }) => {
  await openArticleAndLookUp(page, 'known');

  await expect(role(page, 'title')).toHaveText('온보딩');
  await expect(role(page, 'extract')).toContainText('신입 직원');
  await expect(role(page, 'wiki-link')).toHaveAttribute(
    'href',
    'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
  );
});

test('위키백과에 없는 단어는 안내 문구와 검색 버튼을 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'unknown');

  await expect(role(page, 'body')).toHaveText('위키백과에 문서가 없습니다');
  await expect(role(page, 'google')).toBeVisible();
  await expect(role(page, 'naver')).toBeVisible();
});

test('구글·네이버 버튼은 선택한 단어로 검색한 새 탭을 연다', async ({ page, context }) => {
  await openArticleAndLookUp(page, 'known');

  const [google] = await Promise.all([context.waitForEvent('page'), role(page, 'google').click()]);
  await expect(google).toHaveURL('https://www.google.com/search?q=%EC%98%A8%EB%B3%B4%EB%94%A9');

  const [naver] = await Promise.all([context.waitForEvent('page'), role(page, 'naver').click()]);
  await expect(naver).toHaveURL(
    'https://search.naver.com/search.naver?query=%EC%98%A8%EB%B3%B4%EB%94%A9',
  );
});

test('Esc와 바깥 클릭으로 카드가 닫힌다', async ({ page }) => {
  await openArticleAndLookUp(page, 'known');
  await expect(role(page, 'card')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(role(page, 'card')).toHaveCount(0);

  await page.locator('#known').dblclick();
  await role(page, 'icon').click();
  await expect(role(page, 'card')).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(role(page, 'card')).toHaveCount(0);
});

test('단축키 알림을 받으면 현재 선택으로 찾는다', async ({ page, serviceWorker }) => {
  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();

  await serviceWorker.evaluate(
    `chrome.tabs.query({}).then((tabs) => Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'trigger-from-shortcut' }))))`,
  );

  await expect(role(page, 'title')).toHaveText('온보딩');
});

test('설정 화면에 단축키가 표시되고, 아이콘을 끄면 드래그해도 아이콘이 뜨지 않는다', async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.locator('#shortcut')).toHaveText(/F$/);
  await page.locator('#show-icon').uncheck();
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('settings').then((stored) => stored.settings?.showIcon)`,
      ),
    )
    .toBe(false);

  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();
  // 아이콘이 "안 뜬다"를 확인하려면 판정(설정 읽기 포함)이 끝날 시간을 줘야 한다.
  await page.waitForTimeout(500);

  await expect(role(page, 'icon')).toHaveCount(0);
});
```

- [ ] **Step 3: E2E 실행**

Run: `pnpm test:e2e`
Expected: 6 passed. 실패하면 `playwright-report/` 대신 `--reporter=list --trace=on`으로 다시 실행해 원인을 확인하고, 테스트가 아니라 구현을 고친다.

- [ ] **Step 4: 전체 검증**

Run: `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: 모두 통과

- [ ] **Step 5: 수동 확인 (자동화가 불가능한 항목)**

`pnpm build` → 크롬에 `.output/chrome-mv3` 로드 후:
- [ ] Mac: 단어 선택 후 `⌥⇧F`를 실제로 눌러 카드가 뜨는지 (Playwright는 브라우저 단축키를 실행하지 못한다)
- [ ] Windows: `Alt+Shift+F`가 크롬 기본 단축키와 겹치지 않고 카드가 뜨는지. 겹치면 `wxt.config.ts`의 `suggested_key`를 바꾸고 이 계획에 기록한다
- [ ] 실제 블로그·뉴스 3곳에서 단어 5개씩 찾아보기 (실제 위키백과 응답, 카드 위치·스크롤 따라가기 포함)
- [ ] 다크 모드 페이지에서 카드가 읽히는지
- [ ] `chrome://extensions` 페이지에서 단축키를 눌러도 오류 없이 아무 일도 일어나지 않는지

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: 실제 크롬에서 드래그부터 검색까지 확인하는 테스트 추가" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
