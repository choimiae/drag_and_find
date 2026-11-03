# 출처 한 줄 표시와 뜻 목록 돌아가기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설명 카드의 출처 링크를 작은 한 줄로 묶고, 뜻 상세에서 원래 목록으로 서버 재조회 없이 돌아간다.

**Architecture:** 카드 렌더러가 출처 링크를 한 영역에 표시하고, 상세 상태에서는 헤더에 돌아가기 버튼과 본문 제목을 표시한다. 컨트롤러는 최초 뜻 목록의 데이터와 두 스크롤 위치를 저장하고, 오버레이의 좁은 스크롤 API로 복원한다.

**Tech Stack:** TypeScript, WXT, Vitest, Playwright.

## Global Constraints

- 기존 원문 URL, 새 탭 열기, 출처·라이선스 표기를 유지한다.
- 카드 폭 320px에서 출처 링크를 잘라 숨기지 않고 줄바꿈한다.
- 뒤로 가기는 API를 재호출하지 않는다.
- 상세 조회가 진행 중이어도 돌아갈 수 있고, 늦은 응답이 목록을 덮지 않는다.
- 커밋 메시지는 한국어로 작성한다.

---

### Task 1: 한 줄 출처 영역

**Files:**
- Modify: `lib/ui/card.ts`
- Modify: `lib/ui/styles.ts`
- Test: `tests/unit/ui/card.test.ts`
- Test: `e2e/lookup.spec.ts`

**Interfaces:**
- Consumes: 기존 `FoundResult`, `sourceLink()`, `alternativeLinks()`, `attribution()`.
- Produces: `data-role="source-links"`인 영역. 원문 링크의 기존 `data-role`은 유지한다.

- [ ] **Step 1: 실패 테스트 작성.** 네이버 주 출처와 위키백과 대안이 함께 있는 결과를 렌더링해 영역 안의 링크 두 개, 순서, URL, 짧은 텍스트를 검사한다. 단일 위키백과 결과에는 링크 하나만 검사한다.

```ts
renderCard(card, '인공지능', { kind: 'result', result: naverWithWikipedia }, handlers);
const links = card.querySelectorAll('[data-role="source-links"] a');
expect([...links].map((link) => link.textContent)).toEqual(['네이버 백과 ↗', '위키백과 ↗']);
expect([...links].map((link) => link.getAttribute('href'))).toEqual([
  'https://terms.naver.com/entry.naver?docId=1',
  'https://ko.wikipedia.org/wiki/인공지능',
]);
```

- [ ] **Step 2: 실패 확인.** `pnpm exec vitest run tests/unit/ui/card.test.ts`에서 새 출처 영역 기대가 실패해야 한다.
- [ ] **Step 3: 최소 구현.** `sourceLink()`와 `alternativeLinks()`를 한 `sourceLinksRow()`의 자식으로 모으고 링크 라벨을 출처 이름과 `↗`로 줄인다. 다의어 결과의 고정 출처 영역에도 같은 함수를 사용한다. CSS는 얇은 윗선, `display:flex`, `flex-wrap:wrap`, 작은 링크와 구분선으로 구성한다.

```ts
const row = element(doc, 'div', { className: 'card-source-links', role: 'source-links' });
row.append(element(doc, 'span', { className: 'card-source-label', text: '원문' }), sourceLink(doc, result));
for (const link of alternativeLinks(doc, result)) row.append(link);
```

- [ ] **Step 4: 테스트 확인.** `pnpm exec vitest run tests/unit/ui/card.test.ts`, `pnpm compile`, `pnpm lint`를 실행한다. 기존 텍스트 기대는 새 짧은 라벨로 바꾼다.
- [ ] **Step 5: 커밋.** `git add lib/ui/card.ts lib/ui/styles.ts tests/unit/ui/card.test.ts e2e/lookup.spec.ts` 후 `git commit -m '개선: 출처 원문 링크를 한 줄로 정리'`.

### Task 2: 뜻 목록으로 돌아가기

