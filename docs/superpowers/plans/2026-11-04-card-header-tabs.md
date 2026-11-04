# 카드 헤더 탭과 직접 찾기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 현재 세션은 사용자 승인에 따라 격리 worktree에서 직접 실행한다. 저장소 지침에 따라 요청 전에는 커밋하지 않는다.

**Goal:** 뜻 설명을 기본 화면으로 유지하는 헤더 탭과 카드 안 직접 조회를 구현하고 Enter 검색 사이트 설정을 제거한다.

**Architecture:** `lib/ui/card.ts`는 결과 화면과 직접 찾기 화면의 탭·입력·외부 링크 상태를 관리하고, `lib/content/controller.ts`가 직접 입력을 기존 조회 흐름에 연결한다. 저장 설정은 아이콘 표시와 테마만 남긴다.

**Tech Stack:** TypeScript, WXT, Vitest, Playwright, pnpm 12, Node 22.

## Global Constraints

- 설계 기준: `docs/superpowers/specs/2026-11-04-card-header-tabs-design.md`.
- 카드 폭은 320px이다. 설명·뜻 목록·출처가 검색보다 우선한다.
- 직접 입력은 앞뒤 공백을 제거한 1~50자만 카드 조회에 사용한다. 구글·네이버 링크 길이는 제한하지 않는다.
- Enter는 직접 찾기 입력칸에서만 카드 조회를 실행한다. 한글 조합 중 Enter는 조회하지 않는다.
- 직접 조회에는 주변 문맥을 보내지 않는다. 마지막 요청의 결과만 표시한다.
- 사용자 문구와 문서는 한국어로 쓴다. 기존 사용자 파일은 보존하고 커밋·푸시는 하지 않는다.

---

### Task 1: 카드 탭과 검색 화면

**Files:** Modify `lib/ui/card.ts`, `lib/ui/styles.ts`, `tests/unit/ui/card.test.ts`.

**Interfaces:** `CardHandlers.onLookup(query: string): void`를 추가한다. 카드의 `data-role`은 `result-panel`, `manual-panel`, `result-tab`, `manual-tab`, `search-input`, `lookup-action`을 사용한다. `renderCard(card, query, state, handlers)`는 기존 시그니처를 유지한다.

- [x] **Step 1: 실패 테스트 작성.** `tests/unit/ui/card.test.ts`에 다음 행동을 추가한다. 기존 Enter가 외부 링크를 클릭한다는 테스트는 새 계약으로 바꾼다.

```ts
it('뜻 보기가 기본이고 탭을 오가도 뜻 목록과 입력 상태를 유지한다', () => {
  renderCard(card, '엔진', disambiguation(), handlers);
  const meanings = part('meanings')!;
  meanings.scrollTop = 80;
  part('manual-tab')!.click();
  const input = part('search-input') as HTMLInputElement;
  input.value = '검색 엔진';
  input.setSelectionRange(2, 2);
  part('result-tab')!.click();
  part('manual-tab')!.click();
  expect(part('result-panel')?.hidden).toBe(true);
  expect(input.value).toBe('검색 엔진');
  expect(input.selectionStart).toBe(2);
  expect(meanings.scrollTop).toBe(80);
});
```

```ts
it('Enter는 외부 링크 대신 카드 조회를 실행한다', () => {
  const onLookup = vi.fn();
  renderCard(card, '온보딩', { kind: 'loading' }, { ...handlers, onLookup });
  part('manual-tab')!.click();
  const input = part('search-input') as HTMLInputElement;
  input.value = '  데이터베이스  ';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(onLookup).toHaveBeenCalledWith('데이터베이스');
  expect(part('result-panel')?.hidden).toBe(false);
});
```

  같은 파일에서 버튼도 동일한 조회를 호출하는지, 한글 조합 중·빈 입력·51자 입력에서 호출하지 않는지, 입력 오류가 보이는지, 구글·네이버 URL이 입력 변경을 따라가는지 각각 검증한다.

- [x] **Step 2: 실패 확인.** `pnpm exec vitest run tests/unit/ui/card.test.ts`를 실행한다. 새 `data-role` 요소가 없고 Enter가 기존 사이트를 열기 때문에 실패해야 한다.
- [x] **Step 3: 최소 구현.** `CardHandlers`에 `onLookup`을 추가한다. 헤더 다음에 두 탭을 배치하고 결과 `body`와 `source`를 `result-panel` 안에 둔다. `manual-panel`은 입력·카드 조회 버튼·두 외부 링크를 담는다. `activateView(card, view)`는 두 패널의 `hidden`과 두 탭의 `aria-selected`를 함께 바꾼다.

```ts
const submit = () => {
  const value = input.value.trim();
  const length = Array.from(value).length;
  if (length < 1 || length > 50) {
    error.textContent = length < 1 ? '검색어를 입력해 주세요.' : '50자 이하로 입력해 주세요.';
    return;
  }
  activateView(card, 'result');
  handlers.onLookup(value);
};
input.addEventListener('keydown', (event) => {
  event.stopPropagation();
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return;
  event.preventDefault();
  submit();
});
```

  같은 검색어의 결과 갱신에서는 `manual-panel` 입력 DOM을 재사용해 값·커서·조합 상태를 보존한다. 새 검색어는 새 패널과 결과 기본 탭으로 시작한다. `[hidden]` 패널은 CSS에서 실제로 표시되지 않게 한다.

