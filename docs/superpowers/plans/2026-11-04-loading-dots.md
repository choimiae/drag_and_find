# 뜻 보기 로딩 점 애니메이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 사용자 지침에 따라 커밋과 푸시는 별도 요청이 있을 때만 한다.

**Goal:** `뜻 보기` 로딩을 선택된 B안의 점 세 개 애니메이션으로 바꾼다.

**Architecture:** `lib/ui/card.ts`는 로딩 상태에만 점과 문구를 렌더링한다. `lib/ui/styles.ts`가 애니메이션과 움직임 줄이기 동작을 담당한다. 조회 흐름과 Worker 응답은 변경하지 않는다.

**Tech Stack:** TypeScript, WXT, Vitest, Playwright.

## Global Constraints

- 설계 기준: `docs/superpowers/specs/2026-11-04-loading-dots-design.md`.
- 카드 폭 320px과 제목·탭·출처 구조를 유지한다.
- 사용자 문구는 한국어로 쓴다.
- `work/`의 미추적 사용자 파일은 건드리지 않는다.

---

### Task 1: 로딩 화면과 검증

**Files:** `lib/ui/card.ts`, `lib/ui/styles.ts`, `tests/unit/ui/card.test.ts`, `e2e/lookup.spec.ts`.

**Interfaces:** 기존 `renderCard(card, query, state, handlers)` 시그니처를 유지한다. 로딩 점 래퍼에 `data-role="loading"`, 점 장식에 `aria-hidden="true"`를 붙인다.

- [x] 단위 테스트에서 로딩 문구 `뜻을 찾고 있어요`, 점 3개, 상태 역할과 `aria-hidden`을 먼저 기대한다.
- [x] `pnpm exec vitest run tests/unit/ui/card.test.ts`로 새 테스트가 기존 `찾는 중…` 때문에 실패하는지 확인한다.
- [x] 로딩 노드와 점 애니메이션 CSS를 추가한다. `@media (prefers-reduced-motion: reduce)`에서는 애니메이션을 끈다.
- [x] 단위 테스트를 다시 실행해 통과를 확인한다.
- [x] 기존 E2E의 조회 시작·완료 흐름에서 로딩 표시와 제거를 검증한다.
- [x] `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`를 실행한다.
- [x] 확정된 임시 HTML 시안 파일을 삭제한다.
