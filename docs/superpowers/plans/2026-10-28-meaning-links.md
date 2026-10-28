# 뜻 모음 항목 실제 링크 연결 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 뜻 모음 문서를 글자 대신 HTML로 받아, "다른 뜻" 각 줄의 첫 번째 문서 링크를 그 줄의 목적지로 삼는다. 문장으로 쓰인 줄도 눌리게 된다.

**Architecture:** 백그라운드의 `WikipediaKoProvider`가 뜻 모음 문서를 `action=parse&prop=text|links`로 받는다. 서비스 워커에는 `DOMParser`가 없으므로 작은 태그 스캐너(상태 기계)로 `<li>` 항목·묶음 제목·`<a href>`를 읽는다. 항목의 목적지는 `links`(이름공간·존재 여부)로 확인한 첫 번째 일반 문서 링크다. 자동 선택 후보(`candidates`)와 그 요청(`generator=links`)은 그대로 둔다.

**Tech Stack:** 기존과 같음 — TypeScript ~5.9, WXT 0.21.4, Vitest 5 + happy-dom, Playwright 1.64. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-28-meaning-links-design.md`

## Global Constraints

- 기존 제약을 지킨다: WXT 자동 import 꺼짐(`imports: false`), 외부 글자는 `textContent`로만, `innerHTML` 금지, `noUncheckedIndexedAccess` 켜짐
- **권한(`permissions`, `host_permissions`)·연결 사이트·카드 모양·설정·스토어 문구·`PRIVACY.md`를 바꾸지 않는다**
- `lib/lookup/types.ts`의 `Meaning`·`DisambiguationInfo`·`LookupResult`와 `lib/messages.ts`의 검증은 **그대로**다
- `candidates` 계산과 `generator=links` 요청은 그대로. `tests/unit/lookup/sense.test.ts`의 13문장 기대값은 **바뀌면 안 된다**
- 요청 주소(정확히): `https://ko.wikipedia.org/w/api.php?action=parse&page={제목}&prop=text|links&formatversion=2&disabletoc=1&disableeditsection=1&disablelimitreport=1&format=json` (`URLSearchParams`가 `|`를 `%7C`로 바꾸는 것은 괜찮다)
- 묶음 규칙: "같이 보기"는 정확 일치(`===`)로 멈춤, 이름에 "기본"이 들어간 **첫** 묶음만 기본 뜻, 그 외 모든 제목(`h2`~`h4`)은 기본 뜻 묶음 끄기
- 항목 글자: 태그 벗김 + 엔티티 풀기 + 연속 공백 하나 + 양끝 공백 제거. `label`은 `:` 앞부분(`labelOf` 그대로)
- HTML 엔티티 범위: `&amp; &lt; &gt; &quot; &#39; &apos; &nbsp;`와 숫자형 `&#NNN;`·`&#xHH;`. 그 이상은 하지 않는다
- 커밋 메시지는 `rules/common/git-workflow.md` 형식(`<type>: <쉬운 한국어 설명>`), 꼬리말 `Co-Authored-By: <실제 커밋한 모델> <noreply@anthropic.com>`
- 작업은 `superpowers:using-git-worktrees`로 만든 별도 브랜치(`meaning-links`)에서 한다
- 각 Task 끝에 `pnpm format:check && pnpm lint && pnpm compile && pnpm test`가 통과해야 커밋한다

## Review Focus

