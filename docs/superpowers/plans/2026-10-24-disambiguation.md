# 뜻이 여러 개인 단어 표시 개선 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뜻 모음(동음이의) 단어를 찾았을 때 카드에 "이 글에서는 아마"(문맥 기반 자동 선택), 기본 뜻, 누를 수 있는 다른 뜻 목록을 보여 준다.

**Architecture:** 백그라운드의 위키백과 제공자가 뜻 모음 문서일 때 2번 더 요청해 본문 글자(기본 뜻·항목)와 연결 문서 첫 문단(후보)을 얻는다. 조회 서비스는 이를 캐시하고, 요청에 담겨 온 선택 주변 문맥으로 매번 순수 함수 `pickSense`를 돌려 `suggestion`을 붙인다. 페이지 쪽은 문맥을 모아 보내고, 카드는 새 정보를 그리며, 다른 뜻을 누르면 같은 위치에서 그 제목으로 다시 찾는다.

**Tech Stack:** 기존과 같음 — TypeScript ~5.9, WXT 0.21.4, Vitest 5 + happy-dom, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-24-disambiguation-design.md`

## Global Constraints

- 기존 제약(`docs/superpowers/plans/2026-10-23-drag-and-find.md`의 Global Constraints)을 모두 지킨다: WXT 자동 import 꺼짐, 권한 추가 금지, `textContent`만 사용, 외부 데이터 검증, 커밋 메시지 형식
- tsconfig에 `noUncheckedIndexedAccess`가 켜져 있다 — 배열 인덱스 접근은 `?.` / `??`로 처리
- 카드 문구(정확히 이대로): `이 글에서는 아마`, `기본 뜻`, `다른 뜻`, `외 N개` (N은 숫자), 기존 `뜻이 여러 개인 단어입니다`
- 다른 뜻은 최대 `8`개, 항목 글자는 최대 `40`자(넘으면 앞 40자 + `…`)
- 문맥: 선택 앞뒤 `100`자, 요청의 `context` 최대 `250`자
- 자동 선택 기준: 겹친 두 글자 조각 `≥ 3` **그리고** 1등 점수 `≥` 2등 점수 × `1.5`
- 뜻 모음 추가 요청: 본문 글자 1번 + 연결 문서 첫 문단 1번(`exlimit=20`, `exchars=300`, `gpllimit=50`)
- 후보에서 제외: 뜻 모음 문서 자신의 제목, `위키낱말사전`
- 커밋 메시지 꼬리말은 실제로 커밋한 모델 이름 (`Co-Authored-By: Claude <모델> <noreply@anthropic.com>`)
- 사용자에게 보이는 보고·문서는 한국어

## Review Focus

- 문맥 없이 찾을 때(다른 뜻 누르기, 문맥 수집 실패)는 자동 선택을 하지 않고 기존처럼 보여야 한다 → Task 4 서비스 테스트
- 추가 요청이 429·연결 오류로 실패해도 카드 전체가 실패가 되면 안 되고, 다음 찾기에서 다시 시도돼야 한다(캐시 미저장) → Task 4 테스트
- 캐시에 저장된 결과로 다른 문맥에서 찾으면 그 문맥에 맞는 자동 선택이 나와야 한다(이전 문맥의 선택이 남으면 안 됨) → Task 4 서비스 테스트
- 위키백과 글에 HTML처럼 보이는 글자가 있어도 카드에서 해석되면 안 된다 → Task 5 카드 테스트
- 같은 단어를 한 문단에 여러 번 쓰거나 선택이 문단 끝에 있어도 문맥이 250자를 넘지 않아야 한다 → Task 6 문맥 테스트

---

## 파일 구조

```
lib/lookup/types.ts              (수정) Meaning, SenseCandidate, DisambiguationInfo, FoundResult
lib/messages.ts                  (수정) context, MAX_CONTEXT_LENGTH, 결과 검증 확장
lib/lookup/client.ts             (수정) context 전달
lib/lookup/message-handler.ts    (수정) context 잘라서 전달
lib/lookup/disambiguation.ts     (신규) 본문 글자 해석, 항목 짝짓기
lib/lookup/sense.ts              (신규) pickSense
lib/lookup/wikipedia.ts          (수정) 뜻 모음 추가 요청
lib/lookup/service.ts            (수정) context, suggestion, 캐시 규칙
lib/ui/card.ts                   (수정) 뜻 모음 표시, onSelectMeaning
lib/ui/styles.ts                 (수정) 새 클래스
lib/content/context.ts           (신규) extractContext, blockTextOf
lib/content/controller.ts        (수정) 문맥 수집·전달, 다른 뜻 누르기
tests/unit/fixtures/disambiguation/  (신규) 위키백과 응답 사본 + 불러오기 도우미 + 출처 안내
tests/unit/...                   각 모듈 테스트
e2e/fixtures.ts, e2e/lookup.spec.ts  (수정) 뜻 모음 흐름
```

---

### Task 1: 데이터 모양과 메시지

**Files:**
- Modify: `lib/lookup/types.ts`, `lib/messages.ts`, `lib/lookup/client.ts`, `lib/lookup/message-handler.ts`, `lib/lookup/service.ts`(타입만)
- Test: `tests/unit/messages.test.ts`, `tests/unit/lookup/client.test.ts`, `tests/unit/lookup/message-handler.test.ts`

**Interfaces:**
- Consumes: 기존 `LookupResult`, `LookupRequest`, `createLookupClient`, `createLookupMessageHandler`, `LookupService`
- Produces:
  - `interface Meaning { label: string; title: string | null }`
  - `interface SenseCandidate { title: string; extract: string; url: string }`
  - `interface DisambiguationInfo { basic: string[]; meanings: Meaning[]; candidates: SenseCandidate[] }`
  - `type FoundResult = Extract<LookupResult, { status: 'found' }>` — `disambiguation?: DisambiguationInfo`, `suggestion?: SenseCandidate` 추가
  - `MAX_CONTEXT_LENGTH = 250`, `LookupRequest.context?: string`
  - `createLookupClient(send): (query: string, context?: string) => Promise<LookupResult>`
  - `type LookupService = (query: string, context?: string) => Promise<LookupResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/messages.test.ts`에 추가:
```ts
describe('isLookupRequest with context', () => {
  it('accepts a string context', () => {
    expect(isLookupRequest({ type: 'lookup', query: '트리거', context: '문맥' })).toBe(true);
  });

  it('rejects a non-string context', () => {
    expect(isLookupRequest({ type: 'lookup', query: '트리거', context: 3 })).toBe(false);
  });
});

describe('isLookupResult with disambiguation', () => {
  const base = {
    status: 'found',
    title: '트리거',
    extract: '',
    url: 'https://ko.wikipedia.org/wiki/x',
    isDisambiguation: true,
  };
  const candidate = { title: '방아쇠', extract: '총의 격발 장치', url: 'https://ko.wikipedia.org/wiki/y' };

  it('accepts complete disambiguation info and suggestion', () => {
    expect(
      isLookupResult({
        ...base,
        disambiguation: {
          basic: ['총의 방아쇠'],
          meanings: [
            { label: '방아쇠', title: '방아쇠' },
            { label: '트리거 전략', title: null },
          ],
          candidates: [candidate],
        },
        suggestion: candidate,
      }),
    ).toBe(true);
  });

  it.each([
    { disambiguation: { basic: 'x', meanings: [], candidates: [] } },
    { disambiguation: { basic: [], meanings: [{ label: 3, title: null }], candidates: [] } },
    { disambiguation: { basic: [], meanings: [{ label: 'a', title: 1 }], candidates: [] } },
    { disambiguation: { basic: [], meanings: [], candidates: [{ title: 'a' }] } },
    { suggestion: { title: 'a', extract: 'b' } },
  ])('rejects malformed %j', (extra) => {
    expect(isLookupResult({ ...base, ...extra })).toBe(false);
  });
});
```

`tests/unit/lookup/client.test.ts`에 추가:
```ts
  it('sends the context when given', async () => {
    const send = vi.fn<Send>(async () => ({ status: 'not_found' }));

    await createLookupClient(send)('트리거', '앞뒤 문맥');

    expect(send).toHaveBeenCalledWith({ type: 'lookup', query: '트리거', context: '앞뒤 문맥' });
  });
