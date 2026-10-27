# 카드 검색어 칸 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 맨 아래 줄을 `[검색어 입력칸] [구글] [네이버]` 한 줄로 바꿔 검색어를 고쳐서 검색할 수 있게 하고, 입력칸에서 `Enter`를 누를 때 쓸 검색 사이트를 설정(기본 네이버)에서 고르게 한다.

**Architecture:** 설정에 `searchEngine`을 더한다. 카드의 구글·네이버 버튼은 지금처럼 `<a target="_blank">` 링크로 두고, 입력칸 값이 바뀔 때마다 `href`를 다시 만든다. `Enter`는 설정에서 고른 쪽 링크를 `click()`한다. 카드가 다시 그려질 때 같은 검색어면 고친 값·커서를 옮겨 담는다. 페이지 쪽은 기존 테마 감시(`watchTheme`)를 설정 전체 감시(`watchSettings`)로 넓혀 현재 `searchEngine`을 들고 있다가 카드에 넘긴다.

**Tech Stack:** 기존과 같음 — TypeScript ~5.9, WXT 0.21.4, Vitest 5 + happy-dom, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-27-search-input-design.md`

## Global Constraints

- 기존 제약을 지킨다: WXT 자동 import 꺼짐(`imports: false`), 외부 글자는 `textContent`·`value`로만, `innerHTML` 금지, `noUncheckedIndexedAccess` 켜짐
- **권한(`permissions`, `host_permissions`)을 바꾸지 않는다**
- 설정 값: `searchEngine: 'naver' | 'google'`, 기본 `'naver'`. 잘못된 값·없는 값은 `'naver'`
- **회사 로고나 로고를 닮은 표시를 쓰지 않는다.** 기존 `.card-action-mark*`(색 글자 G·N)를 없앤다. 버튼 색은 카드 기본 변수(`--dnf-text`, `--dnf-button`, `--dnf-border`)만
- 문구(정확히 이대로): 버튼 `구글`·`네이버`, 버튼 `aria-label`·`title` `구글 검색`·`네이버 검색`, 입력칸 `aria-label` `검색어`, 설정 제목 `Enter로 검색할 곳`, 선택지 `네이버`·`구글`(이 순서), 안내 `카드의 검색어 칸에서 Enter를 누르면 이 사이트로 검색합니다.`
- 기존 `data-role` `google`·`naver`는 유지한다. 새 역할: `search-input`
- 카드가 뜰 때 입력칸에 자동 포커스하지 않는다
- 커밋 메시지는 `rules/common/git-workflow.md` 형식(`<type>: <쉬운 한국어 설명>`), 꼬리말 `Co-Authored-By: <실제 커밋한 모델> <noreply@anthropic.com>`
- 작업은 `superpowers:using-git-worktrees`로 만든 별도 브랜치에서 한다

## Review Focus

- 한글 입력 중(조합 중) 글자 확정용 `Enter`에 검색이 열리면 안 된다 → Task 3
- 입력칸에 글자를 칠 때 페이지가 `document`에 버블 단계로 단 단축키가 실행되면 안 된다. `Esc`로 카드 닫기는 계속 돼야 한다 → Task 3 단위, Task 5 E2E
- "찾는 중 → 결과"로 다시 그려질 때 고친 값과 커서가 사라지면 안 된다(사라지면 이어 치는 키가 페이지로 간다) → Task 3
- 입력칸을 비우거나 공백만 남기면 구글·네이버 버튼·`Enter` 모두 아무 일도 하지 않아야 한다 → Task 3
- 예전 버전이 저장한 설정(`{ showIcon, theme }`만 있음)을 읽어도 `searchEngine`이 `'naver'`가 돼야 하고, 설정을 못 읽는 끊긴 탭에서도 `Enter`는 네이버로 검색해야 한다 → Task 1, Task 4

---

### Task 1: 설정에 검색 사이트 추가

**Files:**
- Modify: `lib/settings.ts`, `lib/search-urls.ts`
- Test: `tests/unit/settings.test.ts`, `tests/unit/search-urls.test.ts`
- Modify (기대값 갱신): `tests/unit/options-page.test.ts`, `tests/unit/content/theme.test.ts` 등 `Settings` 객체 전체를 `toEqual`로 비교하거나 `Settings`를 만드는 모든 테스트 — `searchEngine: 'naver'`를 더한다 (`pnpm compile`이 빠진 곳을 알려 준다)

**Interfaces:**
- Produces:
  - `export type SearchEngine = 'naver' | 'google'`
  - `export const SEARCH_ENGINES: readonly SearchEngine[] = ['naver', 'google']`
  - `Settings.searchEngine: SearchEngine`, `DEFAULT_SETTINGS = { showIcon: true, theme: 'auto', searchEngine: 'naver' }`
  - `export function isSearchEngine(value: unknown): value is SearchEngine`
  - `lib/search-urls.ts`: `export function searchUrl(engine: SearchEngine, query: string): string` — `google`이면 `googleSearchUrl`, `naver`면 `naverSearchUrl`

- [ ] **Step 1: 실패하는 테스트 작성** (`tests/unit/settings.test.ts`에 `describe('searchEngine')`)
  - `DEFAULT_SETTINGS.searchEngine`은 `'naver'`
  - `it.each(['naver', 'google'])`: `parseSettings({ showIcon: true, theme: 'auto', searchEngine })`이 그 값을 유지
  - `it.each(['Naver', 'bing', 3, null, undefined])`: `parseSettings({ showIcon: false, theme: 'dark', searchEngine })` → `{ showIcon: false, theme: 'dark', searchEngine: 'naver' }`
  - `'reads settings saved before search engines existed'`: `parseSettings({ showIcon: false, theme: 'light' })` → `{ showIcon: false, theme: 'light', searchEngine: 'naver' }`
  - `isSearchEngine('google')` true, `isSearchEngine('Google')` false
  - `tests/unit/search-urls.test.ts`: `searchUrl('google', 'a b')` → `'https://www.google.com/search?q=a%20b'`, `searchUrl('naver', '챗GPT 뜻')` → `'https://search.naver.com/search.naver?query=%EC%B1%97GPT%20%EB%9C%BB'`

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/settings.test.ts tests/unit/search-urls.test.ts` → 새 테스트 FAIL

