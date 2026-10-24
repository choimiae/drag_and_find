# 시각 디자인 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드·드래그 아이콘·설정 화면·툴바 아이콘을 확정한 디자인(C 디자인 + B 구성, 그라데이션 아이콘)으로 바꾸고, 설정에서 카드 테마(크롬 설정 따라가기/밝게/어둡게)를 고를 수 있게 한다.

**Architecture:** 설정 데이터에 `theme`을 더한다. 오버레이 호스트의 `data-theme` 속성으로 Shadow DOM 안 CSS 변수 세트(밝게/어둡게)를 바꾸고, `auto`일 때만 `prefers-color-scheme`을 따른다. 페이지 쪽은 시작할 때와 저장소가 바뀔 때 테마를 다시 적용한다. 카드 구조는 기존 `data-role`을 유지한 채 배지·제안 상자·G/N 표시만 더하고 나머지는 CSS로 바꾼다. 확장 아이콘은 SVG 원본에서 Playwright로 PNG를 찍어 커밋한다.

**Tech Stack:** 기존과 같음 — TypeScript ~5.9, WXT 0.21.4, Vitest 5 + happy-dom, Playwright 1.64.

**Spec:** `docs/superpowers/specs/2026-10-24-visual-design-design.md`

## Global Constraints

- 기존 제약을 모두 지킨다: WXT 자동 import 꺼짐, 권한 추가 금지, 외부 글자는 `textContent`만, `innerHTML` 금지(SVG도 `createElementNS`), 외부 데이터 검증
- tsconfig에 `noUncheckedIndexedAccess`가 켜져 있다
- 테마 값: `'auto' | 'light' | 'dark'`, 기본 `'auto'`. 잘못된 값은 `'auto'`
- 색 값은 설계 문서 §4 표 그대로 (아래 Task 2 코드에 옮겨 둠)
- 문구(정확히 이대로): `뜻 여러 개`, `이 글에서는 아마`, `카드 테마`, `크롬 설정 따라가기`, `밝게`, `어둡게`, `크롬 설정의 "모양 → 모드"를 따릅니다.`, `드래그하면 아이콘 보여 주기`, `끄면 단축키로만 찾을 수 있습니다.`, `단축키`, `단축키 바꾸기`, 검색 버튼 `구글 검색`·`네이버 검색`과 표시 `G`·`N`
- 기존 `data-role` 이름은 모두 유지한다. 새 역할: `badge`, `suggestion-box`
- 커밋 메시지 꼬리말은 실제로 커밋한 모델 이름. 커밋 후 `git log --oneline -1`로 실제 반영을 확인한다
- 사용자에게 보이는 보고·문서는 한국어

## Review Focus

- 예전 버전이 저장한 설정(`{ showIcon }`만 있음)을 읽어도 오류 없이 테마가 `auto`가 돼야 한다 → Task 1
- 설정 화면에서 테마를 바꾸면 **이미 열린 탭**의 카드도 새로고침 없이 바뀌어야 한다 → Task 3 단위, Task 6 E2E
- 확장이 업데이트돼 연결이 끊긴 탭에서 테마를 읽지 못해도 오류 없이 기본값으로 동작해야 한다 → Task 3
- 테마 저장이 실패하면 설정 화면이 저장되지 않은 값을 보여 주면 안 된다 → Task 4
- 검색 버튼에 G/N 글자를 붙여도 화면 낭독기는 "구글 검색"으로 읽어야 한다(aria-label) → Task 2

---

## 파일 구조

```
lib/settings.ts                 (수정) ThemeSetting, theme 필드, isThemeSetting
lib/ui/styles.ts                (교체) 색 세트·카드·아이콘 CSS
lib/ui/card.ts                  (수정) 배지, 제안 상자, G/N 표시
lib/ui/overlay.ts               (수정) setTheme, SVG 돋보기 아이콘
lib/content/theme.ts            (신규) watchTheme
entrypoints/content.ts          (수정) 테마 연결
entrypoints/options/index.html  (교체) 설정 화면 디자인
lib/options-page.ts             (수정) 테마 라디오, 저장 공통화
assets/icon.svg                 (신규) 확장 아이콘 원본
scripts/render-icons.mjs        (신규) SVG → PNG
public/icon/*.png               (교체) 16/32/48/96/128
package.json                    (수정) "icons" 스크립트
CLAUDE.md                       (수정) 아이콘 명령 한 줄
tests/unit/...                  각 테스트
e2e/lookup.spec.ts              (수정) 테마 E2E
```

---

### Task 1: 설정에 테마 추가

**Files:**
- Modify: `lib/settings.ts`
- Test: `tests/unit/settings.test.ts`, 그리고 `Settings` 리터럴을 쓰는 기존 테스트(`tests/unit/options-page.test.ts`)