```

`tests/unit/lookup/message-handler.test.ts`:
- 기존 `expect(lookup).toHaveBeenCalledWith('갓생')`을 `expect(lookup).toHaveBeenCalledWith('갓생', undefined)`로 바꾼다 (이제 두 번째 인자로 문맥을 넘긴다)
- 추가:
```ts
  it('passes the context, cut to the maximum length', async () => {
    const lookup = vi.fn<LookupService>(async () => ({ status: 'not_found' }));
    const handle = createLookupMessageHandler(lookup);

    await handle({ type: 'lookup', query: '트리거', context: '가'.repeat(300) });

    expect(lookup).toHaveBeenCalledWith('트리거', '가'.repeat(250));
  });
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/messages.test.ts tests/unit/lookup/client.test.ts tests/unit/lookup/message-handler.test.ts`
Expected: FAIL (새 필드 검증·문맥 전달 없음)

- [ ] **Step 3: 구현**

`lib/lookup/types.ts` 전체:
```ts
/** 뜻 모음 문서의 한 항목. title이 있으면 눌러서 그 문서를 찾을 수 있다. */
export interface Meaning {
  label: string;
  title: string | null;
}

/** 자동 선택 후보이자 "이 글에서는 아마"에 보여 줄 뜻. */
export interface SenseCandidate {
  title: string;
  extract: string;
  url: string;
}

/** 뜻 모음 문서에서 얻은 기본 뜻, 항목, 자동 선택 후보. */
export interface DisambiguationInfo {
  basic: string[];
  meanings: Meaning[];
  candidates: SenseCandidate[];
}

/** 검색 출처가 돌려주는 결과. 출처가 바뀌어도 이 형식은 유지한다. */
export type LookupResult =
  | {
      status: 'found';
      title: string;
      extract: string;
      url: string;
      isDisambiguation: boolean;
      disambiguation?: DisambiguationInfo;
      suggestion?: SenseCandidate;
    }
  | { status: 'not_found' }
  | { status: 'rate_limited' }
  | { status: 'network_error' };

export type FoundResult = Extract<LookupResult, { status: 'found' }>;

/** 검색어 하나를 받아 결과를 돌려주는 검색 출처. */
export interface LookupProvider {
  lookup(query: string): Promise<LookupResult>;
}
```

`lib/messages.ts` 변경:
```ts
import type { DisambiguationInfo, LookupResult, Meaning, SenseCandidate } from './lookup/types';

/** 찾기 요청에 담는 문맥의 최대 길이(앞 100 + 선택 최대 50 + 뒤 100). */
export const MAX_CONTEXT_LENGTH = 250;

export interface LookupRequest {
  type: typeof LOOKUP_MESSAGE;
  query: string;
  context?: string;
}

/** 페이지 → 백그라운드 조회 요청인지 확인한다. */
export function isLookupRequest(message: unknown): message is LookupRequest {
  return (
    isRecord(message) &&
    message.type === LOOKUP_MESSAGE &&
    typeof message.query === 'string' &&
    (message.context === undefined || typeof message.context === 'string')
  );
}
```
`isLookupResult`의 `'found'` 분기를 다음으로 바꾼다:
```ts
    case 'found':
      return (
        typeof value.title === 'string' &&
        typeof value.extract === 'string' &&
        typeof value.url === 'string' &&
        typeof value.isDisambiguation === 'boolean' &&
        (value.disambiguation === undefined || isDisambiguationInfo(value.disambiguation)) &&
        (value.suggestion === undefined || isSenseCandidate(value.suggestion))
      );
```
파일 끝(`isRecord` 위)에 추가:
```ts
function isSenseCandidate(value: unknown): value is SenseCandidate {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    typeof value.extract === 'string' &&
    typeof value.url === 'string'
  );
}

function isMeaning(value: unknown): value is Meaning {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    (value.title === null || typeof value.title === 'string')
  );
}

function isDisambiguationInfo(value: unknown): value is DisambiguationInfo {
  return (
    isRecord(value) &&
    Array.isArray(value.basic) &&
    value.basic.every((line) => typeof line === 'string') &&
    Array.isArray(value.meanings) &&
    value.meanings.every(isMeaning) &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isSenseCandidate)
  );
}
```

`lib/lookup/client.ts`:
```ts
export function createLookupClient(
  send: (message: LookupRequest) => Promise<unknown>,
): (query: string, context?: string) => Promise<LookupResult> {
  return async (query, context) => {
    try {
      const response = await send({
        type: LOOKUP_MESSAGE,
        query,
        ...(context === undefined ? {} : { context }),
      });
      return isLookupResult(response) ? response : { status: 'network_error' };
    } catch {
      // 확장이 업데이트·재시작되면 이미 열린 페이지와의 연결이 끊긴다. 사용자에게는 연결 실패로 보여 준다.
      return { status: 'network_error' };
    }
  };
}
```

`lib/lookup/message-handler.ts`:
```ts
import { MAX_CONTEXT_LENGTH, isLookupRequest } from '../messages';
...
  return (message) =>
    isLookupRequest(message)
      ? lookup(message.query, message.context?.slice(0, MAX_CONTEXT_LENGTH))
      : undefined;
```

`lib/lookup/service.ts`의 타입만 바꾼다(동작은 Task 4):
```ts
export type LookupService = (query: string, context?: string) => Promise<LookupResult>;
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add lib tests/unit
git commit -m "feat: 뜻 모음 정보와 문맥을 주고받을 수 있게 데이터 모양 확장" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 2: 뜻 모음 본문 해석

**Files:**
- Create: `lib/lookup/disambiguation.ts`, `tests/unit/fixtures/disambiguation/` (응답 사본, `load.ts`, `SOURCE.md`)
- Test: `tests/unit/lookup/disambiguation.test.ts`

**Interfaces:**
- Consumes: Task 1 `Meaning`
- Produces:
  - `parseDisambiguationText(text: string): { basic: string[]; lines: string[] }`
  - `buildMeanings(lines: string[], linkedTitles: string[]): Meaning[]`
  - 테스트 도우미 `pageText(word: string): string`, `linkedPages(word: string): Array<{ title: string; extract: string }>`, `pageTextResponse(word)`, `linkedResponse(word)` (원본 JSON)

- [ ] **Step 1: 테스트 데이터 복사**

사전 시험에서 받은 위키백과 응답을 복사한다 (세션 임시 폴더):
```bash
SRC=/private/tmp/claude-501/-Users-choimiae-workspace-drag-and-find/10a80329-5600-4147-bb54-d9f3b45c4d99/scratchpad/spike-disambig
DST=tests/unit/fixtures/disambiguation
mkdir -p $DST/pages $DST/linked
for w in 모델 트리거 버블 플랫폼 커널 마진 포트 터미널 스레드; do
  cp "$SRC/pages/$w.json" "$DST/pages/$w.json"
  cp "$SRC/linked/$w.json" "$DST/linked/$w.json"
done
```
`.prettierignore`에 `tests/unit/fixtures/` 한 줄을 추가한다 (원본 응답을 그대로 둔다).

`tests/unit/fixtures/disambiguation/SOURCE.md`:
```markdown
# 출처

이 폴더의 JSON은 2026-10-24에 한국어 위키백과 API(`ko.wikipedia.org/w/api.php`)에서 받은 응답 사본이다.
글 내용의 저작권은 위키백과 기여자에게 있으며 CC BY-SA 4.0으로 이용한다.
https://creativecommons.org/licenses/by-sa/4.0/deed.ko

- `pages/<단어>.json`: `prop=extracts|pageprops&explaintext=1` 응답 (뜻 모음 문서 본문 글자)
- `linked/<단어>.json`: `generator=links&prop=extracts&exintro=1&explaintext=1&exlimit=20&exchars=300` 응답 (연결 문서 첫 문단)
```