- [ ] **Step 3: 구현** — `parseSettings`에 `searchEngine: isSearchEngine(searchEngine) ? searchEngine : DEFAULT_SETTINGS.searchEngine` 추가. `searchUrl` 추가. 기존 테스트들의 `Settings` 기대값·인자에 `searchEngine: 'naver'`를 더한다

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm compile` → 전부 PASS, 타입 오류 없음

- [ ] **Step 5: 커밋** — `feat: 설정에 Enter로 검색할 사이트 항목 추가`

---

### Task 2: 설정 화면에 "Enter로 검색할 곳" 추가

**Files:**
- Modify: `entrypoints/options/index.html`, `lib/options-page.ts`
- Test: `tests/unit/options-page.test.ts`

**Interfaces:**
- Consumes: Task 1의 `SearchEngine`, `isSearchEngine`
- Produces: 마크업 `<fieldset id="search-engine">` 안에 `input[type=radio][name="search-engine"]` 두 개, `id`는 `search-engine-naver`·`search-engine-google`, `value`는 `naver`·`google`

- [ ] **Step 1: 실패하는 테스트 작성** — 테스트 `MARKUP`에 위 fieldset 추가. `describe('search engine')`:
  - `'checks naver when nothing is stored'`: 빈 저장소 → `search-engine-naver` checked
  - `'shows the stored search engine'`: `{ showIcon: true, theme: 'auto', searchEngine: 'google' }` 저장 후 → `search-engine-google` checked
  - `'saves the chosen search engine and keeps other settings'`: `{ showIcon: false, theme: 'dark', searchEngine: 'naver' }` 저장 → google 선택(`checked = true` + `change` 이벤트) → flush → `loadSettings` = `{ showIcon: false, theme: 'dark', searchEngine: 'google' }`
  - `'puts the previous search engine back when saving fails'`: 테마의 같은 이름 테스트와 같은 방식(저장 실패하는 area) → naver가 다시 checked

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/options-page.test.ts` → 새 테스트 FAIL

