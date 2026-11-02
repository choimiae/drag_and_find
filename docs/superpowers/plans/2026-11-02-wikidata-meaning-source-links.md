# Wikidata Meaning Source Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give same-name Wikidata meanings separate links to their own original pages.

**Architecture:** Add an optional source URL to `Meaning` for entries that cannot be reopened by title. The Worker fills it from each candidate's exact entity URL. The card keeps the Korean label and description and renders a separate safe external link in that row.

**Tech Stack:** TypeScript, WXT, Vitest, Playwright.

## Global Constraints

- Only change finding 1. Keep lookup timing and result selection unchanged.
- Same-name entries remain separate; do not issue another Worker request on link click.
- Open original pages in a new tab with `noopener noreferrer`.
- Keep Korean descriptions in the card and the existing source/CC0 attribution.
- Reject non-HTTPS or unknown-host row URLs.

---

### Task 1: Carry Distinct Source URLs

**Files:**
- Modify: `lib/lookup/types.ts`, `worker/wikidata.ts`
- Create: `tests/unit/worker/wikidata.test.ts`

**Interfaces:**
- `Meaning.sourceUrl?: string` is populated when `title` is null and the candidate has an original page URL.

- [ ] Add a failing test where two entities share the search label but have distinct IDs, and assert both meanings remain separate with different `sourceUrl` values.
- [ ] Run `pnpm exec vitest run tests/unit/worker/wikidata.test.ts` and confirm the test fails for missing URLs.
- [ ] Add the optional field and populate it only on same-name Wikidata meanings.
- [ ] Re-run the focused test until green.

### Task 2: Show Per-Row Original Links

**Files:**
- Modify: `lib/ui/card.ts`, `lib/ui/styles.ts`
- Modify: `tests/unit/ui/card.test.ts`

**Interfaces:**
- The card renders `[data-role="meaning-source-link"]` beneath a same-name meaning's Korean description.

- [ ] Add failing tests for two distinct HTTPS row links, new-tab safety, unchanged descriptions, no extra lookup action, and rejection of an unsafe URL.
- [ ] Run `pnpm exec vitest run tests/unit/ui/card.test.ts` and confirm expected failures.
- [ ] Render row links only for safe Wikidata or Korean Wikipedia URLs, then add compact link styling.
- [ ] Re-run focused tests until green.

### Task 3: Browser and Full Verification

**Files:**
- Modify: `e2e/fixtures.ts`, `e2e/lookup.spec.ts`

**Interfaces:**
- A mocked same-name Wikidata result has two per-row original URLs.

- [ ] Add a browser test that opens the same-name list and verifies each original link opens its own URL in a new tab.
- [ ] Run `pnpm test:e2e` and resolve any browser-only issue.
- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, and `git diff --check` before committing.