**Interfaces:**
- Produces: `type ThemeSetting = 'auto' | 'light' | 'dark'`, `THEME_SETTINGS`, `isThemeSetting(value: unknown): value is ThemeSetting`, `Settings { showIcon: boolean; theme: ThemeSetting }`, `DEFAULT_SETTINGS = { showIcon: true, theme: 'auto' }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/settings.test.ts`:
- 기존 `saveSettings(area, { showIcon: false })` → `saveSettings(area, { showIcon: false, theme: 'dark' })`, 기대값도 `{ showIcon: false, theme: 'dark' }`
- 기존 "uses defaults" 테스트에 `expect(DEFAULT_SETTINGS.theme).toBe('auto');` 추가
- 추가:
```ts
describe('theme', () => {
  it.each(['auto', 'light', 'dark'] as const)('keeps %s', (theme) => {
    expect(parseSettings({ showIcon: true, theme }).theme).toBe(theme);
  });

  it.each(['system', 3, null, undefined])('falls back to auto for %j', (theme) => {
    expect(parseSettings({ showIcon: false, theme })).toEqual({ showIcon: false, theme: 'auto' });
  });

  it('reads settings saved before themes existed', () => {
    expect(parseSettings({ showIcon: false })).toEqual({ showIcon: false, theme: 'auto' });
  });
});

describe('isThemeSetting', () => {
  it('accepts only the three themes', () => {
    expect(isThemeSetting('dark')).toBe(true);
    expect(isThemeSetting('Dark')).toBe(false);
    expect(isThemeSetting(undefined)).toBe(false);
  });
});
```
(import에 `isThemeSetting` 추가)

`tests/unit/options-page.test.ts`: `saveSettings(area, { showIcon: false })` → `saveSettings(area, { showIcon: false, theme: 'auto' })`, `toEqual({ showIcon: false })` → `toEqual({ showIcon: false, theme: 'auto' })`, `toEqual({ showIcon: true })`가 있으면 같은 방식으로 바꾼다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/settings.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/settings.ts`:
```ts
import type { KeyValueArea } from './storage';

export const SETTINGS_KEY = 'settings';

export type ThemeSetting = 'auto' | 'light' | 'dark';
export const THEME_SETTINGS: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

export interface Settings {
  showIcon: boolean;
  theme: ThemeSetting;
}

export const DEFAULT_SETTINGS: Settings = { showIcon: true, theme: 'auto' };

/** 카드 테마로 쓸 수 있는 값인지 확인한다. */
export function isThemeSetting(value: unknown): value is ThemeSetting {
  return THEME_SETTINGS.includes(value as ThemeSetting);
}

/** 저장된 값을 검증해 설정으로 바꾼다. 형식이 틀리거나 없는 항목은 기본값을 쓴다. */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_SETTINGS;
  const { showIcon, theme } = raw as Record<string, unknown>;
  return {
    showIcon: typeof showIcon === 'boolean' ? showIcon : DEFAULT_SETTINGS.showIcon,
    theme: isThemeSetting(theme) ? theme : DEFAULT_SETTINGS.theme,
  };
}
```
(`loadSettings`, `saveSettings`는 그대로)

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add lib/settings.ts tests/unit
git commit -m "feat: 설정에 카드 테마 항목 추가" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 2: 카드 디자인

**Files:**
- Modify: `lib/ui/card.ts`
- Replace: `lib/ui/styles.ts`
- Test: `tests/unit/ui/card.test.ts`

**Interfaces:**
- Consumes: 없음 (기존 `renderCard` 시그니처 유지)
- Produces: 배지 `data-role="badge"`, 제안 상자 `data-role="suggestion-box"`, 검색 링크 안 표시 `span.card-action-mark`, `OVERLAY_CSS`(테마 세트 포함)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/ui/card.test.ts`에 추가 (기존 `card`, `handlers`, `part`, `disambiguation()` 도우미 재사용):
```ts
describe('design details', () => {
  it('shows the "뜻 여러 개" badge only for disambiguation results', () => {
    renderCard(card, '트리거', disambiguation(), handlers);
    expect(part('badge')?.textContent).toBe('뜻 여러 개');

    renderCard(card, '온보딩', { kind: 'loading' }, handlers);
    expect(part('badge')).toBeNull();

    renderCard(
      card,
      'SaaS',
      {
        kind: 'result',
        result: {
          status: 'found',
          title: 'SaaS',
          extract: '설명',
          url: 'https://ko.wikipedia.org/wiki/x',
          isDisambiguation: false,
        },
      },
      handlers,
    );
    expect(part('badge')).toBeNull();
  });

  it('keeps the title text unchanged next to the badge', () => {
    renderCard(card, '트리거', disambiguation(), handlers);

    expect(part('title')?.textContent).toBe('트리거');
  });

  it('puts the suggestion inside its own box', () => {
    renderCard(card, '트리거', disambiguation({ suggestion: DATABASE }), handlers);

    const box = part('suggestion-box');
    expect(box?.textContent).toContain('이 글에서는 아마');
    expect(box?.querySelector('[data-role="suggestion"]')).not.toBeNull();
    expect(box?.querySelector('[data-role="suggestion-extract"]')).not.toBeNull();
  });

  it('marks search links with G and N but keeps readable names', () => {
    renderCard(card, '온보딩', { kind: 'loading' }, handlers);

    expect(part('google')?.querySelector('.card-action-mark')?.textContent).toBe('G');
    expect(part('naver')?.querySelector('.card-action-mark')?.textContent).toBe('N');
    expect(part('google')?.getAttribute('aria-label')).toBe('구글 검색');
    expect(part('naver')?.getAttribute('aria-label')).toBe('네이버 검색');
  });
});
```
(`DATABASE`와 `disambiguation()` 도우미가 `describe('disambiguation card')` 안에 있으면, 동작은 바꾸지 말고 파일 상단(모든 `describe` 밖)으로 옮겨 두 블록이 함께 쓰게 한다)

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/ui/card.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 카드 구조**