- [x] **Step 4: 통과 확인.** `pnpm exec vitest run tests/unit/ui/card.test.ts`가 통과해야 한다.

### Task 2: 기존 조회 흐름에 직접 입력 연결

**Files:** Modify `lib/content/controller.ts`, `entrypoints/content.ts`, `tests/unit/content/controller.test.ts`.

**Interfaces:** `ControllerDeps.getSearchEngine`을 제거한다. `showCard`가 `CardHandlers.onLookup`을 제공한다.

- [x] **Step 1: 실패 테스트 작성.** 콘텐츠 컨트롤러 테스트에 다음을 추가한다.

```ts
it('직접 입력은 웹페이지 문맥 없이 새 단어를 조회한다', async () => {
  const { overlay, requestLookup, controller } = setup();
  selectContentsOf('term');
  controller.handleShortcut();
  await settle();
  overlay.showCard.mock.calls.at(-1)?.[3].onLookup('데이터베이스');
  await settle();
  expect(requestLookup).toHaveBeenLastCalledWith('데이터베이스', undefined);
});
```

  기존 뜻 상세에서 직접 조회 시 이전 목록으로 돌아가기 상태가 사라지는지와 빠른 연속 입력에서 오래된 응답이 무시되는지도 테스트한다.

- [x] **Step 2: 실패 확인.** `pnpm exec vitest run tests/unit/content/controller.test.ts`에서 `onLookup` 부재로 실패하는지 확인한다.
- [x] **Step 3: 최소 구현.** `showCard`의 핸들러에 `onLookup: (word) => void lookUp(word, anchor)`를 추가한다. 이 호출은 주변 문맥과 상세 조회 표시를 전달하지 않는다. `entrypoints/content.ts`에서 검색 사이트 설정 변수와 전달 함수를 제거한다.
- [x] **Step 4: 통과 확인.** `pnpm exec vitest run tests/unit/content/controller.test.ts`를 실행한다.

### Task 3: Enter 검색 사이트 설정 제거

**Files:** Modify `lib/settings.ts`, `lib/options-page.ts`, `lib/content/settings-watch.ts`, `entrypoints/content.ts`, `entrypoints/options/index.html`, `tests/unit/settings.test.ts`, `tests/unit/options-page.test.ts`, `tests/unit/content/settings-watch.test.ts`, `e2e/lookup.spec.ts`의 옵션 검증 부분.

**Interfaces:** `Settings = { showIcon: boolean; theme: ThemeSetting }`. `parseSettings`는 오래된 `searchEngine` 값을 읽지 않는다.

- [x] **Step 1: 실패 테스트 작성.** 설정 테스트에 이전 저장 값이 무시되는 행동을 추가하고 옵션 페이지 테스트에서 검색 사이트 필드가 없는 화면에서도 초기화·저장이 되는지 확인한다.

```ts
expect(parseSettings({ showIcon: false, theme: 'dark', searchEngine: 'google' })).toEqual({
  showIcon: false,
  theme: 'dark',
});
```

- [x] **Step 2: 실패 확인.** `pnpm exec vitest run tests/unit/settings.test.ts tests/unit/options-page.test.ts tests/unit/content/settings-watch.test.ts`를 실행한다.
- [x] **Step 3: 최소 구현.** `Settings`, `DEFAULT_SETTINGS`, `parseSettings`에서 `searchEngine`을 제거한다. 옵션 페이지의 fieldset과 이벤트 연결을 삭제한다. 기존 테스트의 `Settings` 객체와 E2E 옵션 검증은 새 화면에 맞게 바꾼다. 설정 변경 감시에는 테마와 아이콘만 남긴다.
- [x] **Step 4: 통과 확인.** 같은 단위 테스트 세 파일을 실행한다.

### Task 4: 브라우저 동작·문서·이미지

**Files:** Modify `e2e/lookup.spec.ts`, `README.md`, `PRIVACY.md`, `docs/store/listing.md`; regenerate store images using `pnpm store:images` and inspect changed image files.

**Interfaces:** E2E는 확장 카드의 `data-role` 탭·입력·링크를 사용한다. 실제 Worker 대신 기존 가짜 응답을 쓴다.

- [x] **Step 1: 브라우저 시나리오 갱신.** 선택 → 카드의 `뜻 보기` 확인 → `직접 찾기` 클릭 → 입력 수정 → Enter → 새 단어의 카드 결과를 확인한다. 구글·네이버 링크 클릭 시 각각 입력한 값으로 새 탭이 열리는 기존 검증을 직접 찾기 탭 안으로 옮긴다.
- [x] **Step 2: 브라우저 확인.** `pnpm test:e2e`를 실행해 실제 Chromium 확장에서 새 흐름이 동작하는지 확인한다.
- [x] **Step 3: 문서와 이미지 갱신.** README·개인정보 안내·스토어 설명에 Enter는 카드 조회이고 외부 검색은 명시적 클릭일 때만 동작한다고 적는다. 옵션 설명에서 Enter 사이트 선택을 뺀다. `pnpm store:images`로 스크린샷을 만들고 README 이미지 및 스토어 이미지를 확인한다.
- [x] **Step 4: 전체 검증.** `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, `git diff --check`를 실행하고 결과를 기록한다. 문서·이미지와 실제 카드 동작이 같은지 확인한다.
