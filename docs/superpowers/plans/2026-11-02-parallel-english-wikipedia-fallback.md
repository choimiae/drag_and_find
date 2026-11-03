# Parallel English Wikipedia Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce first English-term lookup latency while keeping Korean Wikipedia and Naver result precedence unchanged.

**Architecture:** The Korean Wikipedia provider exposes a direct-summary-miss hook. For an English-only query, begin the English Wikipedia Korean-langlink lookup only when the direct Korean summary misses, while the Korean search continues. Await the Korean result first. If it is found by search, return it and abort the unused English request; otherwise await the already-started langlink and proceed with the existing Korean-title retry. Keep the existing 5-second request timeout.

**Tech Stack:** TypeScript, WXT, Vitest, Playwright, Cloudflare Worker.

## Global Constraints

- Worker still receives only the search term; browser context stays local.
- Do not return Naver early or change result selection, fallback order, or the card UI.
- Do not contact English Wikipedia for Korean or mixed Korean-English queries.
- Do not start the English fetch when a direct Korean summary exists; abort it if Korean search finds a result.
- Preserve fallback to the original result on English request failure.

---

### Task 1: Signal a Direct Korean Summary Miss

**Files:**
- Modify: `lib/lookup/wikipedia.ts`
- Modify: `tests/unit/lookup/wikipedia.test.ts`

**Interfaces:**
- `createWikipediaKoProvider` additionally exposes `lookupWithDirectMiss(query, onDirectMiss)`; `lookup(query)` retains existing behavior.

- [ ] Add a failing test that the hook fires after a direct-summary miss while search is pending, and does not fire on a direct hit.
- [ ] Run `pnpm exec vitest run tests/unit/lookup/wikipedia.test.ts` to observe the expected failure.
- [ ] Thread the hook through the existing direct-summary/search flow without changing results or request order.
- [ ] Re-run the focused test until green.

### Task 2: Start English Langlink Lookup Concurrently

**Files:**
- Modify: `lib/lookup/wikipedia-en.ts`
- Modify: `tests/unit/lookup/wikipedia-en.test.ts`

**Interfaces:**
- `withEnglishWikipediaFallback(korean, options): LookupProvider` retains its public signature.
- The optional `fetchFn` receives a signal that combines a five-second timeout and early cancellation.

- [ ] Add a failing test whose Korean search is pending after a direct-summary miss and verify the English fetch has already started.
- [ ] Add a failing test that a direct Korean hit makes no English request and a Korean search hit aborts an already-started English request.
- [ ] Run `pnpm exec vitest run tests/unit/lookup/wikipedia-en.test.ts` to observe both failures.
- [ ] Extract the existing English langlink request into a helper that returns a Korean title or undefined; start it from the direct-miss hook and abort it when unused.
- [ ] Re-run focused tests and existing Worker lookup tests until green.

### Task 3: Verify Result Quality and Performance

**Files:**
- Test: existing `tests/unit/worker/index.test.ts`, `e2e/lookup.spec.ts`.

**Interfaces:**
- `/lookup` response shape and source priority remain unchanged.

- [ ] Run `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`, and `git diff --check`.
- [ ] Measure the local Worker's POC, SSOT, and Management response times with `curl` after the code reloads, comparing with the recorded baseline (POC 0.46–0.84 s, SSOT 1.61–2.43 s, Management 0.46–0.65 s). Report ranges as samples, not guaranteed improvement.
- [ ] Review the diff for unexpected network calls and commit only after checks pass.