`lib/ui/card.ts`:
- `renderCard`의 헤더 줄을 다음으로 바꾼다:
```ts
  const header = buildHeader(doc, titleFor(query, state), isAmbiguous(state), handlers.onClose);
```
- `titleFor` 아래에 추가:
```ts
function isAmbiguous(state: CardState): boolean {
  return state.kind === 'result' && state.result.status === 'found' && state.result.isDisambiguation;
}
```
- `suggestionBlock`을 다음으로 바꾼다:
```ts
function suggestionBlock(
  doc: Document,
  suggestion: SenseCandidate,
  onSelect: (title: string) => void,
): Node[] {
  const box = element(doc, 'div', { className: 'card-suggestion', role: 'suggestion-box' });
  box.append(
    element(doc, 'p', { className: 'card-chip', text: '이 글에서는 아마' }),
    meaningButton(doc, suggestion.title, suggestion.title, 'suggestion', onSelect),
    element(doc, 'p', {
      className: 'card-suggestion-extract',
      role: 'suggestion-extract',
      text: suggestion.extract,
    }),
  );
  return [box];
}
```
- `buildHeader`를 다음으로 바꾼다:
```ts
function buildHeader(
  doc: Document,
  title: string,
  ambiguous: boolean,
  onClose: () => void,
): HTMLElement {
  const header = element(doc, 'header', { className: 'card-header' });
  const heading = element(doc, 'span', { className: 'card-heading' });
  heading.append(element(doc, 'strong', { className: 'card-title', role: 'title', text: title }));
  if (ambiguous) {
    heading.append(element(doc, 'span', { className: 'card-badge', role: 'badge', text: '뜻 여러 개' }));
  }
  const close = element(doc, 'button', { className: 'card-close', role: 'close', text: '✕' });
  close.setAttribute('type', 'button');
  close.setAttribute('aria-label', '닫기');
  close.addEventListener('click', onClose);
  header.append(heading, close);
  return header;
}
```
- `buildActions`를 다음으로 바꾸고 `actionLink`를 추가한다:
```ts
function buildActions(doc: Document, query: string): HTMLElement {
  const actions = element(doc, 'footer', { className: 'card-actions' });
  actions.append(
    actionLink(doc, googleSearchUrl(query), 'G', '구글 검색', 'google'),
    actionLink(doc, naverSearchUrl(query), 'N', '네이버 검색', 'naver'),
  );
  return actions;
}

function actionLink(
  doc: Document,
  href: string,
  mark: string,
  name: string,
  role: string,
): HTMLElement {
  const link = externalLink(doc, href, name, role, 'card-action');
  link.prepend(element(doc, 'span', { className: `card-action-mark card-action-mark-${role}`, text: mark }));
  // 표시 글자(G/N)가 이름 앞에 붙어 읽히지 않도록 이름을 따로 준다.
  link.setAttribute('aria-label', name);
  return link;
}
```

- [ ] **Step 4: 구현 — 스타일 교체**

`lib/ui/styles.ts` 전체:
```ts
/** 밝은 색 세트(기본). 설계 문서 §4의 표와 같은 값이다. */
const LIGHT_VARS = `
  --dnf-surface: #ffffff;
  --dnf-surface-alt: #fafbfc;
  --dnf-text: #1d2129;
  --dnf-text-soft: #3a4350;
  --dnf-muted: #5f6b7a;
  --dnf-border: #e3e6ea;
  --dnf-divider: #eef0f2;
  --dnf-accent: #1a73e8;
  --dnf-accent-soft: #f3f8ff;
  --dnf-accent-line: #d6e6fd;
  --dnf-tag-text: #1a5fc4;
  --dnf-badge: #f1f3f5;
  --dnf-button: #ffffff;
  --dnf-shadow: 0 8px 24px rgba(20, 30, 50, 0.12);
`;

/** 어두운 색 세트. 테마가 dark이거나, auto이면서 크롬이 어두운 모드일 때 쓴다. */
const DARK_VARS = `
  --dnf-surface: #1f242b;
  --dnf-surface-alt: #1b2026;
  --dnf-text: #e6eaef;
  --dnf-text-soft: #c3cad3;
  --dnf-muted: #9aa4b1;
  --dnf-border: #2f3640;
  --dnf-divider: #2a3038;
  --dnf-accent: #79aef5;
  --dnf-accent-soft: #1d2c42;
  --dnf-accent-line: #2d4a73;
  --dnf-tag-text: #9cc2f7;
  --dnf-badge: #2b323b;
  --dnf-button: #262c34;
  --dnf-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