`tests/unit/fixtures/disambiguation/load.ts`:
```ts
import { readFileSync } from 'node:fs';

interface ApiPage {
  title?: string;
  extract?: string;
}

interface ApiResponse {
  query?: { pages?: Record<string, ApiPage> };
}

const DIR = new URL('./', import.meta.url);

function read(kind: 'pages' | 'linked', word: string): ApiResponse {
  return JSON.parse(readFileSync(new URL(`${kind}/${word}.json`, DIR), 'utf8')) as ApiResponse;
}

/** 뜻 모음 문서 본문 글자 응답 원본. */
export function pageTextResponse(word: string): ApiResponse {
  return read('pages', word);
}

/** 연결 문서 첫 문단 응답 원본. */
export function linkedResponse(word: string): ApiResponse {
  return read('linked', word);
}

/** 뜻 모음 문서 본문 글자. */
export function pageText(word: string): string {
  return Object.values(read('pages', word).query?.pages ?? {})[0]?.extract ?? '';
}

/** 첫 문단이 있는 연결 문서들. */
export function linkedPages(word: string): Array<{ title: string; extract: string }> {
  return Object.values(read('linked', word).query?.pages ?? {}).flatMap((page) =>
    page.title && page.extract ? [{ title: page.title, extract: page.extract }] : [],
  );
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/unit/lookup/disambiguation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildMeanings, parseDisambiguationText } from '../../../lib/lookup/disambiguation';
import { pageText } from '../fixtures/disambiguation/load';

describe('parseDisambiguationText', () => {
  it('takes the basic-meaning section and drops see-also', () => {
    const { basic, lines } = parseDisambiguationText(pageText('트리거'));

    expect(basic).toHaveLength(2);
    expect(basic[0]).toContain('총의 방아쇠');
    expect(lines).toContain('데이터베이스 트리거');
    expect(lines.some((line) => line.includes('방아쇠 (동음이의)'))).toBe(false);
    expect(lines.some((line) => line.includes('모든 문서'))).toBe(false);
  });

  it('skips the intro sentence', () => {
    const { lines } = parseDisambiguationText(pageText('버블'));

    expect(lines[0]).toBe('거품');
    expect(lines).toHaveLength(10);
  });

  it('returns no basic meaning when there is no basic section', () => {
    expect(parseDisambiguationText(pageText('포트')).basic).toEqual([]);
  });

  it('uses only the first section whose name contains "기본"', () => {
    const text = '소개\n\n== 기본 의미 ==\n첫 뜻\n\n== 기본 아님 ==\n둘째 줄';

    expect(parseDisambiguationText(text)).toEqual({ basic: ['첫 뜻'], lines: ['둘째 줄'] });
  });

  it('handles empty text', () => {
    expect(parseDisambiguationText('')).toEqual({ basic: [], lines: [] });
  });
});

describe('buildMeanings', () => {
  it('uses the part before a colon as the label', () => {
    expect(buildMeanings(['데이터 모델: 데이터의 관계'], ['데이터 모델'])).toEqual([
      { label: '데이터 모델', title: '데이터 모델' },
    ]);
  });

  it('keeps the whole line as the label when there is no colon', () => {
    expect(buildMeanings(['승강장은 지하철의 승강장을 말한다.'], ['승강장'])).toEqual([
      { label: '승강장은 지하철의 승강장을 말한다.', title: '승강장' },
    ]);
  });

  it('picks the longest linked title the line starts with', () => {
    expect(buildMeanings(['버스 터미널: 버스 정류장'], ['버스', '버스 터미널'])[0]?.title).toBe(
      '버스 터미널',
    );
  });

  it('leaves the title empty when no linked title starts the line', () => {
    expect(buildMeanings(['트리거 전략: 게임 전략'], ['방아쇠'])[0]?.title).toBeNull();
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `pnpm test tests/unit/lookup/disambiguation.test.ts`
Expected: FAIL — `lib/lookup/disambiguation` 없음

- [ ] **Step 4: 구현**

`lib/lookup/disambiguation.ts`:
```ts
import type { Meaning } from './types';

const SEE_ALSO_SECTION = '같이 보기';
const BASIC_SECTION_MARK = '기본';
const HEADING = /^=+\s*(.+?)\s*=+$/u;

/** 뜻 모음 문서 본문 글자에서 기본 뜻 문장과 뜻 항목 줄을 꺼낸다. 첫 소개 문장과 '같이 보기' 이후는 버린다. */
export function parseDisambiguationText(text: string): { basic: string[]; lines: string[] } {
  const basic: string[] = [];
  const lines: string[] = [];
  let introSkipped = false;
  let basicTaken = false;
  let inBasic = false;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = HEADING.exec(line)?.[1];
    if (heading !== undefined) {
      if (heading === SEE_ALSO_SECTION) break;
      inBasic = !basicTaken && heading.includes(BASIC_SECTION_MARK);
      basicTaken ||= inBasic;
      continue;
    }
    if (!introSkipped) {
      introSkipped = true;
      continue;
    }
    (inBasic ? basic : lines).push(line);
  }
  return { basic, lines };
}

/** 항목 줄마다 표시 글자와, 그 줄이 시작하는 가장 긴 연결 문서 제목을 짝짓는다. */
export function buildMeanings(lines: string[], linkedTitles: string[]): Meaning[] {
  return lines.map((line) => ({ label: labelOf(line), title: longestPrefixTitle(line, linkedTitles) }));
}

function labelOf(line: string): string {
  const colon = line.indexOf(':');
  return colon > 0 ? line.slice(0, colon).trim() : line;
}

function longestPrefixTitle(line: string, titles: string[]): string | null {
  return titles.filter((title) => line.startsWith(title)).sort((a, b) => b.length - a.length)[0] ?? null;
}
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm test tests/unit/lookup/disambiguation.test.ts && pnpm compile && pnpm lint && pnpm format`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/lookup/disambiguation.ts tests/unit/lookup/disambiguation.test.ts tests/unit/fixtures .prettierignore
git commit -m "feat: 뜻 모음 문서에서 기본 뜻과 다른 뜻 목록 읽기" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 3: 문맥으로 뜻 고르기

**Files:**
- Create: `lib/lookup/sense.ts`
- Test: `tests/unit/lookup/sense.test.ts`

**Interfaces:**
- Consumes: Task 1 `SenseCandidate`; Task 2 테스트 도우미 `linkedPages`
- Produces: `pickSense(context: string, word: string, candidates: SenseCandidate[]): SenseCandidate | null`, `MIN_OVERLAP = 3`, `MIN_LEAD_RATIO = 1.5`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/lookup/sense.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickSense } from '../../../lib/lookup/sense';
import type { SenseCandidate } from '../../../lib/lookup/types';
import { linkedPages } from '../fixtures/disambiguation/load';

function candidatesOf(word: string): SenseCandidate[] {
  return linkedPages(word)
    .filter((page) => page.title !== word && page.title !== '위키낱말사전')
    .map((page) => ({ ...page, url: `https://ko.wikipedia.org/wiki/${encodeURIComponent(page.title)}` }));
}