- MediaWiki 본문에는 `<style>`(TemplateStyles)이 들어오고 `<link rel="mw-deduplicated-inline-style">`이 들어올 수 있다. `<li` 판별이 `<link`를 잡으면 안 되고, `<style>` 안의 CSS 글자가 항목 글자에 섞이면 안 된다 → Task 2
- 링크 주소의 `&amp;`(없는 문서 링크 `…&amp;action=edit&amp;redlink=1`)와 잘못된 퍼센트 인코딩(`decodeURIComponent` 예외)에서 찾기 전체가 실패하면 안 된다. 그 링크만 건너뛴다 → Task 1
- 줄의 첫 링크가 `파일:`·`특수:` 같은 다른 이름공간이면 건너뛰고 다음 링크를 봐야 하고, 첫 일반 문서 링크가 없는 문서(빨간 링크)면 뒤 링크로 넘어가지 말고 글자로 남겨야 한다 → Task 2
- parse 응답의 `text`가 문자열이 아니거나 `links`가 배열이 아니면 `disambiguation` 없이 돌려주고 캐시하지 않아야 하며, `links` 안의 모양이 틀린 항목은 무시해야 한다 → Task 3
- 제목 안에 빈 `<span id>`가 끼어 있는 옛 형식(`<h2><span id="…"></span>기본 용어</h2>`)에서도 기본 뜻 묶음을 알아봐야 한다 → Task 2 (모델 고정 데이터)

---

### Task 1: HTML 글자·링크 도우미

**Files:**
- Create: `lib/lookup/html-text.ts`
- Test: `tests/unit/lookup/html-text.test.ts`

**Interfaces:**
- Produces:
  - `export function decodeEntities(text: string): string` — Global Constraints의 엔티티 범위만
  - `export function stripTags(html: string): string` — `<style>…</style>`·`<script>…</script>`는 안쪽까지 통째로 버리고, 나머지 태그는 벗긴 뒤 `decodeEntities`, 연속 공백(`\s+`)을 공백 하나로, 양끝 공백 제거
  - `export function wikiTitleFromHref(href: string): string | null` — 먼저 `decodeEntities`. `/wiki/`로 시작하면 그 뒤에서 `#` 이후를 버리고 `decodeURIComponent` 후 `_`→공백; `redlink=1`이 들어 있으면 `new URL(href, 'https://ko.wikipedia.org').searchParams.get('title')`의 `_`→공백; 둘 다 아니거나 결과가 빈 문자열이거나 `decodeURIComponent`가 예외를 던지면 `null`

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/unit/lookup/html-text.test.ts`)
  - `describe('decodeEntities')`: `'A &amp; B &lt;C&gt; &quot;D&quot; &#39;E&#39; &apos;F&apos;'` → `'A & B <C> "D" \'E\' \'F\''`; `'생산&#160;·&#32;소비'` → `'생산 · 소비'` (`&#160;`는 줄바꿈 없는 공백 U+00A0 그대로, 공백 합치기는 `stripTags`의 몫); `'&#x41;&nbsp;B'` → `'A B'`; 모르는 엔티티 `'&foo;'`는 그대로
  - `describe('stripTags')`: `'<b>트리거</b>(Trigger)는 총의 <a href="/wiki/x" title="방아쇠">방아쇠</a>를 뜻한다.'` → `'트리거(Trigger)는 총의 방아쇠를 뜻한다.'`; `'  A\n  B  '` → `'A B'`; `'<style>.x{color:red}</style>A<script>1</script>B'` → `'AB'`; `'A &amp; B'` → `'A & B'`; `''` → `''`
  - `describe('wikiTitleFromHref')`: `'/wiki/%ED%83%9C%EB%B4%89'` → `'태봉'`; `'/wiki/Trigger_(EP)'` → `'Trigger (EP)'`; `'/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0_(%EB%94%94%EC%A6%88%EB%8B%88%2B_%EB%93%9C%EB%9D%BC%EB%A7%88)'` → `'트리거 (디즈니+ 드라마)'`; `'/wiki/A#B'` → `'A'`; `'/w/index.php?title=%EB%A7%88%EC%A7%84_(1867%EB%85%84)&amp;action=edit&amp;redlink=1'` → `'마진 (1867년)'`; `'#cite_note-1'` → `null`; `'https://ko.wiktionary.org/wiki/%EB%A7%88%EC%A7%84'` → `null`; `'/w/index.php?title=A&action=history'` → `null`; `'/wiki/'` → `null`; `'/wiki/%E0%A4%A'` → `null` (예외 없이)

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/lookup/html-text.test.ts` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — `lib/lookup/html-text.ts`에 위 세 함수. 숫자형 엔티티는 `String.fromCodePoint`, 범위 밖 값이면 원문 유지

- [ ] **Step 4: 통과 확인** — `pnpm test tests/unit/lookup/html-text.test.ts && pnpm compile && pnpm lint && pnpm format:check` → PASS

- [ ] **Step 5: 커밋** — `feat: 위키백과 HTML에서 글자와 링크 제목을 꺼내는 도우미 추가`

---

### Task 2: 뜻 모음 HTML 해석

**Files:**
- Modify: `lib/lookup/disambiguation.ts` (새 함수 추가. 기존 `parseDisambiguationText`·`buildMeanings`는 Task 3에서 지우므로 이 Task에서는 그대로 둔다)
- Create: `tests/unit/fixtures/disambiguation/parse/<단어>.json` ×9 (모델·버블·커널·터미널·스레드·트리거·마진·포트·플랫폼)
- Modify: `tests/unit/fixtures/disambiguation/load.ts`, `tests/unit/fixtures/disambiguation/SOURCE.md`
- Test: `tests/unit/lookup/disambiguation.test.ts` (새 `describe` 추가)

**Interfaces:**
- Consumes: Task 1의 `stripTags`, `wikiTitleFromHref`
- Produces (`lib/lookup/disambiguation.ts`):
  - `export interface ParsedLink { ns: number; title: string; exists: boolean }`
  - `export function parseDisambiguationHtml(html: string, links: readonly ParsedLink[]): { basic: string[]; meanings: Meaning[] }`
- Produces (`load.ts`):
  - `export function parseResponse(word: string): ParseApiResponse` — `parse/<단어>.json` 원본 (`ParseApiResponse = { parse?: { text?: unknown; links?: unknown } }`)
  - `export function parseHtml(word: string): string` — `parse.text`
  - `export function parseLinks(word: string): ParsedLink[]` — `parse.links` 중 `ns` 숫자·`title` 문자열·`exists` 불리언인 항목만

- [ ] **Step 1: 고정 데이터 받기** — 저장소 루트에서:

```bash
mkdir -p tests/unit/fixtures/disambiguation/parse
for w in 모델 버블 커널 터미널 스레드 트리거 마진 포트 플랫폼; do
  curl -sS -A "DragAndFind-fixtures/1.0 (maestro001220@gmail.com)" \
    "https://ko.wikipedia.org/w/api.php?action=parse&page=$(node -p "encodeURIComponent('$w')")&prop=text%7Clinks&formatversion=2&disabletoc=1&disableeditsection=1&disablelimitreport=1&format=json" \
    -o "tests/unit/fixtures/disambiguation/parse/$w.json"