- [ ] **Step 3: 구현**
  - `index.html`: 카드 테마 `<section>` 바로 아래에 같은 모양의 `<section>` — `<fieldset id="search-engine">`, `<legend>Enter로 검색할 곳</legend>`, `.segmented` 안에 네이버·구글 라디오+라벨, `<span class="hint">카드의 검색어 칸에서 Enter를 누르면 이 사이트로 검색합니다.</span>`
  - `options-page.ts`: 테마 라디오와 같은 방식으로 `render`에서 checked를 맞추고, `change`에서 `isSearchEngine`으로 확인 후 `session.update({ searchEngine })`

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm compile && pnpm lint` → PASS

- [ ] **Step 5: 커밋** — `feat: 설정 화면에서 Enter로 검색할 사이트 고르기`

---

### Task 3: 카드 검색 줄

**Files:**
- Modify: `lib/ui/card.ts`, `lib/ui/styles.ts`
- Test: `tests/unit/ui/card.test.ts`, (필요하면) `tests/unit/ui/styles.test.ts`

**Interfaces:**
- Consumes: Task 1의 `SearchEngine`, `searchUrl`
- Produces: `CardHandlers`에 `getSearchEngine(): SearchEngine` 추가 (동기 함수 — `Enter` 처리 안에서 바로 `click()`해야 새 탭이 팝업 차단에 걸리지 않는다)

검색 줄 구조: `footer.card-actions` 안에 `input.card-search-input`(`data-role="search-input"`, `type="text"`, `aria-label="검색어"`, `data-query`=그 카드의 `query`) + 기존처럼 `a.card-action`(`data-role` `google`/`naver`, 글자 `구글`/`네이버`, `aria-label`·`title` `구글 검색`/`네이버 검색`, `target="_blank"`, `rel="noopener noreferrer"`). `too_long` 카드에는 지금처럼 없다.

- [ ] **Step 1: 실패하는 테스트 작성** (기존 `G`·`N` 표시 테스트(316~319행)는 아래 첫 항목으로 바꾼다)
  - `'shows search buttons as plain names without logo marks'`: `part('google')?.textContent` = `'구글'`, `part('naver')?.textContent` = `'네이버'`, `aria-label`·`title` = `'구글 검색'`·`'네이버 검색'`, `card.querySelector('.card-action-mark')` = null
  - `'fills the search input with the query'`: `part('search-input')`의 `value` = `'온보딩'`, `aria-label` = `'검색어'`
  - `'updates both links when the search input changes'`: 값을 `'챗GPT 뜻'`으로 바꾸고 `input` 이벤트 → google `href` = `searchUrl('google', '챗GPT 뜻')`, naver도 같은 방식
  - `'trims spaces in the search input'`: `'  챗GPT  '` → naver `href` = `searchUrl('naver', '챗GPT')`
  - `'disables links when the search input is blank'`: `'   '` → 두 링크 모두 `hasAttribute('href')` false, `aria-disabled` = `'true'`. 다시 `'a'` 입력 → `href` 생기고 `aria-disabled` 없음
  - `'opens the chosen engine on Enter'`: `getSearchEngine`이 `'google'` 반환, 링크 `click` 감시(`vi.spyOn(part('google')!, 'click')`) → 입력칸에 `new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })` → google `click` 1회, naver 0회, 이벤트 `defaultPrevented` true
  - `'ignores Enter while composing Korean'`: `{ key: 'Enter', isComposing: true }` → `click` 0회. `{ key: 'Enter', keyCode: 229 }`도 0회
  - `'does nothing on Enter when the search input is blank'`: 값 `''` → `click` 0회
  - `'keeps key events inside the search input'`: `card`를 `document.body`에 붙이고 `document`에 버블 `keydown`·`keyup`·`keypress` 리스너 → 입력칸에서 세 이벤트(`bubbles: true, composed: true`, key `'k'`)를 보냄 → 리스너 0회
  - `'keeps an edited value and caret when the same query is redrawn'`: `card`를 `document.body`에 붙이고 `loading`으로 그림 → 값 `'온보딩 뜻'`, `focus()`, `setSelectionRange(2, 2)` → 같은 `'온보딩'`으로 `result`(not_found) 다시 그림 → 새 입력칸 값 `'온보딩 뜻'`, `document.activeElement`가 새 입력칸, `selectionStart` 2, 링크 `href`도 고친 값
  - `'resets the search input when the query changes'`: `'트리거'`로 그리고 값 고침 → `'데이터베이스 트리거'`로 다시 그림 → 값 `'데이터베이스 트리거'`
  - `'does not focus the search input on first render'`: `card`를 body에 붙이고 그림 → `document.activeElement`가 입력칸이 아님

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/ui/card.test.ts` → 새 테스트 FAIL (기존 `handlers` 기본값에 `getSearchEngine: () => 'naver'`를 더해 둔다)