// 사전 시험(2026-10-24) 13문장. 기대값은 측정 결과를 고정한 것이다: 맞힘 6, 틀림 1(#1), 고르지 않음 6.
// 규칙을 바꿔 결과가 달라지면 이 표를 근거와 함께 갱신한다.
const CASES: Array<[number, string, string, string | null]> = [
  [1, '모델', '이번 시즌 런웨이에 선 신인 모델은 데뷔 첫 해에 해외 패션위크 무대까지 밟았다.', '모델 (드라마)'],
  [2, '모델', '구독형 수익 구조로 바꾼 뒤 이 스타트업의 모델은 투자자들 사이에서 안정적이라는 평가를 받았다.', null],
  [3, '트리거', '주문 테이블에 행이 추가될 때마다 재고를 줄이도록 트리거를 걸어 두었다.', '데이터베이스 트리거'],
  [4, '트리거', '사격장 교관은 트리거에 손가락을 올리기 전에 반드시 총구 방향을 확인하라고 강조했다.', '방아쇠'],
  [5, '버블', '부동산 가격이 실수요와 무관하게 치솟자 전문가들은 버블 붕괴를 경고하고 나섰다.', '거품 경제'],
  [6, '버블', '타피오카 펄이 듬뿍 들어간 버블 한 잔이 요즘 대학가 카페의 인기 메뉴다.', '버블티'],
  [7, '플랫폼', '열차가 도착하자 플랫폼에 서 있던 승객들이 한꺼번에 몰려들었다.', '승강장'],
  [8, '플랫폼', '배달 앱 같은 플랫폼 기업이 수수료를 올리면서 입점 업체들의 부담이 커졌다.', null],
  [11, '커널', '리눅스 커널 최신 버전은 메모리 관리와 스케줄러 성능을 크게 개선했다.', null],
  [14, '마진', '원자재 가격이 오르면서 제조업체들의 마진이 지난 분기보다 크게 줄었다.', null],
  [15, '포트', '방화벽에서 웹 서버용 포트를 열어 주지 않으면 외부에서 접속할 수 없다.', null],
  [19, '터미널', '명절 연휴를 앞두고 고속버스 터미널은 귀성객들로 하루 종일 붐볐다.', null],
  [20, '스레드', '작업을 여러 스레드로 나누어 실행하자 멀티코어 CPU의 활용률이 높아졌다.', '스레드 (컴퓨팅)'],
];

describe('pickSense on the recorded sample', () => {
  it.each(CASES)('case %i (%s)', (_id, word, context, expected) => {
    expect(pickSense(context, word, candidatesOf(word))?.title ?? null).toBe(expected);
  });
});