**Files:**
- Modify: `lib/ui/card.ts`
- Modify: `lib/ui/styles.ts`
- Modify: `lib/ui/overlay.ts`
- Modify: `lib/content/controller.ts`
- Test: `tests/unit/ui/card.test.ts`
- Test: `tests/unit/ui/overlay.test.ts`
- Test: `tests/unit/content/controller.test.ts`
- Test: `e2e/lookup.spec.ts`

**Interfaces:**
- `CardHandlers.onBackToMeanings?: () => void`가 있으면 상세 상태다.
- `Overlay.readCardScroll(): { body: number; meanings: number }`는 현재 스크롤 위치를 읽는다.
- `Overlay.restoreCardScroll(scroll: { body: number; meanings: number }): void`는 목록 재렌더링 뒤 위치를 복원한다.

- [ ] **Step 1: 실패 테스트 작성.** 카드 테스트는 상세 헤더의 `← 뜻 목록` 클릭이 `onBackToMeanings`를 실행하고 본문에 제목이 보이는지 검사한다. 오버레이 테스트는 본문·뜻 목록의 스크롤을 읽고 다시 그린 뒤 복원한다. 컨트롤러 테스트는 뜻 항목 클릭 → 상세 결과 → 돌아가기에서 원래 결과와 검색어를 복원하고 요청 횟수가 늘지 않는지 검사한다.

```ts
const originalMeanings: LookupResult = {
  status: 'found', source: 'wikipedia', title: '트리거', extract: '',
  url: 'https://ko.wikipedia.org/wiki/트리거', isDisambiguation: true,
  disambiguation: { basic: [], meanings: [{ label: '데이터베이스 트리거', title: '데이터베이스 트리거' }], candidates: [] },
};
const handlers = overlay.showCard.mock.calls.at(-1)![3];
handlers.onSelectMeaning('데이터베이스 트리거');
await settle();
overlay.showCard.mock.calls.at(-1)![3].onBackToMeanings?.();
expect(lastCardState(overlay)).toEqual({ kind: 'result', result: originalMeanings });
expect(requestLookup).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: 실패 확인.** `pnpm exec vitest run tests/unit/ui/card.test.ts tests/unit/ui/overlay.test.ts tests/unit/content/controller.test.ts`에서 새 동작 기대가 실패해야 한다.
- [ ] **Step 3: 최소 구현.** 컨트롤러는 첫 뜻 목록의 `query`, `result`, `context`, `anchor`, 스크롤을 저장한다. 뜻 상세 조회에서는 이 상태를 보존하고, 뒤로 가기에서 `latestRequestId`를 증가시킨 뒤 저장 결과를 다시 그려 스크롤을 복원한다. 새 선택·닫기·너무 긴 선택에서 상태를 지운다. 카드 렌더러는 상세 헤더에 버튼을 놓고 상세 제목을 본문 맨 위에 표시한다.

```ts
function backToMeanings(): void {
  if (!meaningRoot) return;
  latestRequestId += 1;
  const root = meaningRoot;
  meaningRoot = null;
  showCard(root.anchor, root.query, { kind: 'result', result: root.result }, root.context);
  overlay.restoreCardScroll(root.scroll);
}
```

- [ ] **Step 4: 경계 테스트.** 상세 요청이 끝나기 전에 뒤로 가기, 상세 오류 후 뒤로 가기, 새 단어 선택 후 이전 목록 버튼 없음, 뜻 목록 내부 스크롤 복원을 각각 검증한다.
- [ ] **Step 5: E2E.** `e2e/lookup.spec.ts`에서 뜻 목록 항목 클릭 후 헤더 버튼이 보이고, 누르면 처음 뜻 목록이 다시 나타나는지 확인한다.
- [ ] **Step 6: 검증과 커밋.** `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, 배포 빌드를 실행한다. 변경 파일을 `git add`하고 `git commit -m '기능: 뜻 상세에서 원래 뜻 목록으로 돌아가기'`.
