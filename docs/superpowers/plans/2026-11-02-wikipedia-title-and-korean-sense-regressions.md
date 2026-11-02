# Wikipedia Title and Korean Sense Regression Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep English descriptions when Wikipedia normalizes or redirects titles, and preserve Korean-query recommendations in English-heavy surrounding text.

**Architecture:** Resolve each requested Korean or English title through MediaWiki's `query.normalized` and `query.redirects` mappings before associating pages with extracts. Gate the English comparison in `pickSense` to English search terms; keep conservative abstention for English queries without English evidence.

**Tech Stack:** TypeScript, Vitest, MediaWiki Action API, WXT.

## Global Constraints

- Change only review findings 2 and 3; leave Wikidata navigation and lookup response timing unchanged.
- Keep browser context local; Worker receives only requested titles.
- Preserve English-query confidence behavior and existing Korean regression samples.
- Test against documented MediaWiki `formatversion=2` normalization and redirect response shapes.

---

### Task 1: Map Wikipedia Titles Back to Requests

**Files:**
- Modify: `lib/lookup/wikipedia-context.ts`
- Create: `tests/unit/lookup/wikipedia-context.test.ts`

**Interfaces:**
- Consumes: `fetchEnglishExtracts(titles, userAgent, fetchFn)` and MediaWiki `query.pages`, `query.normalized`, `query.redirects`.
- Produces: a record keyed by the original Korean titles.

- [ ] Add failing tests for Korean title normalization/redirect and English title normalization/redirect, each asserting the original Korean key gets the correct extract.
- [ ] Run `pnpm exec vitest run tests/unit/lookup/wikipedia-context.test.ts` and observe the expected failures.
- [ ] Add a bounded title resolver that follows `from` to `to` mappings with cycle protection; use it for both Korean and English response lookups.
- [ ] Run the focused test and existing Worker English-context test until green.

### Task 2: Keep Korean Query Comparison

**Files:**
- Modify: `lib/lookup/sense.ts`
- Modify: `tests/unit/lookup/sense.test.ts`

**Interfaces:**
- Consumes: `pickSense(context, words, candidates)`.
- Produces: the same Korean bigram recommendation regardless of how much unrelated English text surrounds a Korean search term.

- [ ] Add a failing test for a Korean query with strong Korean evidence and an English-heavy surrounding sentence.
- [ ] Run `pnpm exec vitest run tests/unit/lookup/sense.test.ts` and observe the expected failure.
- [ ] Run `pickEnglishSense` only when the query is English; leave English-query abstention unchanged.
- [ ] Run the focused test and all existing sense tests until green.

### Task 3: Verify Integration

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: the existing Worker `/english-context` flow and lookup service tests.

- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, and `git diff --check`.
- [ ] Review changed files for scope and commit the fixes only after all checks pass.