describe('pickSense rules', () => {
  const url = 'https://ko.wikipedia.org/wiki/x';
  const database = { title: '데이터베이스 트리거', extract: '테이블에 행이 추가되면 자동으로 실행되는 절차', url };
  const gun = { title: '방아쇠', extract: '총의 격발 장치', url };

  it('returns nothing without context', () => {
    expect(pickSense('', '트리거', [database, gun])).toBeNull();
    expect(pickSense('   ', '트리거', [database, gun])).toBeNull();
  });

  it('returns nothing without candidates', () => {
    expect(pickSense('테이블에 행이 추가될 때 트리거', '트리거', [])).toBeNull();
  });

  it('needs at least three shared two-letter pieces', () => {
    expect(pickSense('테이블 트리거', '트리거', [database, gun])).toBeNull();
  });

  it('needs a clear lead over the second candidate', () => {
    const twin = { ...database, title: '데이터베이스 트리거 2' };

    expect(pickSense('테이블에 행이 추가될 때 트리거', '트리거', [database, twin])).toBeNull();
  });

  it('ignores the looked-up word itself when comparing', () => {
    const echo = { title: '트리거 트리거', extract: '트리거 트리거 트리거', url };

    expect(pickSense('트리거 트리거 트리거', '트리거', [echo, gun])).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/lookup/sense.test.ts`
Expected: FAIL — `lib/lookup/sense` 없음

- [ ] **Step 3: 구현**

`lib/lookup/sense.ts`:
```ts
import type { SenseCandidate } from './types';

export const MIN_OVERLAP = 3;
export const MIN_LEAD_RATIO = 1.5;

interface Scored {
  candidate: SenseCandidate;
  overlap: number;
  score: number;
}

/**
 * 문맥과 가장 많이 겹치는 뜻을 고른다. 확신할 때만 고르고, 애매하면 null.
 * 한국어는 조사가 붙어 낱말 단위 비교가 어려워 두 글자 조각으로 비교한다.
 */
export function pickSense(
  context: string,
  word: string,
  candidates: SenseCandidate[],
): SenseCandidate | null {
  if (!context.trim() || candidates.length === 0) return null;
  const contextPieces = twoLetterPieces(context, word);
  const [best, second] = candidates
    .map((candidate) => scoreCandidate(contextPieces, candidate, word))
    .sort((a, b) => b.score - a.score);
  if (!best || best.overlap < MIN_OVERLAP) return null;
  return best.score >= (second?.score ?? 0) * MIN_LEAD_RATIO ? best.candidate : null;
}

function scoreCandidate(contextPieces: Set<string>, candidate: SenseCandidate, word: string): Scored {
  const pieces = twoLetterPieces(`${candidate.title} ${candidate.extract}`, word);
  const overlap = [...pieces].filter((piece) => contextPieces.has(piece)).length;
  return { candidate, overlap, score: pieces.size > 0 ? overlap / Math.sqrt(pieces.size) : 0 };
}

function twoLetterPieces(text: string, word: string): Set<string> {
  const cleaned = text
    .split(word)
    .join(' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, '');
  const chars = Array.from(cleaned);
  return new Set(chars.slice(0, -1).map((char, index) => char + (chars[index + 1] ?? '')));
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test tests/unit/lookup/sense.test.ts && pnpm compile && pnpm lint && pnpm format`
Expected: PASS. 고정 표의 한 문장이라도 다르게 나오면 **기대값을 고치지 말고** 어떤 문장이 무엇으로 나왔는지 보고에 적고 DONE_WITH_CONCERNS로 보고한다.

- [ ] **Step 5: Commit**

```bash
git add lib/lookup/sense.ts tests/unit/lookup/sense.test.ts
git commit -m "feat: 앞뒤 문장으로 가장 알맞은 뜻 고르기" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 4: 위키백과 추가 요청과 조회 서비스

**Files:**
- Modify: `lib/lookup/wikipedia.ts`, `lib/lookup/service.ts`
- Test: `tests/unit/lookup/wikipedia.test.ts`, `tests/unit/lookup/service.test.ts`

**Interfaces:**
- Consumes: Task 1 타입, Task 2 `parseDisambiguationText`/`buildMeanings`/테스트 도우미, Task 3 `pickSense`
- Produces: 뜻 모음 `found` 결과에 `disambiguation`; `createLookupService(provider, cache): LookupService`가 `suggestion`을 붙인다

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/lookup/wikipedia.test.ts`에 추가 (기존 `json`, `summary`, `fakeFetch`, `provider`, `isSummary`, `summaryTitleOf` 도우미 재사용):
```ts
import { linkedResponse, pageTextResponse } from '../fixtures/disambiguation/load';

function disambiguationFetch(word: string, overrides: { linked?: () => Response } = {}) {
  return fakeFetch((url) => {
    if (isSummary(url)) {
      return summaryTitleOf(url) === word
        ? summary(word, { type: 'disambiguation', extract: `${word}는 다음 뜻으로 쓰인다.` })
        : notFound();
    }
    if (url.searchParams.get('generator') === 'links') {
      return overrides.linked ? overrides.linked() : json(linkedResponse(word));
    }
    return json(pageTextResponse(word));
  });
}

describe('disambiguation pages', () => {
  it('adds basic meanings, meanings and candidates with two extra requests', async () => {
    const fetchFn = disambiguationFetch('트리거');

    const result = await provider(fetchFn).lookup('트리거');

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    expect(result.disambiguation.basic).toHaveLength(2);
    expect(result.disambiguation.meanings).toContainEqual({
      label: '데이터베이스 트리거',
      title: '데이터베이스 트리거',
    });
    expect(result.disambiguation.candidates.map((c) => c.title)).toContain('방아쇠');
  });

  it('excludes the dictionary project page and builds Wikipedia urls for candidates', async () => {
    const result = await provider(disambiguationFetch('커널')).lookup('커널');

    if (result.status !== 'found' || !result.disambiguation) throw new Error('no disambiguation');
    const titles = result.disambiguation.candidates.map((c) => c.title);
    expect(titles).not.toContain('위키낱말사전');
    for (const candidate of result.disambiguation.candidates) {
      expect(candidate.url).toBe(`https://ko.wikipedia.org/wiki/${encodeURIComponent(candidate.title)}`);
    }
  });

  it('keeps the plain disambiguation result when an extra request fails', async () => {
    const fetchFn = disambiguationFetch('트리거', { linked: () => new Response('', { status: 429 }) });

    const result = await provider(fetchFn).lookup('트리거');

    expect(result).toMatchObject({ status: 'found', isDisambiguation: true });
    expect(result.status === 'found' && result.disambiguation).toBeFalsy();
  });

  it('makes no extra request for a normal article', async () => {
    const fetchFn = fakeFetch(() => summary('온보딩'));

    await provider(fetchFn).lookup('온보딩');

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
```

`tests/unit/lookup/service.test.ts`에 추가:
```ts
import type { DisambiguationInfo } from '../../../lib/lookup/types';
import { CACHE_STORAGE_KEY } from '../../../lib/lookup/cache';

const url = 'https://ko.wikipedia.org/wiki/x';
const DATABASE = { title: '데이터베이스 트리거', extract: '테이블에 행이 추가되면 자동으로 실행되는 절차', url };
const GUN = { title: '방아쇠', extract: '총의 격발 장치로 손가락으로 당기면 총구에서 탄이 나간다', url };
const INFO: DisambiguationInfo = {
  basic: [],
  meanings: [
    { label: '데이터베이스 트리거', title: '데이터베이스 트리거' },
    { label: '방아쇠', title: '방아쇠' },
  ],
  candidates: [DATABASE, GUN],
};
const TRIGGER: LookupResult = {
  status: 'found',
  title: '트리거',
  extract: '',
  url,
  isDisambiguation: true,
  disambiguation: INFO,
};
const DB_CONTEXT = '주문 테이블에 행이 추가될 때마다 재고를 줄이도록 트리거를 걸어 두었다.';
const GUN_CONTEXT = '사격장에서 총구 방향을 확인한 뒤 손가락으로 트리거를 당겨 탄을 쐈다.';

describe('suggestions', () => {
  it('picks a sense from the context', async () => {
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(memoryArea()));

    const result = await lookup('트리거', DB_CONTEXT);

    expect(result.status === 'found' && result.suggestion?.title).toBe('데이터베이스 트리거');
  });

  it('recomputes the suggestion for each context from one cached result', async () => {
    const provider = fakeProvider(TRIGGER);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    const first = await lookup('트리거', DB_CONTEXT);
    const second = await lookup('트리거', GUN_CONTEXT);

    expect(provider.lookup).toHaveBeenCalledTimes(1);
    expect(first.status === 'found' && first.suggestion?.title).toBe('데이터베이스 트리거');
    expect(second.status === 'found' && second.suggestion?.title).toBe('방아쇠');
  });

  it('gives no suggestion without context', async () => {
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(memoryArea()));

    const result = await lookup('트리거');

    expect(result.status === 'found' && result.suggestion).toBeFalsy();
  });

  it('never stores the suggestion in the cache', async () => {
    const area = memoryArea();
    const lookup = createLookupService(fakeProvider(TRIGGER), createLookupCache(area));

    await lookup('트리거', DB_CONTEXT);

    expect(JSON.stringify((await area.get(CACHE_STORAGE_KEY))[CACHE_STORAGE_KEY])).not.toContain(
      'suggestion',
    );
  });

  it('does not cache a disambiguation result that lacks the extra information', async () => {
    const bare: LookupResult = { ...TRIGGER, disambiguation: undefined };
    const provider = fakeProvider(bare);
    const lookup = createLookupService(provider, createLookupCache(memoryArea()));

    await lookup('트리거');
    await lookup('트리거');

    expect(provider.lookup).toHaveBeenCalledTimes(2);
  });
});
```
(`fakeProvider`, `memoryArea`, `createLookupCache`, `createLookupService`, `LookupResult`는 기존 테스트 파일에 이미 있다. 없는 import만 추가한다.)

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/lookup/wikipedia.test.ts tests/unit/lookup/service.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/lookup/wikipedia.ts`:
- import 추가:
```ts
import { buildMeanings, parseDisambiguationText } from './disambiguation';
import type { DisambiguationInfo, LookupProvider, LookupResult } from './types';
```
- 상수·타입 추가:
```ts
const EXCLUDED_CANDIDATE_TITLES = new Set(['위키낱말사전']);

interface ExtractsResponse {
  query?: { pages?: Record<string, { title?: string; extract?: string }> };
}
```
- `createWikipediaKoProvider` 안에 함수 추가:
```ts
  async function fetchPages(params: Record<string, string>) {
    const query = new URLSearchParams({ action: 'query', format: 'json', ...params });
    const data = await requestJson<ExtractsResponse>(`${ORIGIN}/w/api.php?${query}`);
    return data?.query?.pages ? Object.values(data.query.pages) : null;
  }

  async function fetchDisambiguation(title: string): Promise<DisambiguationInfo | null> {
    try {
      const [textPages, linkedPages] = await Promise.all([
        fetchPages({ prop: 'extracts', explaintext: '1', titles: title }),
        fetchPages({
          generator: 'links',
          titles: title,
          gplnamespace: '0',
          gpllimit: '50',
          prop: 'extracts',
          exintro: '1',
          explaintext: '1',
          exlimit: '20',
          exchars: '300',
        }),
      ]);
      const text = textPages?.[0]?.extract;
      if (text === undefined || linkedPages === null) return null;
      const candidates = linkedPages.flatMap((page) =>
        page.title && page.extract && page.title !== title && !EXCLUDED_CANDIDATE_TITLES.has(page.title)
          ? [{ title: page.title, extract: page.extract, url: wikiUrl(page.title) }]
          : [],
      );
      const { basic, lines } = parseDisambiguationText(text);
      return { basic, meanings: buildMeanings(lines, candidates.map((c) => c.title)), candidates };
    } catch {
      // 뜻 모음 추가 정보는 덤이다. 실패하면 기존처럼 "뜻이 여러 개" 안내만 보여 준다.
      return null;
    }
  }

  async function findArticle(query: string): Promise<LookupResult> {
    const direct = await fetchSummary(query);
    if (direct) return direct;
    const candidate = await searchTopTitle(query);
    if (!candidate || !isRelevantTitle(query, candidate)) return { status: 'not_found' };
    return (await fetchSummary(candidate)) ?? { status: 'not_found' };
  }
```
- `lookup`을 다음으로 바꾼다:
```ts
    async lookup(query) {
      try {
        const found = await findArticle(query);
        if (found.status !== 'found' || !found.isDisambiguation) return found;
        const disambiguation = await fetchDisambiguation(found.title);
        return disambiguation ? { ...found, disambiguation } : found;
      } catch (error) {
        if (error instanceof RateLimitedError) return { status: 'rate_limited' };
        return { status: 'network_error' };
      }
    },
```
- 파일 끝의 `articleUrl`을 다음으로 바꾼다:
```ts
function articleUrl(candidate: string | undefined, title: string): string {
  if (candidate?.startsWith(`${ORIGIN}/`)) return candidate;
  return wikiUrl(title);
}

function wikiUrl(title: string): string {
  return `${ORIGIN}/wiki/${encodeURIComponent(title)}`;
}
```

`lib/lookup/service.ts` 전체:
```ts
import type { LookupCache } from './cache';
import { pickSense } from './sense';
import type { LookupProvider, LookupResult } from './types';

export type LookupService = (query: string, context?: string) => Promise<LookupResult>;

/**
 * 캐시를 먼저 보고, 없으면 출처에 물어 저장한다. 대소문자만 다른 검색어는 같은 것으로 본다.
 * 문맥에 따른 뜻 선택은 저장하지 않고 찾을 때마다 계산한다.
 */
export function createLookupService(provider: LookupProvider, cache: LookupCache): LookupService {
  return async (query, context) => {
    const key = query.toLowerCase();
    const cached = await cache.get(key).catch(() => undefined); // 캐시는 속도를 위한 것이라 읽기 실패는 없는 것으로 본다
    const result = cached ?? (await provider.lookup(query));
    if (!cached && isWorthCaching(result)) {
      await cache.set(key, result).catch(() => undefined); // 캐시는 속도를 위한 것이라 저장 실패로 찾은 결과를 버리지 않는다
    }
    return withSuggestion(result, context);
  };
}

/** 뜻 모음인데 추가 정보가 없으면(추가 요청 실패) 다음에 다시 받아 오도록 저장하지 않는다. */
function isWorthCaching(result: LookupResult): boolean {
  return !(result.status === 'found' && result.isDisambiguation && !result.disambiguation);
}

function withSuggestion(result: LookupResult, context: string | undefined): LookupResult {
  if (result.status !== 'found' || !result.disambiguation || !context) return result;
  const suggestion = pickSense(context, result.title, result.disambiguation.candidates);
  return suggestion ? { ...result, suggestion } : result;
}
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 전체 PASS (기존 "marks disambiguation pages" 테스트도 통과해야 한다 — 추가 요청 응답 모양이 맞지 않으면 `disambiguation` 없이 기존 결과를 돌려준다)

- [ ] **Step 5: Commit**

```bash
git add lib/lookup tests/unit/lookup
git commit -m "feat: 뜻 모음 단어의 다른 뜻과 문맥상 뜻을 위키백과에서 가져오기" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 5: 카드 표시

**Files:**
- Modify: `lib/ui/card.ts`, `lib/ui/styles.ts`, `lib/content/controller.ts`(처리기 한 줄)
- Test: `tests/unit/ui/card.test.ts`, `tests/unit/ui/overlay.test.ts`(처리기 모양만)

**Interfaces:**
- Consumes: Task 1 `FoundResult`, `DisambiguationInfo`, `Meaning`, `SenseCandidate`
- Produces: `CardHandlers.onSelectMeaning(title: string): void`; `data-role` 추가: `suggestion`, `suggestion-extract`, `basic`, `meanings`, `meaning`, `meaning-text`, `more-meanings`; 상수 `MAX_MEANINGS = 8`, `MAX_LABEL_LENGTH = 40`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/ui/card.test.ts`:
- 기존 `beforeEach`의 처리기에 `onSelectMeaning: vi.fn()`을 추가한다
- 추가:
```ts
describe('disambiguation card', () => {
  const url = 'https://ko.wikipedia.org/wiki/x';
  const DATABASE = { title: '데이터베이스 트리거', extract: '테이블에 행이 추가되면 실행', url };

  function disambiguation(overrides: Partial<FoundResult> = {}): CardState {
    return {
      kind: 'result',
      result: {
        status: 'found',
        title: '트리거',
        extract: '',
        url,
        isDisambiguation: true,
        disambiguation: {
          basic: ['총의 방아쇠를 뜻하는 사격용어이다.'],
          meanings: [
            { label: '데이터베이스 트리거', title: '데이터베이스 트리거' },
            { label: '트리거 (애니메이션 제작사)', title: '트리거 (애니메이션 제작사)' },
            { label: '트리거 전략', title: null },
          ],
          candidates: [DATABASE],
        },
        ...overrides,
      },
    };
  }

  it('shows the suggestion first and opens it on click', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    expect(card.textContent).toContain('이 글에서는 아마');
    expect(part('suggestion')?.textContent).toBe('데이터베이스 트리거');
    expect(part('suggestion-extract')?.textContent).toBe('테이블에 행이 추가되면 실행');
    part('suggestion')?.click();
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터베이스 트리거');
  });

  it('leaves the suggested sense out of the other meanings', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    const labels = [...card.querySelectorAll('[data-role="meaning"]')].map((b) => b.textContent);
    expect(labels).toEqual(['트리거 (애니메이션 제작사)']);
  });

  it('shows basic meanings and other meanings without a suggestion', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    expect(card.textContent).not.toContain('이 글에서는 아마');
    expect(card.textContent).toContain('기본 뜻');
    expect(card.textContent).toContain('다른 뜻');
    expect(card.querySelectorAll('[data-role="basic"]')).toHaveLength(1);
    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(2);
    expect(part('meaning-text')?.textContent).toBe('트리거 전략');
    expect(part('wiki-link')).not.toBeNull();
  });

  it('opens a meaning by its article title, not its label', () => {
    const state = disambiguation({
      disambiguation: {
        basic: [],
        meanings: [{ label: '데이터 모델', title: '데이터 모델 (전산)' }],
        candidates: [],
      },
    });
    renderCard(card, '모델', state, handlers);

    part('meaning')?.click();

    expect(part('meaning')?.textContent).toBe('데이터 모델');
    expect(handlers.onSelectMeaning).toHaveBeenCalledWith('데이터 모델 (전산)');
  });

  it('shows at most eight meanings and counts the rest', () => {
    const meanings = Array.from({ length: 10 }, (_, i) => ({ label: `뜻 ${i}`, title: `뜻 ${i}` }));
    renderCard(card, '모델', disambiguation({ disambiguation: { basic: [], meanings, candidates: [] } }), handlers);

    expect(card.querySelectorAll('[data-role="meaning"]')).toHaveLength(8);
    expect(part('more-meanings')?.textContent).toBe('외 2개');
  });

  it('shortens labels longer than forty characters', () => {
    const label = '가'.repeat(41);
    renderCard(
      card,
      '모델',
      disambiguation({ disambiguation: { basic: [], meanings: [{ label, title: null }], candidates: [] } }),
      handlers,
    );

    expect(part('meaning-text')?.textContent).toBe(`${'가'.repeat(40)}…`);
  });

  it('never turns meaning text into HTML', () => {
    renderCard(
      card,
      '모델',
      disambiguation({
        disambiguation: { basic: ['<img src=x onerror=alert(1)>'], meanings: [{ label: '<b>x</b>', title: null }], candidates: [] },
      }),
      handlers,
    );

    expect(card.querySelector('img')).toBeNull();
    expect(card.querySelector('b')).toBeNull();
  });

  it('keeps the old notice when the extra information is missing', () => {
    renderCard(card, '트리거', disambiguation({ disambiguation: undefined }), handlers);

    expect(part('body')?.textContent).toContain('뜻이 여러 개인 단어입니다');
  });
});
```
(파일 상단 import에 `type CardState`와 `import type { FoundResult } from '../../../lib/lookup/types';`를 추가한다)

`tests/unit/ui/overlay.test.ts`: `handlers` 도우미에 `onSelectMeaning: vi.fn()`을 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/ui`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/ui/card.ts`:
- import:
```ts
import type { DisambiguationInfo, FoundResult, Meaning, SenseCandidate } from '../lookup/types';
```
(기존 `LookupResult` import는 `CardState`에서 계속 쓴다)
- 상수와 처리기:
```ts
const MAX_MEANINGS = 8;
const MAX_LABEL_LENGTH = 40;

export interface CardHandlers {
  onClose(): void;
  onRetry(): void;
  onSelectMeaning(title: string): void;
}
```
- `renderCard`에서 `bodyContent(doc, state, handlers.onRetry)`를 `bodyContent(doc, state, handlers)`로 바꾸고, `bodyContent`의 시그니처와 `found` 분기를 다음으로 바꾼다:
```ts
function bodyContent(doc: Document, state: CardState, handlers: CardHandlers): Node[] {
  ...
    case 'found':
      return foundContent(doc, result, handlers.onSelectMeaning);
  ...
    case 'network_error':
      return [doc.createTextNode('연결에 실패했습니다'), retryButton(doc, handlers.onRetry)];
```
- 함수 추가:
```ts
function foundContent(doc: Document, result: FoundResult, onSelect: (title: string) => void): Node[] {
  if (!result.isDisambiguation) {
    return [
      element(doc, 'p', { className: 'card-extract', role: 'extract', text: result.extract }),
      wikiLink(doc, result.url),
    ];
  }
  if (!result.disambiguation) {
    return [message(doc, '뜻이 여러 개인 단어입니다'), wikiLink(doc, result.url)];
  }
  return [
    ...disambiguationContent(doc, result.disambiguation, result.suggestion, onSelect),
    wikiLink(doc, result.url),
  ];
}

function disambiguationContent(
  doc: Document,
  info: DisambiguationInfo,
  suggestion: SenseCandidate | undefined,
  onSelect: (title: string) => void,
): Node[] {
  const others = info.meanings.filter((meaning) => meaning.title === null || meaning.title !== suggestion?.title);
  const basic = info.basic.map((line) => element(doc, 'p', { className: 'card-basic', role: 'basic', text: line }));
  return [
    ...(suggestion ? suggestionBlock(doc, suggestion, onSelect) : []),
    ...(basic.length > 0 ? [sectionTitle(doc, '기본 뜻'), ...basic] : []),
    ...(others.length > 0 ? [sectionTitle(doc, '다른 뜻'), ...meaningList(doc, others, onSelect)] : []),
  ];
}

function suggestionBlock(doc: Document, suggestion: SenseCandidate, onSelect: (title: string) => void): Node[] {
  return [
    sectionTitle(doc, '이 글에서는 아마'),
    meaningButton(doc, suggestion.title, suggestion.title, 'suggestion', onSelect),
    element(doc, 'p', { className: 'card-suggestion-extract', role: 'suggestion-extract', text: suggestion.extract }),
  ];
}

function meaningList(doc: Document, meanings: Meaning[], onSelect: (title: string) => void): Node[] {
  const list = element(doc, 'ul', { className: 'card-meanings', role: 'meanings' });
  list.append(...meanings.slice(0, MAX_MEANINGS).map((meaning) => meaningItem(doc, meaning, onSelect)));
  const hidden = meanings.length - MAX_MEANINGS;
  return hidden > 0
    ? [list, element(doc, 'p', { className: 'card-more', role: 'more-meanings', text: `외 ${hidden}개` })]
    : [list];
}

function meaningItem(doc: Document, meaning: Meaning, onSelect: (title: string) => void): HTMLElement {
  const item = element(doc, 'li', {});
  item.append(
    meaning.title === null
      ? element(doc, 'span', { className: 'card-meaning-text', role: 'meaning-text', text: shorten(meaning.label) })
      : meaningButton(doc, meaning.label, meaning.title, 'meaning', onSelect),
  );
  return item;
}

function meaningButton(
  doc: Document,
  label: string,
  title: string,
  role: string,
  onSelect: (title: string) => void,
): HTMLElement {
  const button = element(doc, 'button', { className: 'card-meaning', role, text: shorten(label) });
  button.setAttribute('type', 'button');
  button.addEventListener('click', () => onSelect(title));
  return button;
}

function sectionTitle(doc: Document, text: string): HTMLElement {
  return element(doc, 'p', { className: 'card-section-title', text });
}

function shorten(text: string): string {
  const chars = Array.from(text);
  return chars.length > MAX_LABEL_LENGTH ? `${chars.slice(0, MAX_LABEL_LENGTH).join('')}…` : text;
}
```

`lib/ui/styles.ts`의 `.card-retry` 줄 뒤에 추가:
```css
.card-section-title { margin: 8px 0 2px; color: var(--dnf-muted); font-size: 12px; font-weight: 600; }
.card-basic { margin: 0 0 4px; }
.card-suggestion-extract {
  margin: 2px 0 6px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meanings { margin: 0 0 4px; padding-left: 16px; }
.card-meaning {
  padding: 0;
  border: 0;
  background: none;
  color: var(--dnf-accent);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.card-meaning:hover, .card-meaning:focus-visible { text-decoration: underline; }
.card-meaning-text { color: var(--dnf-text); }
.card-more { margin: 0 0 4px; color: var(--dnf-muted); font-size: 12px; }
```

`lib/content/controller.ts`의 `showCard` 처리기에 임시로 한 줄을 추가한다 (Task 6에서 실제 동작으로 바꾼다):
```ts
      onSelectMeaning: (title) => void lookUp(title, anchor),
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ui lib/content/controller.ts tests/unit/ui
git commit -m "feat: 카드에 문맥상 뜻·기본 뜻·다른 뜻 목록 표시" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 6: 문맥 수집과 다른 뜻 누르기

**Files:**
- Create: `lib/content/context.ts`
- Modify: `lib/content/controller.ts`
- Test: `tests/unit/content/context.test.ts`, `tests/unit/content/controller.test.ts`

**Interfaces:**
- Consumes: Task 1 `requestLookup(query, context?)`(클라이언트), Task 5 `onSelectMeaning`
- Produces: `extractContext(blockText: string, selectedText: string): string`, `blockTextOf(node: Node | null): string`, `CONTEXT_RADIUS = 100`; `ControllerDeps.requestLookup(query: string, context?: string)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/content/context.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { blockTextOf, extractContext } from '../../../lib/content/context';
import { MAX_CONTEXT_LENGTH } from '../../../lib/messages';

describe('extractContext', () => {
  it('takes up to 100 characters before and after the selection', () => {
    const block = `${'가'.repeat(150)}트리거${'나'.repeat(150)}`;

    expect(extractContext(block, '트리거')).toBe(`${'가'.repeat(100)}트리거${'나'.repeat(100)}`);
  });

  it('keeps short blocks whole', () => {
    expect(extractContext('주문 테이블에 트리거를 걸었다.', '트리거')).toBe('주문 테이블에 트리거를 걸었다.');
  });

  it('collapses line breaks and repeated spaces', () => {
    expect(extractContext('주문\n\n테이블에   트리거', '트리거')).toBe('주문 테이블에 트리거');
  });

  it('falls back to the first 200 characters when the selection is not found', () => {
    expect(extractContext('다'.repeat(300), '트리거')).toBe('다'.repeat(200));
  });

  it('never exceeds the request limit even for a fifty-character selection', () => {
    const selected = '가'.repeat(50);
    const block = `${'앞'.repeat(300)}${selected}${'뒤'.repeat(300)}`;

    expect(Array.from(extractContext(block, selected)).length).toBeLessThanOrEqual(MAX_CONTEXT_LENGTH);
  });
});

describe('blockTextOf', () => {
  it('uses the closest block element', () => {
    document.body.innerHTML = '<div>바깥 <p id="p">요즘 <span id="w">트리거</span> 기능</p></div>';

    expect(blockTextOf(document.getElementById('w')?.firstChild ?? null)).toBe('요즘 트리거 기능');
  });

  it('returns an empty string without a node', () => {
    expect(blockTextOf(null)).toBe('');
  });
});
```

`tests/unit/content/controller.test.ts`:
- 기존 `toHaveBeenCalledWith('온보딩')` / `toHaveBeenLastCalledWith('온보딩')`를 `toHaveBeenCalledWith('온보딩', expect.any(String))` / `toHaveBeenLastCalledWith('온보딩', expect.any(String))`로 바꾼다 (이제 문맥을 함께 보낸다)
- 추가:
```ts
describe('context and meanings', () => {
  it('sends the surrounding paragraph as context', async () => {
    const { requestLookup, controller } = setup();
    selectContentsOf('term');

    controller.handleShortcut();
    await settle();

    expect(requestLookup).toHaveBeenCalledWith('온보딩', '요즘 온보딩 과정을 다룬다.');
  });

  it('looks up a chosen meaning at the same place without context', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();
    const anchor = overlay.showCard.mock.calls.at(-1)?.[0];

    overlay.showCard.mock.calls.at(-1)?.[3].onSelectMeaning('데이터베이스 트리거');
    await settle();

    expect(requestLookup).toHaveBeenLastCalledWith('데이터베이스 트리거', undefined);
    expect(overlay.showCard.mock.calls.at(-1)?.[0]).toEqual(anchor);
  });

  it('retries with the same context', async () => {
    const { overlay, requestLookup, controller } = setup();
    selectContentsOf('term');
    controller.handleShortcut();
    await settle();

    overlay.showCard.mock.calls.at(-1)?.[3].onRetry();
    await settle();

    expect(requestLookup).toHaveBeenLastCalledWith('온보딩', '요즘 온보딩 과정을 다룬다.');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/content`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/content/context.ts`:
```ts
import { MAX_CONTEXT_LENGTH } from '../messages';

export const CONTEXT_RADIUS = 100;
const FALLBACK_LENGTH = 200;
const BLOCK_SELECTOR = 'p, li, td, dd, blockquote, h1, h2, h3, h4, h5, h6, article, section, div';

/** 블록 글자에서 선택 글자 앞뒤 100자를 문맥으로 잘라 낸다. 찾지 못하면 앞쪽 200자. */
export function extractContext(blockText: string, selectedText: string): string {
  const text = collapse(blockText);
  const target = collapse(selectedText);
  const index = target ? text.indexOf(target) : -1;
  if (index < 0) return Array.from(text).slice(0, FALLBACK_LENGTH).join('');
  const start = Math.max(0, index - CONTEXT_RADIUS);
  const end = index + target.length + CONTEXT_RADIUS;
  return Array.from(text.slice(start, end)).slice(0, MAX_CONTEXT_LENGTH).join('');
}

/** 선택이 들어 있는 가장 가까운 블록 요소의 글자. */
export function blockTextOf(node: Node | null): string {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest(BLOCK_SELECTOR)?.textContent ?? '';
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}
```

`lib/content/controller.ts`:
- import 추가: `import { blockTextOf, extractContext } from './context';`
- `ControllerDeps.requestLookup(query: string, context?: string): Promise<LookupResult>;`
- `SelectionSnapshot`에 `context: string;` 추가, `readSelection`의 반환에 추가:
```ts
      context: extractContext(blockTextOf(selection.anchorNode), selection.toString()),
```
- `showCard`, `lookUp`을 다음으로 바꾼다:
```ts
  function showCard(anchor: DocumentRect, query: string, state: CardState, context?: string): void {
    overlay.showCard(anchor, query, state, {
      onClose: closeAll,
      onRetry: () => void lookUp(query, anchor, context),
      // 다른 뜻은 제목 그대로 찾으므로 문맥으로 다시 고를 필요가 없다.
      onSelectMeaning: (title) => void lookUp(title, anchor),
    });
  }

  async function lookUp(query: string, anchor: DocumentRect, context?: string): Promise<void> {
    latestRequestId += 1;
    const requestId = latestRequestId;
    overlay.hideIcon();
    showCard(anchor, query, { kind: 'loading' }, context);
    const result = await deps.requestLookup(query, context);
    if (requestId !== latestRequestId) return;
    showCard(anchor, query, { kind: 'result', result }, context);
  }
```
- 아이콘 클릭: `overlay.showIcon(snapshot.anchor, () => void lookUp(check.query, snapshot.anchor, snapshot.context));`
- 단축키: `void lookUp(check.query, snapshot.anchor, snapshot.context);`

`entrypoints/content.ts`는 바꾸지 않는다 (`createLookupClient`가 이미 `(query, context?)`를 받는다).

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add lib/content tests/unit/content
git commit -m "feat: 앞뒤 문장을 함께 보내고 다른 뜻을 누르면 그 뜻으로 찾기" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

### Task 7: 실제 크롬 E2E

**Files:**
- Modify: `e2e/fixtures.ts`, `e2e/lookup.spec.ts`

**Interfaces:**
- Consumes: 카드 `data-role` (`suggestion`, `meanings`, `meaning`, `title`, `extract`)
- Produces: 뜻 모음 E2E 테스트 2개

- [ ] **Step 1: 가짜 응답 추가**

`e2e/fixtures.ts`:
- `ARTICLE_HTML`의 두 번째 `<p>` 뒤에 추가 (`<span>` 앞뒤 공백은 더블클릭이 조사까지 잡지 않게 하려는 것):
```html
  <p>주문 테이블에 행이 추가될 때마다 재고를 줄이도록 <span id="ambiguous">트리거</span> 기능을 걸어 두었다.</p>
```
- `SUMMARIES`에 추가:
```ts
  트리거: {
    type: 'disambiguation',
    title: '트리거',
    extract: '트리거(Trigger)는 다음 뜻으로 쓰인다.',
    content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0' } },
  },
  '데이터베이스 트리거': {
    type: 'standard',
    title: '데이터베이스 트리거',
    extract: '데이터베이스 트리거는 테이블에 행이 추가되거나 바뀔 때 자동으로 실행되는 절차이다.',
    content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/x' } },
  },
```
- 상수 추가:
```ts
const PAGE_TEXT: Record<string, object> = {
  트리거: {
    query: {
      pages: {
        '1': {
          title: '트리거',
          extract:
            '트리거(Trigger)는 다음 뜻으로 쓰인다.\n\n== 기본 의미 ==\n트리거는 총의 방아쇠를 뜻하는 사격용어이다.\n\n== 컴퓨터 과학 ==\n데이터베이스 트리거\n\n== 기업 ==\n트리거 (애니메이션 제작사): 일본의 애니메이션 제작사\n\n== 같이 보기 ==\n방아쇠 (동음이의)',
        },
      },
    },
  },
};

const LINKED: Record<string, object> = {
  트리거: {
    query: {
      pages: {
        '2': { title: '데이터베이스 트리거', extract: '데이터베이스 트리거는 테이블에 행이 추가되거나 바뀔 때 자동으로 실행되는 절차이다.' },
        '3': { title: '트리거 (애니메이션 제작사)', extract: '일본의 애니메이션 제작사이다.' },
        '4': { title: '방아쇠', extract: '방아쇠는 총의 격발 장치이다.' },
      },
    },
  },
};
```
- 기존 `api.php` 라우트를 다음으로 바꾼다:
```ts
  await context.route(/ko\.wikipedia\.org\/w\/api\.php/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const title = params.get('titles') ?? '';
    if (params.get('generator') === 'links') return route.fulfill({ json: LINKED[title] ?? { query: {} } });
    if (params.get('prop') === 'extracts') return route.fulfill({ json: PAGE_TEXT[title] ?? { query: {} } });
    return route.fulfill({ json: { query: { search: [] } } });
  });
```

- [ ] **Step 2: 테스트 추가**

`e2e/lookup.spec.ts`:
```ts
test('뜻이 여러 개인 단어는 문맥상 뜻과 다른 뜻 목록을 보여 준다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');

  await expect(role(page, 'title')).toHaveText('트리거');
  await expect(role(page, 'suggestion')).toHaveText('데이터베이스 트리거');
  await expect(role(page, 'basic')).toContainText('총의 방아쇠');
  await expect(role(page, 'meanings')).toContainText('트리거 (애니메이션 제작사)');
});

test('문맥상 뜻을 누르면 그 뜻의 요약으로 카드가 바뀐다', async ({ page }) => {
  await openArticleAndLookUp(page, 'ambiguous');
  await expect(role(page, 'suggestion')).toBeVisible();

  await role(page, 'suggestion').click();

  await expect(role(page, 'title')).toHaveText('데이터베이스 트리거');
  await expect(role(page, 'extract')).toContainText('자동으로 실행되는 절차');
});
```

- [ ] **Step 3: 실행**

Run: `pnpm test:e2e`
Expected: 9 passed (기존 7 + 2). 실패하면 원인을 찾고, 제품 버그면 제품 코드를 고치지 말고 근거와 함께 DONE_WITH_CONCERNS로 보고한다.

- [ ] **Step 4: 전체 검증**

Run: `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: 모두 통과

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test: 실제 크롬에서 뜻이 여러 개인 단어 흐름 확인" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
```

---

## 수동 확인 (사용자)

- [ ] 실제 블로그·기사에서 "모델", "플랫폼", "버블", "트리거", "커널" 같은 단어를 찾아 "이 글에서는 아마"가 맞는지, 틀리면 다른 뜻으로 쉽게 바꿀 수 있는지
- [ ] 뜻 모음 단어를 연달아 찾아도 위키백과가 막지 않는지(429 안내가 자주 뜨지 않는지)
