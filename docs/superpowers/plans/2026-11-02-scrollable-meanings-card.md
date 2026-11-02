# Scrollable Meanings Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every Korean meaning as a readable row in a scrollable card section, with source attribution matching the displayed content.

**Architecture:** Keep `renderCard` and the existing result model. Render every meaning inside one `ul` whose height and overflow are controlled in `OVERLAY_CSS`; keep the source link and attribution after the list. A row button contains both title and description so the whole row opens the corresponding article.

**Tech Stack:** TypeScript, WXT, DOM APIs, Vitest, Playwright.

## Global Constraints

- Card width remains 320px.
- Show Korean descriptions only; use `간단한 설명이 없습니다.` when missing.
- Render all meanings without a more button; scroll only the list in the normal card layout.
- Keep the suggestion above the list and omit its duplicate row.
- Show the original link and license for the source actually displayed.
- Keep existing input state, keyboard behavior, light/dark themes, and safe `textContent` insertion.

---

### Task 1: Complete Meaning Rows

**Files:**
- Modify: `lib/ui/card.ts`
- Test: `tests/unit/ui/card.test.ts`

**Interfaces:**
- Consumes: `DisambiguationInfo.meanings`, `Meaning { label, description?, title }`, `CardHandlers.onSelectMeaning(title)`.
- Produces: `[data-role="meanings"]` containing all rows; clickable rows retain `[data-role="meaning"]`.

- [ ] **Step 1: Write failing tests** for 10 rendered rows with no `more-meanings`, whole-row click through the description, Korean missing-description text, and suggested-meaning deduplication.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/ui/card.test.ts` and confirm the new tests fail for the expected reasons.
- [ ] **Step 3: Replace the `MAX_MEANINGS` slice** with all meanings; in `meaningItem`, put the label and description inside one button when `title` exists, or inside a static row when it does not. Use `textContent` through `element()` and the literal placeholder for missing descriptions. Do not alter `suggestionBlock`.
- [ ] **Step 4: Run** the same focused test and confirm it passes.

### Task 2: Internal Scroll and Attribution

**Files:**
- Modify: `lib/ui/styles.ts`, `lib/ui/card.ts`
- Test: `tests/unit/ui/styles.test.ts`, `tests/unit/ui/card.test.ts`

**Interfaces:**
- Consumes: `.card-meanings` list markup and `FoundResult.source`.
- Produces: bounded vertical list scrolling; source link and attribution outside the list.

- [ ] **Step 1: Write failing tests** requiring `.card-meanings` vertical overflow and a finite max height, source elements after the list, and Wikipedia attribution that says the text is an excerpt while preserving its license link. Keep existing Naver and Wikidata attribution tests.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/unit/ui/card.test.ts tests/unit/ui/styles.test.ts` and confirm expected failures.
- [ ] **Step 3: Change CSS** to a column of full-width rows with separators, a bounded `max-height` and `overflow-y: auto` on `.card-meanings`, and button hover/focus states. Keep `.card-body` as viewport fallback. Change Wikipedia attribution text to `출처: 위키백과 설명 일부` and preserve `CC BY-SA 4.0` link.
- [ ] **Step 4: Run** the focused tests and confirm they pass.

### Task 3: Browser Flow and Final Verification

**Files:**
- Modify: `e2e/fixtures.ts`, `e2e/lookup.spec.ts`
- Test: `e2e/lookup.spec.ts`

**Interfaces:**
- Consumes: existing mock lookup route and `[data-role="meanings"]`, `[data-role="meaning"]`, header/source/footer elements.
- Produces: browser coverage for a long list, last-item access, pinned header/footer, and click-through.

- [ ] **Step 1: Add a long ambiguous fixture** with at least 10 meanings and Korean descriptions; add a Playwright test that opens it, scrolls the list to the last item, checks the header/source/search footer remain visible, and selects the last meaning.
- [ ] **Step 2: Run** `pnpm test:e2e` and confirm the new test fails before any remaining markup or style adjustment.
- [ ] **Step 3: Make the smallest adjustment** needed for browser behavior and rerun `pnpm test:e2e`.
- [ ] **Step 4: Run** `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, and `pnpm test:e2e`; inspect `git diff --check`, then commit the design, plan, tests, and UI code with a conventional message.

## Self-review

- Spec coverage: all rows, scroll, empty descriptions, suggestion, source rules, and browser behavior are assigned above.
- The plan uses existing `Meaning`, `FoundResult`, and `renderCard` interfaces.