- [ ] **Step 3: 구현**
  - `renderCard`: `replaceChildren` 전에 기존 `[data-role="search-input"]`을 찾아, `dataset.query === query`이면 값·포커스 여부(`(card.getRootNode() as Document | ShadowRoot).activeElement === 그 입력칸`)·`selectionStart/End`를 담아 둔다. 새 검색 줄에 값을 넣고 링크를 갱신한 뒤, 포커스였으면 `focus()` + `setSelectionRange`
  - `buildActions(doc, query, getSearchEngine, carried?)`: 입력칸 `input` 이벤트 → 두 링크 갱신(`trim()` 결과가 비면 `href` 제거 + `aria-disabled="true"`). 입력칸 `keydown`·`keyup`·`keypress`에서 `stopPropagation()`. `keydown`이 `Enter`이고 `!event.isComposing && event.keyCode !== 229`이면 `preventDefault()` 후 `getSearchEngine()` 쪽 링크가 `href`를 가졌을 때만 `click()`
  - `actionLink`에서 `.card-action-mark` 만들기를 지우고 글자를 `구글`/`네이버`로, `title` 추가
  - `styles.ts`: `.card-action-mark*` 규칙 삭제. `.card-actions`는 한 줄(`align-items: center; gap: 6px`). `.card-action`은 `flex: none; padding: 6px 11px`. 새 `.card-search-input`: `flex: 1; min-width: 0; box-sizing: border-box; padding: 6px 10px; border: 1px solid var(--dnf-border); border-radius: 8px; background: var(--dnf-surface); color: var(--dnf-text); font: inherit; font-size: 13px`, `:focus-visible`은 `outline: 2px solid var(--dnf-accent); outline-offset: -1px`. `a.card-action[aria-disabled='true']`는 `opacity: 0.5; cursor: default`

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm compile && pnpm lint` → PASS

- [ ] **Step 5: 커밋** — `feat: 카드에서 검색어를 고쳐 구글·네이버로 검색`

---

### Task 4: 페이지에 설정 연결

**Files:**
- Modify: `lib/content/theme.ts` → `watchTheme`를 `watchSettings`로 넓힘 (파일 이름은 `lib/content/settings-watch.ts`로 바꾸고 테스트도 `tests/unit/content/settings-watch.test.ts`로 옮김), `lib/content/controller.ts`, `entrypoints/content.ts`
- Test: `tests/unit/content/settings-watch.test.ts`, `tests/unit/content/controller.test.ts`

**Interfaces:**
- Consumes: Task 3의 `CardHandlers.getSearchEngine`
- Produces:
  - `export interface SettingsWatchDeps { loadSettings(): Promise<Settings>; onSettingsChanged(listener: (raw: unknown) => void): void; applySettings(settings: Settings): void }`
  - `export async function watchSettings(deps: SettingsWatchDeps): Promise<void>` — 시작 시 한 번, 바뀔 때마다 `parseSettings(raw)` 결과로 `applySettings`. 읽기 실패 시 아무것도 하지 않음(기존 동작과 같다)
  - `ControllerDeps.getSearchEngine(): SearchEngine` — 컨트롤러는 `showCard`의 handlers에 그대로 넘긴다

- [ ] **Step 1: 실패하는 테스트 작성**
  - 기존 `watchTheme` 테스트 4개를 `watchSettings`로 옮겨 `applySettings`에 넘어간 `Settings` 전체를 확인(`'uses defaults for a malformed change'` → `DEFAULT_SETTINGS`)
  - 추가: `'passes a changed search engine right away'`: `change({ showIcon: true, theme: 'auto', searchEngine: 'google' })` → 마지막 호출의 `searchEngine` = `'google'`
  - `controller.test.ts`: `'passes the current search engine to the card'` — `getSearchEngine`을 `vi.fn(() => 'google')`로 주고 찾기 후 `overlay.showCard`에 넘어간 handlers의 `getSearchEngine()`이 `'google'`

- [ ] **Step 2: 실패 확인** — `pnpm test tests/unit/content` → FAIL

- [ ] **Step 3: 구현**
  - `settings-watch.ts`: 위 시그니처
  - `content.ts`: `let searchEngine: SearchEngine = DEFAULT_SETTINGS.searchEngine;` `watchSettings({ ..., applySettings: (settings) => { overlay.setTheme(settings.theme); searchEngine = settings.searchEngine; } })`, `createController({ ..., getSearchEngine: () => searchEngine })`. 설정을 못 읽으면 기본값 `'naver'`가 그대로 남는다
  - `controller.ts`: `showCard`의 handlers에 `getSearchEngine: deps.getSearchEngine`

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm compile && pnpm lint` → PASS