done
```

  `SOURCE.md`에 `parse/<단어>.json` 항목(받은 날짜 2026-10-28, 위 명령)을 추가한다. `pages/` 항목 설명은 Task 3에서 지운다

- [ ] **Step 2: 로더 추가** — `load.ts`에 `parseResponse`·`parseHtml`·`parseLinks` 추가 (`kind`에 `'parse'` 추가)

- [ ] **Step 3: 실패하는 테스트 작성** — `tests/unit/lookup/disambiguation.test.ts`에 `describe('parseDisambiguationHtml')`. 실제 고정 데이터(`parseHtml(w)`, `parseLinks(w)`)로:
  - `'links every sentence-form item of 마진 to its first article link'`: `meanings.map((m) => m.title)` = `['태봉', '홍역', '한계', '중간 이윤', '여백', null]`, `meanings[0]?.label`이 `'마진(摩震)은'`으로 시작, `basic` = `[]`
  - `'leaves an item alone when its first link is a missing page (플랫폼)'`: label이 `'플랫폼 (소설)'`로 시작하는 항목의 `title` = `null`; `'승강장은'`으로 시작하는 항목의 `title` = `'승강장'`
  - `'keeps the basic section as text and stops at see-also (트리거)'`: `basic` 길이 2, `basic[0]`에 `'총의 방아쇠'` 포함; label `'〈Trigger (EP)〉'`로 시작 → `title` `'Trigger (EP)'`; label에 `'네이버웹툰'` 포함 → `null`; 어떤 label에도 `'방아쇠 (동음이의)'`·`'모든 문서'`·`'동음이의어 문서'` 없음
  - `'flattens nested sub-items without mixing them into the parent (포트)'`: label `'마이크로컨트롤러 포트'`로 시작하는 항목이 **하나** 있고 `title` = `'마이크로컨트롤러 포트'`; label `'컴퓨터 하드웨어 포트'`로 시작하는 항목이 **하나** 있고 `title` = `'컴퓨터 하드웨어 포트'`; label `'포트(port)는'`으로 시작하는 항목의 `title` = `'항구'`
  - `'recognises the basic section even when the heading holds an empty span (모델)'`: `basic` 길이 2, `basic[1]`이 `'모형화'`로 시작; label `'비즈니스 모델'`로 시작 → `title` `'비즈니스 모델'`
  - `it.each(['버블', '커널', '터미널', '스레드'])('resolves only existing article links (%s)')`: `meanings` 중 `title !== null`인 것이 하나 이상, 그 모든 `title`이 `parseLinks(w)`에 `ns === 0 && exists === true`로 있음

  손으로 만든 HTML로 (`links`는 각 사례에 맞게 최소로):
  - `'does not mistake <link> tags for list items'`: `'<link rel="mw-deduplicated-inline-style" href="mw-data:TemplateStyles:r1"><ul><li><a href="/wiki/A">A</a>: 설명</li></ul>'` → `meanings` = `[{ label: 'A', title: 'A' }]`
  - `'drops style content inside an item'`: `'<ul><li><style>.x{color:red}</style><a href="/wiki/A">A</a>: 설명</li></ul>'` → label `'A'`
  - `'ignores list items inside tables'`: `'<ul><li><a href="/wiki/A">A</a></li></ul><table><tr><td><ul><li>표 안</li></ul></td></tr></table>'` → `meanings` 길이 1
  - `'decodes entities in item text'`: `'<ul><li>A &amp; B&#160;C</li></ul>'` → label `'A & B C'`
  - `'skips non-article links and uses the first article link'`: `'<ul><li><a href="/wiki/%ED%8C%8C%EC%9D%BC:X.svg">i</a><a href="/wiki/A">A</a></li></ul>'`, links `[{ ns: 6, title: '파일:X.svg', exists: true }, { ns: 0, title: 'A', exists: true }]` → `title` `'A'`
  - `'skips footnote and external links'`: `'<ul><li><a href="#cite_note-1">[1]</a><a href="https://example.com/">x</a>A</li></ul>'` → `title` `null`
  - `'stops at a missing first link instead of moving to later links'`: `'<ul><li><a href="/w/index.php?title=A&amp;action=edit&amp;redlink=1" class="new">A</a>은 <a href="/wiki/B">B</a>의 소설</li></ul>'`, links A `exists: false`, B `exists: true` → `title` `null`
  - `'ignores links missing from the link list'`: `'<ul><li><a href="/wiki/Z">Z</a> <a href="/wiki/A">A</a></li></ul>'`, links A만 → `title` `'A'`
  - `'uses only the first section whose name contains 기본'`: `'<h2><span id="x"></span>기본 용어</h2><ul><li>첫 뜻</li></ul><h2>기본 아님</h2><ul><li>둘째 줄</li></ul>'` → `{ basic: ['첫 뜻'], meanings: [{ label: '둘째 줄', title: null }] }`
  - `'an h3 after the basic section ends it'`: `'<div class="mw-heading"><h2 id="a">기본 의미</h2></div><ul><li>a</li></ul><div class="mw-heading"><h3 id="b">소제목</h3></div><ul><li>b</li></ul>'` → `basic` `['a']`, `meanings[0]?.label` `'b'`
  - `'stops at see-also'`: `'<ul><li>a</li></ul><h2>같이 보기</h2><ul><li>b</li></ul>'` → `meanings` 길이 1
  - `'drops empty items'`: `'<ul><li></li><li>  </li><li>a</li></ul>'` → 길이 1
  - `'handles empty html'`: `parseDisambiguationHtml('', [])` → `{ basic: [], meanings: [] }`

- [ ] **Step 4: 실패 확인** — `pnpm test tests/unit/lookup/disambiguation.test.ts` → 새 테스트 FAIL (함수 없음)

- [ ] **Step 5: 구현** — `parseDisambiguationHtml`. 태그만 훑는 한 번 스캔. 정규식은 이름 뒤에 공백·`>`·`/`가 오는 것만 잡는다(`<li`가 `<link`를, `<a`가 `<abbr`을 잡지 않게): `/<(\/?)(table|style|script|h[2-4]|ul|ol|li)(?=[\s>/])[^>]*>/giu`
  - 상태: `skipDepth`(table·style·script 안이면 > 0 — 안에서는 다른 태그를 모두 무시), `heading`(여는 `h2~4`의 끝 위치, 닫는 태그에서 `stripTags(html.slice(...))`로 제목 글자), `item`(여는 `<li>`의 끝 위치), `inBasic`·`basicTaken`
  - 항목 닫기: `<ul`·`<ol`·`</li>`. 닫을 때 `raw = html.slice(itemStart, tagStart)`, `text = stripTags(raw)`, 링크 제목 = `raw`의 `<a …href="…">`들을 순서대로 `wikiTitleFromHref`(null 제외). 빈 `text`는 버림
  - 목적지: 링크 제목을 앞에서부터 `links`에서 찾는다(`Map<title, ParsedLink>`). 없으면 다음, `ns !== 0`이면 다음, `ns === 0`이면 `exists ? title : null`로 **끝**. 다 돌면 `null`
  - `basic`이면 `text`만, 아니면 `{ label: labelOf(text), title }`
  - 제목 "같이 보기"에서 스캔 종료

- [ ] **Step 6: 통과 확인** — `pnpm test && pnpm compile && pnpm lint && pnpm format:check` → PASS (기존 테스트 포함)

- [ ] **Step 7: 커밋** — `feat: 뜻 모음 문서 HTML에서 항목과 첫 링크를 읽는 해석기 추가`

---

### Task 3: 제공자를 HTML 요청으로 바꾸고 글자 방식 제거

**Files:**
- Modify: `lib/lookup/wikipedia.ts` (`fetchDisambiguation`, `ExtractsResponse`, import)
- Modify: `lib/lookup/disambiguation.ts` (`parseDisambiguationText`·`buildMeanings`·`longestPrefixTitle`·`HEADING` 등 글자 방식 제거)
- Delete: `tests/unit/fixtures/disambiguation/pages/*.json` ×9
- Modify: `tests/unit/fixtures/disambiguation/load.ts` (`pageTextResponse`·`pageText` 제거), `SOURCE.md` (`pages/` 설명 제거)
- Test: `tests/unit/lookup/wikipedia.test.ts`, `tests/unit/lookup/disambiguation.test.ts` (글자 방식 `describe` 두 개 제거)

**Interfaces:**
- Consumes: Task 2의 `parseDisambiguationHtml`, `ParsedLink`, `parseResponse`
- Produces: 없음 (`LookupProvider.lookup` 겉모양 그대로)

- [ ] **Step 1: 테스트 고치기/추가** — `wikipedia.test.ts`:
  - `disambiguationFetch(word, overrides: { linked?: () => Response; parse?: () => Response })`: `url.searchParams.get('action') === 'parse'`이면 `overrides.parse?.() ?? json(parseResponse(word))`, `generator === 'links'`면 지금처럼, 그 외는 `notFound()`
  - `'adds basic meanings, meanings and candidates with two extra requests'`: 호출 3번 유지. 추가로 호출된 주소 중 하나의 `searchParams`가 `action=parse`, `page=트리거`, `prop=text|links`, `formatversion=2`인지. 기존 단언(`basic` 2개, `{ label: '데이터베이스 트리거', title: '데이터베이스 트리거' }`, 후보에 `방아쇠`) 유지
  - 새 `'links a sentence-form item to its first article link'`: `disambiguationFetch('마진')` → label `'마진(痲疹)은'`으로 시작하는 항목의 `title` = `'홍역'`
  - `'makes meanings that link to redirect pages clickable'`(모델): 그대로 통과해야 함
  - 새 `'keeps the plain disambiguation result when the parse response has no text'`: `parse: () => json({ parse: { links: [] } })` → `disambiguation` falsy
  - 새 `'keeps the plain disambiguation result when links is not an array'`: `parse: () => json({ parse: { text: '<ul></ul>', links: 'x' } })` → falsy
  - 새 `'ignores malformed link entries'`: `parse: () => json({ parse: { text: '<ul><li><a href="/wiki/A">A</a></li></ul>', links: [{ ns: 0, title: 'A' }, 'junk', null] } })` → `meanings` = `[{ label: 'A', title: null }]`
  - `'keeps the plain disambiguation result when the page-text request fails to connect'` → 이름을 `'… when the parse request fails to connect'`로, 라우트는 `action=parse`에서 `throw new TypeError('Failed to fetch')`
  - import에서 `pageTextResponse` 제거, `parseResponse` 추가
  - `disambiguation.test.ts`: `describe('parseDisambiguationText')`·`describe('buildMeanings')` 삭제, `pageText`·`linkedResponse` import 제거

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/lookup/wikipedia.test.ts` → 새 테스트 FAIL (아직 extracts 요청)

- [ ] **Step 3: 구현** — `wikipedia.ts`:
  - `interface ParseResponse { parse?: { text?: unknown; links?: unknown } }`, `function isParsedLink(value: unknown): value is ParsedLink` (ns 숫자·title 문자열·exists 불리언)
  - `fetchDisambiguation`: `Promise.all([requestJson<ParseResponse>(parse 주소), fetchPages({ generator… 그대로 })])`. `text`가 문자열이 아니거나 `links`가 배열이 아니거나 `linkedPages === null`이면 `null`. `const { basic, meanings } = parseDisambiguationHtml(text, links.filter(isParsedLink))`. `candidates`는 기존 코드 그대로. `linkedTitles`와 `ExtractsResponse.missing` 제거
  - `disambiguation.ts`에서 글자 방식 함수·상수 제거(`labelOf`는 남긴다). `load.ts`에서 글자 로더 제거, `pages/` 삭제, `SOURCE.md` 갱신

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm compile && pnpm lint && pnpm format:check` → PASS. `tests/unit/lookup/sense.test.ts`의 13문장은 손대지 않았는데 통과해야 한다

- [ ] **Step 5: 커밋** — `feat: 뜻 모음 항목을 위키백과 문서의 실제 링크로 연결`

---

### Task 4: 실제 크롬 확인과 문서 정리

**Files:**
- Modify: `e2e/fixtures.ts` (`PAGE_TEXT` → `PARSE`, `SUMMARIES`에 `방아쇠`, 라우트), `e2e/lookup.spec.ts`
- Modify: `docs/superpowers/specs/2026-10-24-disambiguation-design.md` (§3 "제외"의 문장형 항목 줄 끝에 ` — 2026-10-28 \`meaning-links\` 설계로 해결`), `docs/superpowers/specs/2026-10-28-meaning-links-design.md` (상태 → `승인됨 (2026-10-28)`)

**Interfaces:**
- Consumes: Task 3의 요청 모양(`action=parse`, `page`)
- Produces: 없음

- [ ] **Step 1: 가짜 응답 바꾸기** — `e2e/fixtures.ts`:
  - `PAGE_TEXT` 삭제. `PARSE: Record<string, object>`에 `트리거`: `{ parse: { title: '트리거', pageid: 1, text: <HTML>, links: [...] } }`. HTML은 실제 구조를 따른다: `<div class="mw-parser-output"><p>트리거(Trigger)는 다음 뜻으로 쓰인다.</p>` + `<div class="mw-heading mw-heading2"><h2 id="기본_의미">기본 의미</h2></div><ul><li>트리거는 총의 <a href="/wiki/%EB%B0%A9%EC%95%84%EC%87%A0" title="방아쇠">방아쇠</a>를 뜻하는 사격용어이다.</li></ul>` + 묶음 `컴퓨터 과학`에 `<li><a href="/wiki/%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B2%A0%EC%9D%B4%EC%8A%A4_%ED%8A%B8%EB%A6%AC%EA%B1%B0" title="데이터베이스 트리거">데이터베이스 트리거</a></li>` + 묶음 `기업`에 `<li><a href="/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0_(%EC%95%A0%EB%8B%88%EB%A9%94%EC%9D%B4%EC%85%98_%EC%A0%9C%EC%9E%91%EC%82%AC)" title="트리거 (애니메이션 제작사)">트리거 (애니메이션 제작사)</a>: 일본의 애니메이션 제작사</li>` + 묶음 `사격`에 **문장형 줄** `<li><a href="/wiki/%EB%B0%A9%EC%95%84%EC%87%A0" title="방아쇠">트리거</a>(trigger)는 총의 방아쇠를 가리킨다.</li>` + 묶음 `같이 보기`에 `<li><a href="/wiki/%EB%B0%A9%EC%95%84%EC%87%A0_(%EB%8F%99%EC%9D%8C%EC%9D%B4%EC%9D%98)" title="방아쇠 (동음이의)">방아쇠 (동음이의)</a></li></ul></div>`. `links`: 방아쇠·데이터베이스 트리거·트리거 (애니메이션 제작사)·방아쇠 (동음이의) 모두 `{ ns: 0, exists: true }`
  - `SUMMARIES['방아쇠']`: `{ type: 'standard', title: '방아쇠', extract: '방아쇠는 총의 격발 장치이다.', content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/%EB%B0%A9%EC%95%84%EC%87%A0' } } }`
  - `api.php` 라우트: `params.get('action') === 'parse'`이면 `PARSE[params.get('page') ?? ''] ?? { parse: {} }`, 그다음 `generator === 'links'`는 지금처럼, 나머지는 검색 빈 결과. `prop === 'extracts'` 분기 삭제

- [ ] **Step 2: 실패하는 E2E 추가** — `e2e/lookup.spec.ts`, 기존 "문맥상 뜻을 누르면" 테스트 뒤에 `'문장으로 쓰인 다른 뜻을 누르면 그 문서의 요약으로 바뀐다'`: `openArticleAndLookUp(page, 'ambiguous')` → `role(page, 'meanings').locator('[data-role="meaning"]', { hasText: '총의 방아쇠를 가리킨다' }).click()` → `role(page, 'title')` = `'방아쇠'`, `role(page, 'extract')`에 `'격발 장치'` 포함. 기존 두 뜻 모음 테스트의 단언(`basic`에 `'총의 방아쇠'`, `meanings`에 `'트리거 (애니메이션 제작사)'`, suggestion 누르기)은 그대로 통과해야 한다

- [ ] **Step 3: 실행 확인** — `pnpm test:e2e` → 전부 PASS (빌드 포함). 실패하면 `test-results/`의 추적을 보고 고친다

- [ ] **Step 4: 문서** — 두 설계 문서의 한 줄 수정 (위 Files)

- [ ] **Step 5: 전체 검증** — `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e` → PASS

- [ ] **Step 6: 커밋** — E2E는 `test: 문장으로 쓰인 다른 뜻을 실제 크롬에서 눌러 확인`, 문서는 `docs: 뜻 모음 항목 링크 설계 승인 표시와 이전 설계의 후속 과제 정리`로 따로 커밋 (`docs/superpowers/specs/2026-10-28-meaning-links-design.md`와 이 계획 문서도 문서 커밋에 넣는다)