`;

/** Shadow DOM 안에서만 적용되는 카드·아이콘 스타일. 테마는 호스트의 data-theme으로 고른다. */
export const OVERLAY_CSS = `
:host {
  ${LIGHT_VARS}
  --dnf-brand: linear-gradient(135deg, #03c75a, #1a73e8);
  --dnf-brand-bar: linear-gradient(90deg, #03c75a, #1a73e8);
  font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
}
:host([data-theme='dark']) {
  ${DARK_VARS}
}
@media (prefers-color-scheme: dark) {
  :host([data-theme='auto']) {
    ${DARK_VARS}
  }
}
.icon {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--dnf-brand);
  box-shadow: 0 3px 10px rgba(26, 115, 232, 0.35);
  cursor: pointer;
  transition: transform 120ms ease-out;
}
.icon:hover { transform: scale(1.08); }
.icon:focus-visible { outline: 2px solid var(--dnf-accent); outline-offset: 2px; }
.card {
  position: absolute;
  box-sizing: border-box;
  width: 320px;
  overflow: auto;
  border: 1px solid var(--dnf-border);
  border-radius: 12px;
  background: var(--dnf-surface);
  box-shadow: var(--dnf-shadow);
  color: var(--dnf-text);
  font-size: 13px;
  line-height: 1.6;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 15px 2px;
  background: var(--dnf-brand-bar) top / 100% 4px no-repeat;
}
.card-heading { display: flex; align-items: center; gap: 6px; min-width: 0; }
.card-title { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; overflow-wrap: anywhere; }
.card-badge {
  flex: none;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--dnf-badge);
  color: var(--dnf-muted);
  font-size: 10px;
  font-weight: 600;
}
.card-close {
  flex: none;
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--dnf-muted);
  cursor: pointer;
  font-size: 13px;
}
.card-close:hover, .card-close:focus-visible { color: var(--dnf-text); outline: none; background: var(--dnf-badge); }
.card-body { padding: 4px 15px 12px; }
.card-extract {
  margin: 4px 0 0;
  color: var(--dnf-text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-message { margin: 4px 0 0; color: var(--dnf-muted); }
.card-link {
  display: block;
  margin-top: 9px;
  color: var(--dnf-accent);
  font-size: 12px;
  text-align: right;
  text-decoration: none;
}
.card-link:hover, .card-link:focus-visible { text-decoration: underline; }
.card-retry {
  margin-left: 6px;
  padding: 3px 10px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 6px;
  background: var(--dnf-accent-soft);
  color: var(--dnf-accent);
  cursor: pointer;
  font: inherit;
}
.card-suggestion {
  margin: 6px 0 4px;
  padding: 9px 11px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 10px;
  background: var(--dnf-accent-soft);
}
.card-chip { margin: 0; color: var(--dnf-accent); font-size: 10.5px; font-weight: 700; }
.card-suggestion .card-meaning {
  display: block;
  padding: 0;
  border: 0;
  background: none;
  color: var(--dnf-text);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  text-align: left;
}
.card-suggestion .card-meaning:hover, .card-suggestion .card-meaning:focus-visible { color: var(--dnf-accent); }
.card-suggestion-extract {
  margin: 0;
  color: var(--dnf-text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-section-title { margin: 11px 0 5px; color: var(--dnf-muted); font-size: 11px; font-weight: 700; }
.card-basic { margin: 0 0 2px; color: var(--dnf-text-soft); }
.card-meanings { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.card-meanings .card-meaning {
  padding: 4px 10px;
  border: 1px solid var(--dnf-accent-line);
  border-radius: 999px;
  background: var(--dnf-accent-soft);
  color: var(--dnf-tag-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.card-meanings .card-meaning:hover, .card-meanings .card-meaning:focus-visible { border-color: var(--dnf-accent); outline: none; }
.card-meaning-text {
  display: inline-block;
  padding: 4px 10px;
  border: 1px dashed var(--dnf-border);
  border-radius: 999px;
  color: var(--dnf-muted);
  font-size: 12px;
}
.card-more { margin: 6px 0 0; color: var(--dnf-muted); font-size: 11.5px; }
.card-actions {
  display: flex;
  gap: 7px;
  padding: 10px 15px 12px;
  border-top: 1px solid var(--dnf-divider);
  background: var(--dnf-surface-alt);
}
.card-action {
  flex: 1;
  padding: 7px 0;
  border: 1px solid var(--dnf-border);
  border-radius: 8px;
  background: var(--dnf-button);
  color: var(--dnf-text);
  font-size: 12px;
  text-align: center;
  text-decoration: none;
}
.card-action:hover, .card-action:focus-visible { border-color: var(--dnf-accent); outline: none; }
.card-action-mark { margin-right: 4px; font-weight: 800; }
.card-action-mark-google { color: #1a73e8; }
.card-action-mark-naver { color: #03c75a; }
`;
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 전체 PASS (기존 카드·오버레이 테스트 포함)

- [ ] **Step 6: Commit**

```bash
git add lib/ui/card.ts lib/ui/styles.ts tests/unit/ui/card.test.ts
git commit -m "feat: 카드를 새 디자인으로 바꾸고 밝은·어두운 색 세트 추가" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 3: 테마 적용과 SVG 아이콘

**Files:**
- Modify: `lib/ui/overlay.ts`, `entrypoints/content.ts`
- Create: `lib/content/theme.ts`
- Test: `tests/unit/ui/overlay.test.ts`, `tests/unit/content/theme.test.ts`, `tests/unit/content/controller.test.ts`(가짜 오버레이 모양만)

**Interfaces:**
- Consumes: Task 1 `ThemeSetting`, `DEFAULT_SETTINGS`, `parseSettings`, `Settings`, `SETTINGS_KEY`; Task 2 `OVERLAY_CSS`
- Produces: `Overlay.setTheme(theme: ThemeSetting): void`; `watchTheme(deps: ThemeWatchDeps): Promise<void>` — `ThemeWatchDeps { loadSettings(): Promise<Settings>; onSettingsChanged(listener: (raw: unknown) => void): void; applyTheme(theme: ThemeSetting): void }`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/ui/overlay.test.ts`에 추가:
```ts
describe('theme and icon', () => {
  it('starts with the auto theme', () => {
    createOverlay(document, window).showIcon(ANCHOR, vi.fn());

    expect(host()?.dataset.theme).toBe('auto');
  });

  it('switches the theme on the host', () => {
    const overlay = createOverlay(document, window);
    overlay.showIcon(ANCHOR, vi.fn());

    overlay.setTheme('dark');

    expect(host()?.dataset.theme).toBe('dark');
  });

  it('draws the icon as an SVG instead of an emoji', () => {
    createOverlay(document, window).showIcon(ANCHOR, vi.fn());

    const icon = inShadow('icon');
    expect(icon?.querySelector('svg')).not.toBeNull();
    expect(icon?.textContent).toBe('');
    expect(icon?.getAttribute('aria-label')).toBe('선택한 단어 찾기');
  });
});
```

`tests/unit/content/theme.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { watchTheme, type ThemeWatchDeps } from '../../../lib/content/theme';

function deps(overrides: Partial<ThemeWatchDeps> = {}) {
  let listener: ((raw: unknown) => void) | undefined;
  const base = {
    loadSettings: vi.fn<ThemeWatchDeps['loadSettings']>(async () => ({ showIcon: true, theme: 'light' })),
    onSettingsChanged: vi.fn<ThemeWatchDeps['onSettingsChanged']>((l) => {
      listener = l;
    }),
    applyTheme: vi.fn<ThemeWatchDeps['applyTheme']>(),
    ...overrides,
  };
  return { ...base, change: (raw: unknown) => listener?.(raw) };
}

describe('watchTheme', () => {
  it('applies the saved theme at start', async () => {
    const d = deps();

    await watchTheme(d);

    expect(d.applyTheme).toHaveBeenCalledWith('light');
  });

  it('applies a changed theme right away', async () => {
    const d = deps();
    await watchTheme(d);

    d.change({ showIcon: true, theme: 'dark' });

    expect(d.applyTheme).toHaveBeenLastCalledWith('dark');
  });

  it('uses auto for a malformed change', async () => {
    const d = deps();
    await watchTheme(d);

    d.change('broken');

    expect(d.applyTheme).toHaveBeenLastCalledWith('auto');
  });

  it('keeps the default without throwing when settings cannot be read', async () => {
    const d = deps({
      loadSettings: async () => {
        throw new Error('Extension context invalidated.');
      },
    });

    await expect(watchTheme(d)).resolves.toBeUndefined();
    expect(d.applyTheme).not.toHaveBeenCalled();
  });
});
```

`tests/unit/content/controller.test.ts`: `fakeOverlay()`에 `setTheme: vi.fn<Overlay['setTheme']>(),` 한 줄을 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/ui/overlay.test.ts tests/unit/content`
Expected: FAIL

- [ ] **Step 3: 구현**

`lib/ui/overlay.ts`:
- import 추가: `import { DEFAULT_SETTINGS, type ThemeSetting } from '../settings';`
- 상수 추가: `const SVG_NS = 'http://www.w3.org/2000/svg';`
- `Overlay` 인터페이스에 `setTheme(theme: ThemeSetting): void;` 추가
- `Object.assign(host.style, …)` 바로 아래에 `host.dataset.theme = DEFAULT_SETTINGS.theme;`
- `showIcon`의 `button.textContent = '🔍';`를 `button.append(magnifierIcon(doc));`로 바꾼다
- 반환 객체에 추가:
```ts
    setTheme(theme) {
      host.dataset.theme = theme;
    },
```
- 파일 끝에 추가:
```ts
/** 흰 돋보기 선 아이콘. 이모지는 운영체제마다 모양이 달라 SVG로 그린다. */
function magnifierIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  setAttributes(svg, {
    width: '14',
    height: '14',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: '#ffffff',
    'stroke-width': '3',
    'stroke-linecap': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const lens = doc.createElementNS(SVG_NS, 'circle');
  setAttributes(lens, { cx: '10.5', cy: '10.5', r: '6.5' });
  const handle = doc.createElementNS(SVG_NS, 'path');
  setAttributes(handle, { d: 'M15.5 15.5 21 21' });
  svg.append(lens, handle);
  return svg;
}

function setAttributes(target: Element, attributes: Record<string, string>): void {
  for (const [name, value] of Object.entries(attributes)) target.setAttribute(name, value);
}
```

`lib/content/theme.ts`:
```ts
import { parseSettings, type Settings, type ThemeSetting } from '../settings';

export interface ThemeWatchDeps {
  loadSettings(): Promise<Settings>;
  onSettingsChanged(listener: (raw: unknown) => void): void;
  applyTheme(theme: ThemeSetting): void;
}

/** 저장된 카드 테마를 적용하고, 설정이 바뀌면 열려 있는 탭에도 바로 다시 적용한다. */
export async function watchTheme(deps: ThemeWatchDeps): Promise<void> {
  deps.onSettingsChanged((raw) => deps.applyTheme(parseSettings(raw).theme));
  try {
    deps.applyTheme((await deps.loadSettings()).theme);
  } catch {
    // 확장이 업데이트돼 연결이 끊긴 탭은 설정을 읽지 못한다. 기본 테마(auto)를 그대로 둔다.
  }
}
```

`entrypoints/content.ts`의 `main()`을 다음으로 바꾼다:
```ts
  main() {
    const overlay = createOverlay(document, window);
    const controller = createController({
      win: window,
      overlay,
      requestLookup: createLookupClient((message) => browser.runtime.sendMessage(message)),
      isIconEnabled: async () => (await loadSettings(browser.storage.local)).showIcon,
    });

    void watchTheme({
      loadSettings: () => loadSettings(browser.storage.local),
      onSettingsChanged: (listener) =>
        browser.storage.onChanged.addListener((changes, areaName) => {
          const change = changes[SETTINGS_KEY];
          if (areaName === 'local' && change) listener(change.newValue);
        }),
      applyTheme: (theme) => overlay.setTheme(theme),
    });

    document.addEventListener('mouseup', controller.handleMouseUp, true);
    document.addEventListener('mousedown', controller.handleMouseDown, true);
    document.addEventListener('keydown', controller.handleKeyDown, true);
    browser.runtime.onMessage.addListener((message) => {
      if (isTriggerRequest(message)) controller.handleShortcut();
    });
  },
```
(import에 `watchTheme`(`../lib/content/theme`), `SETTINGS_KEY` 추가)

- [ ] **Step 4: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build`
Expected: 전체 PASS

- [ ] **Step 5: Commit**

```bash
git add lib/ui/overlay.ts lib/content/theme.ts entrypoints/content.ts tests/unit
git commit -m "feat: 설정한 테마를 카드에 바로 반영하고 아이콘을 그림으로 교체" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 4: 설정 화면

**Files:**
- Replace: `entrypoints/options/index.html`
- Modify: `lib/options-page.ts`
- Test: `tests/unit/options-page.test.ts`

**Interfaces:**
- Consumes: Task 1 `isThemeSetting`, `Settings`
- Produces: 마크업 id `theme`(fieldset), 라디오 `name="theme"` 값 `auto|light|dark`(id `theme-auto|theme-light|theme-dark`), `show-icon`(`role="switch"`), `shortcut`, `change-shortcut`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/options-page.test.ts`:
- `MARKUP`을 다음으로 바꾼다:
```ts
const MARKUP = `
  <fieldset id="theme">
    <input type="radio" name="theme" value="auto" id="theme-auto" />
    <input type="radio" name="theme" value="light" id="theme-light" />
    <input type="radio" name="theme" value="dark" id="theme-dark" />
  </fieldset>
  <input id="show-icon" type="checkbox" role="switch" />
  <span id="shortcut"></span>
  <button id="change-shortcut" type="button"></button>`;
```
- 추가:
```ts
describe('theme', () => {
  const radio = (theme: string) => document.getElementById(`theme-${theme}`) as HTMLInputElement;
  const choose = (theme: string) => {
    radio(theme).checked = true;
    radio(theme).dispatchEvent(new Event('change'));
  };

  it('selects "follow Chrome" when nothing is stored', async () => {
    await initOptionsPage(document, deps());

    expect(radio('auto').checked).toBe(true);
  });

  it('shows the stored theme', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'dark' });

    await initOptionsPage(document, deps({ area }));

    expect(radio('dark').checked).toBe(true);
  });

  it('saves the chosen theme and keeps the icon setting', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: false, theme: 'auto' });
    await initOptionsPage(document, deps({ area }));

    choose('light');
    await flush();

    expect(await loadSettings(area)).toEqual({ showIcon: false, theme: 'light' });
  });

  it('puts the previous theme back when saving fails', async () => {
    const area = memoryArea();
    await saveSettings(area, { showIcon: true, theme: 'light' });
    const failing = { ...area, set: async () => Promise.reject(new Error('quota')) };
    await initOptionsPage(document, deps({ area: failing }));

    choose('dark');
    await flush();

    expect(radio('light').checked).toBe(true);
    expect(radio('dark').checked).toBe(false);
  });

  it('fails clearly when the theme choices are missing', async () => {
    document.getElementById('theme')?.remove();

    await expect(initOptionsPage(document, deps())).rejects.toThrow('#theme');
  });
});

it('exposes the icon toggle as a switch', async () => {
  await initOptionsPage(document, deps());

  expect(document.getElementById('show-icon')?.getAttribute('role')).toBe('switch');
});
```
(`memoryArea`의 반환값이 스프레드로 복사되지 않는 구조면, `get`은 원래 area의 것을 쓰고 `set`만 거부하는 객체를 직접 만든다. import에 `loadSettings` 없으면 추가)

- [ ] **Step 2: 실패 확인**

Run: `pnpm test tests/unit/options-page.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — 로직**

`lib/options-page.ts` 전체:
```ts
import { DEFAULT_SETTINGS, isThemeSetting, loadSettings, saveSettings, type Settings } from './settings';
import type { KeyValueArea } from './storage';

const NO_SHORTCUT_TEXT = '지정되지 않음';

export interface OptionsPageDeps {
  area: KeyValueArea;
  getShortcut(): Promise<string | undefined>;
  openShortcutSettings(): Promise<void>;
}

/** 설정 화면의 카드 테마, 아이콘 켜기·끄기, 단축키 안내를 연결한다. */
export async function initOptionsPage(doc: Document, deps: OptionsPageDeps): Promise<void> {
  const checkbox = requireElement<HTMLInputElement>(doc, '#show-icon');
  const themeGroup = requireElement<HTMLElement>(doc, '#theme');
  const themeInputs = Array.from(themeGroup.querySelectorAll<HTMLInputElement>('input[name="theme"]'));
  const shortcutLabel = requireElement<HTMLElement>(doc, '#shortcut');
  const shortcutButton = requireElement<HTMLButtonElement>(doc, '#change-shortcut');

  let settings: Settings = DEFAULT_SETTINGS;
  const render = () => {
    checkbox.checked = settings.showIcon;
    for (const input of themeInputs) input.checked = input.value === settings.theme;
  };
  const persist = (next: Settings) =>
    saveSettings(deps.area, next).then(
      () => {
        settings = next;
      },
      // 저장되지 않은 상태를 화면이 보여 주지 않도록 직전 값으로 되돌린다.
      () => render(),
    );

  render();
  // 불러오기가 늦거나 실패해도 조작은 되도록, 리스너는 await 전에 붙인다.
  checkbox.addEventListener('change', () => void persist({ ...settings, showIcon: checkbox.checked }));
  for (const input of themeInputs) {
    input.addEventListener('change', () => {
      if (input.checked && isThemeSetting(input.value)) void persist({ ...settings, theme: input.value });
    });
  }
  shortcutButton.addEventListener('click', () => void deps.openShortcutSettings());

  try {
    settings = await loadSettings(deps.area);
    render();
  } catch {
    // 읽기 실패 시 기본값을 그대로 쓴다.
  }

  try {
    shortcutLabel.textContent = (await deps.getShortcut()) || NO_SHORTCUT_TEXT;
  } catch {
    shortcutLabel.textContent = NO_SHORTCUT_TEXT;
  }
}

function requireElement<T extends Element>(doc: Document, selector: string): T {
  const found = doc.querySelector<T>(selector);
  if (!found) throw new Error(`설정 화면 요소가 없습니다: ${selector}`);
  return found;
}
```

- [ ] **Step 4: 구현 — 화면**

`entrypoints/options/index.html` 전체:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>Drag and Find 설정</title>
    <style>
      :root {
        color-scheme: light dark;
        --page: #f6f7f9;
        --surface: #ffffff;
        --text: #1d2129;
        --muted: #6b7480;
        --border: #e3e6ea;
        --divider: #f0f2f4;
        --accent: #1a73e8;
        --accent-soft: #f3f8ff;
        --accent-line: #d6e6fd;
        --segment: #f1f3f5;
        --segment-on: #ffffff;
        --key: #fafbfc;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --page: #16191d;
          --surface: #1f242b;
          --text: #e6eaef;
          --muted: #9aa4b1;
          --border: #2f3640;
          --divider: #2a3038;
          --accent: #79aef5;
          --accent-soft: #1d2c42;
          --accent-line: #2d4a73;
          --segment: #2b323b;
          --segment-on: #1f242b;
          --key: #262c34;
        }
      }
      body {
        margin: 0;
        padding: 16px;
        background: var(--page);
        color: var(--text);
        font: 13.5px/1.6 -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
      }
      main {
        max-width: 440px;
        margin: 0 auto;
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--surface) linear-gradient(90deg, #03c75a, #1a73e8) top / 100% 4px no-repeat;
      }
      header { display: flex; align-items: center; gap: 10px; padding: 18px 20px 8px; }
      .logo {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: linear-gradient(135deg, #03c75a, #1a73e8);
      }
      h1 { margin: 0; font-size: 16px; font-weight: 800; }
      section,
      fieldset { margin: 0; padding: 12px 20px; border: 0; border-top: 1px solid var(--divider); }
      legend,
      .label { display: block; margin: 0 0 6px; padding: 0; font-weight: 700; }
      .hint { display: block; margin: 6px 0 0; color: var(--muted); font-size: 12px; }
      .segmented {
        position: relative;
        display: inline-flex;
        gap: 2px;
        padding: 3px;
        border-radius: 9px;
        background: var(--segment);
      }
      .segmented input { position: absolute; opacity: 0; pointer-events: none; }
      .segmented label { padding: 6px 12px; border-radius: 7px; color: var(--muted); font-size: 12.5px; cursor: pointer; }
      .segmented input:checked + label {
        background: var(--segment-on);
        color: var(--accent);
        font-weight: 700;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
      .segmented input:focus-visible + label { outline: 2px solid var(--accent); outline-offset: 1px; }
      .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .switch-row .label { margin: 0; }
      .switch {
        position: relative;
        flex: none;
        width: 38px;
        height: 22px;
        margin: 0;
        border-radius: 999px;
        background: var(--border);
        cursor: pointer;
        appearance: none;
        transition: background-color 150ms;
      }
      .switch::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #ffffff;
        transition: transform 150ms;
      }
      .switch:checked { background: var(--accent); }
      .switch:checked::after { transform: translateX(16px); }
      .switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      kbd {
        display: inline-block;
        padding: 2px 8px;
        border: 1px solid var(--border);
        border-bottom-width: 2px;
        border-radius: 6px;
        background: var(--key);
        font: 600 12.5px ui-monospace, Menlo, monospace;
      }
      button {
        margin-left: 8px;
        padding: 5px 12px;
        border: 1px solid var(--accent-line);
        border-radius: 8px;
        background: var(--accent-soft);
        color: var(--accent);
        font: inherit;
        font-size: 12.5px;
        cursor: pointer;
      }
      button:hover,
      button:focus-visible { border-color: var(--accent); }
    </style>
  </head>
  <body>
    <main>
      <header>
        <span class="logo" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
          </svg>
        </span>
        <h1>Drag and Find 설정</h1>
      </header>
      <fieldset id="theme">
        <legend>카드 테마</legend>
        <div class="segmented">
          <input type="radio" name="theme" value="auto" id="theme-auto" />
          <label for="theme-auto">크롬 설정 따라가기</label>
          <input type="radio" name="theme" value="light" id="theme-light" />
          <label for="theme-light">밝게</label>
          <input type="radio" name="theme" value="dark" id="theme-dark" />
          <label for="theme-dark">어둡게</label>
        </div>
        <span class="hint">크롬 설정의 "모양 → 모드"를 따릅니다.</span>
      </fieldset>
      <section>
        <div class="switch-row">
          <label for="show-icon">
            <span class="label">드래그하면 아이콘 보여 주기</span>
            <span class="hint">끄면 단축키로만 찾을 수 있습니다.</span>
          </label>
          <input id="show-icon" class="switch" type="checkbox" role="switch" />
        </div>
      </section>
      <section>
        <span class="label">단축키</span>
        <kbd id="shortcut"></kbd><button id="change-shortcut" type="button">단축키 바꾸기</button>
      </section>
    </main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 통과 확인**

Run: `pnpm test && pnpm compile && pnpm lint && pnpm format && pnpm build && pnpm test:e2e`
Expected: 전체 PASS (기존 E2E의 설정 화면 테스트 — `#shortcut` 텍스트, `#show-icon` uncheck — 도 통과)

- [ ] **Step 6: Commit**

```bash
git add lib/options-page.ts entrypoints/options/index.html tests/unit/options-page.test.ts
git commit -m "feat: 설정 화면 새 디자인과 카드 테마 선택 추가" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 5: 확장 아이콘

**Files:**
- Create: `assets/icon.svg`, `scripts/render-icons.mjs`
- Replace: `public/icon/16.png`, `32.png`, `48.png`, `96.png`, `128.png`
- Modify: `package.json`, `CLAUDE.md`

**Interfaces:**
- Produces: `pnpm icons`

- [ ] **Step 1: 원본 SVG**

`assets/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#03c75a" />
      <stop offset="1" stop-color="#1a73e8" />
    </linearGradient>
  </defs>
  <circle cx="64" cy="64" r="64" fill="url(#brand)" />
  <g transform="translate(31 31) scale(2.75)" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </g>
</svg>
```

- [ ] **Step 2: 변환 스크립트**

`scripts/render-icons.mjs`:
```js
// 확장 아이콘 원본(assets/icon.svg)을 public/icon/<크기>.png로 찍는다.
// 아이콘을 바꿀 때만 돌린다: pnpm icons
import { readFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 96, 128];
// 작은 크기에서는 돋보기 선이 뭉개지지 않도록 더 굵게 그린다.
const STROKE_BY_SIZE = { 16: '3.6', 32: '3.1' };
const DEFAULT_STROKE = '2.6';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('assets/icon.svg', root), 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of SIZES) {
    const svg = source
      .replace('stroke-width="2.6"', `stroke-width="${STROKE_BY_SIZE[size] ?? DEFAULT_STROKE}"`)
      .replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.screenshot({
      path: fileURLToPath(new URL(`public/icon/${size}.png`, root)),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
```

`package.json`의 `scripts`에 `"icons": "node scripts/render-icons.mjs"`를 추가한다.

- [ ] **Step 3: 생성과 확인**

Run: `pnpm icons && file public/icon/*.png`
Expected: 다섯 파일 모두 `PNG image data, N x N, 8-bit/color RGBA` (N = 16, 32, 48, 96, 128)

Run: `pnpm lint && pnpm format && pnpm build`
Expected: 통과, `.output/chrome-mv3/icon/`에 새 PNG

- [ ] **Step 4: CLAUDE.md**

`CLAUDE.md`의 `## 빌드/검증 명령` 표에서 `| 웹스토어 업로드용 zip | \`pnpm zip\` |` 줄 아래에 추가:
```markdown
| 확장 아이콘 PNG 다시 만들기 (`assets/icon.svg` 수정 후) | `pnpm icons` |
```

- [ ] **Step 5: Commit**

```bash
git add assets scripts public/icon package.json CLAUDE.md
git commit -m "feat: 확장 아이콘을 새 디자인으로 교체" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

### Task 6: 테마 E2E와 마무리 확인

**Files:**
- Modify: `e2e/lookup.spec.ts`

**Interfaces:**
- Consumes: 설정 화면 id(`theme-dark` 라벨), 호스트 `drag-and-find-root`의 `data-theme`

- [ ] **Step 1: 테스트 추가**

`e2e/lookup.spec.ts`:
```ts
test('기본 테마는 크롬 설정 따라가기다', async ({ page }) => {
  await page.goto(ARTICLE_URL);
  await page.locator('#known').dblclick();
  await expect(role(page, 'icon')).toBeVisible();

  await expect(page.locator('drag-and-find-root')).toHaveAttribute('data-theme', 'auto');
});

test('설정에서 어둡게를 고르면 이미 열린 탭의 카드도 바로 어두워진다', async ({
  page,
  context,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(ARTICLE_URL);
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  await options.locator('label[for="theme-dark"]').click();
  await expect
    .poll(() =>
      serviceWorker.evaluate(
        `chrome.storage.local.get('settings').then((stored) => stored.settings?.theme)`,
      ),
    )
    .toBe('dark');

  await page.bringToFront();
  await page.locator('#known').dblclick();
  await expect(role(page, 'icon')).toBeVisible();
  await expect(page.locator('drag-and-find-root')).toHaveAttribute('data-theme', 'dark');
});
```

- [ ] **Step 2: 실행**

Run: `pnpm test:e2e`
Expected: 11 passed (기존 9 + 2). 실패하면 원인을 찾고, 제품 버그면 제품 코드를 고치지 말고 근거와 함께 DONE_WITH_CONCERNS로 보고한다.

- [ ] **Step 3: 전체 검증**

Run: `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`
Expected: 모두 통과

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test: 카드 테마가 열린 탭에 바로 반영되는지 확인" -m "Co-Authored-By: Claude <모델> <noreply@anthropic.com>"
git log --oneline -1
```

---

## 수동 확인 (사용자)

- [ ] 밝은/어두운 크롬 모드 × 밝은/어두운 블로그에서 카드·아이콘이 잘 보이는지
- [ ] 설정 화면에서 테마를 바꾸면 열려 있는 탭의 카드가 바로 바뀌는지
- [ ] 툴바 아이콘이 16px에서도 알아볼 수 있는지
- [ ] 키보드(Tab)로 설정 화면의 테마·스위치·버튼을 조작할 수 있는지