- [ ] **Step 5: 커밋** — `feat: 설정한 검색 사이트를 열린 탭 카드에 바로 반영`

---

### Task 5: 실제 크롬 확인과 안내 문서

**Files:**
- Test: `e2e/lookup.spec.ts`
- Modify: `README.md`, `PRIVACY.md`, `docs/store/listing.md`, `docs/store/images/*` (`pnpm store:images`로 다시 만듦)

- [ ] **Step 1: E2E 테스트 작성** (기존 `role()` 도우미 사용)
  - `'검색어를 고친 뒤 Enter를 누르면 네이버에서 고친 말로 검색한다'`: `openArticleAndLookUp(page, 'unknown')` → `role(page, 'search-input').fill('챗GPT 뜻')` → `Promise.all([context.waitForEvent('page'), role(page, 'search-input').press('Enter')])` → 새 탭 URL = `'https://search.naver.com/search.naver?query=%EC%B1%97GPT%20%EB%9C%BB'`
  - `'설정에서 구글을 고르면 Enter로 구글에서 검색한다'`: 테마 E2E처럼 설정 화면에서 `label[for="search-engine-google"]` 클릭 → 저장 확인(poll) → 기사 탭으로 돌아와 찾기 → `Enter` → 새 탭 URL이 `https://www.google.com/search?q=`로 시작
  - `'검색어 칸에 글자를 쳐도 페이지 단축키가 실행되지 않는다'`: 찾기 후 `page.evaluate(() => { (window as any).keyCount = 0; document.addEventListener('keydown', () => (window as any).keyCount++); })` → `role(page, 'search-input').press('k')` → `keyCount` 0. 이어서 `press('Escape')` → `role(page, 'card')` 사라짐
  - 기존 `'구글·네이버 버튼은 선택한 단어로 검색한 새 탭을 연다'`는 그대로 통과해야 한다

- [ ] **Step 2: 실행** — `pnpm test:e2e` → 모두 PASS (실패하면 `superpowers:systematic-debugging`)

- [ ] **Step 3: 문서 고치기**
  - `README.md` 주요 기능의 구글·네이버 줄: 검색어를 고쳐서 검색할 수 있고, `Enter`는 설정에서 고른 사이트(기본 네이버)로 검색한다고 적는다. 설정 줄에 "Enter로 검색할 곳" 추가
  - `docs/store/listing.md` 자세한 설명의 같은 줄을 같은 내용으로
  - `PRIVACY.md`·`listing.md`의 전달 설명: "선택한 글" → "선택한 글(또는 사용자가 고친 검색어)". 누르거나 `Enter`를 칠 때만 열린다는 점 유지. 보내는 곳은 그대로
  - 개인정보 처리방침에 날짜가 있으면 오늘(2026-10-27)로

- [ ] **Step 4: 스토어 이미지 다시 만들기** — `pnpm store:images` → `docs/store/images/` 갱신, 스크린샷을 열어 새 검색 줄이 보이는지 눈으로 확인

- [ ] **Step 5: 전체 검증** — `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e` → 모두 PASS

- [ ] **Step 6: 커밋** — `docs: 검색어 고치기 안내와 스토어 이미지 갱신` (E2E 테스트는 `test: 검색어 고쳐서 검색하는 흐름을 실제 크롬에서 확인`으로 따로 커밋)
