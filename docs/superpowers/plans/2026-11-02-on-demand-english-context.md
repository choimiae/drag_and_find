# On-demand English Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 검색 응답에서 영어 설명 조회를 빼고 필요한 문맥에서만 후속 요청한다.

**Architecture:** Worker는 기본 검색과 영어 후보 설명 조회를 별도 경로로 제공한다. 확장 백그라운드 서비스가 기본 결과로 뜻을 먼저 고르고, 필요한 경우에만 후속 경로를 호출한다.

**Tech Stack:** TypeScript, WXT, Cloudflare Worker, Vitest.

## Global Constraints

- 주변 문맥은 Worker로 보내지 않는다.
- 검색 결과 카드는 판단 뒤 한 번만 표시한다.
- 현재 개발 브랜치의 기존 변경을 보존한다.
- 사용자가 요청하지 않았으므로 커밋하지 않는다.

---

### Task 1: Worker 영어 설명 경로

**Files:** `worker/index.ts`, `lib/lookup/wikipedia-context.ts`, `tests/unit/worker/index.test.ts`

- [x] 기본 `/lookup` 결과가 영어 설명 API를 호출하지 않는 실패 테스트 작성 및 실패 확인
- [x] `/english-context`가 최대 8개 후보 제목을 받아 고정된 위키백과 호스트에서 영어 설명을 구하는 실패 테스트 작성 및 실패 확인
- [x] 입력 오류를 검증하는 실패 테스트 작성 및 실패 확인
- [x] 최소 구현 후 해당 테스트 통과 확인

### Task 2: 브라우저 조건부 조회

**Files:** `lib/lookup/service.ts`, `lib/lookup/worker-client.ts`, `entrypoints/background.ts`, `tests/unit/lookup/service.test.ts`, `tests/unit/lookup/worker-client.test.ts`

- [x] Management 한국어 문맥에서는 후속 요청이 없고 영어 중심 문맥에서는 후보 제목만 보내는 실패 테스트 작성 및 실패 확인
- [x] 후속 요청 실패 시 기본 결과를 표시하는 테스트 작성
- [x] 단어만 있는 문맥에서 불필요한 요청을 막는 실패 테스트 작성 및 실패 확인
- [x] 최소 구현 후 해당 테스트 통과 확인

### Task 3: 검증

- [x] 변경 파일 포맷, 린트, 타입 검사, 전체 단위 테스트, 빌드, E2E 실행
- [x] 기본 결과와 후속 결과의 실제 응답 시간을 비교
- [x] 변경 파일과 기존 작업 내용의 경계를 검토

전체 포맷 검사는 기존 미완성 변경 파일 11개 때문에 실패했다. 이번 변경 파일의 포맷 검사는 통과했다.
