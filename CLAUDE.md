# drag_and_find

> **응답 언어: 사용자에게 보이는 모든 응답은 한국어로 쓴다. 예외 없음.**
> 영어로 된 도구 결과·서브에이전트 보고를 읽은 직후에도 마찬가지다. 보내기 전에 언어를 확인한다.
> 코드·명령어·고유명사만 원어 그대로 둔다.

## 개발 워크플로우 — Superpowers

이 프로젝트는 **Superpowers 플러그인**(`superpowers@claude-plugins-official`, `.claude/settings.json`에서 활성화)의
워크플로우로 개발한다.

사용자 전역 규칙 `rules/workflow/role-separation.md`의 역할 분리 워크플로우
(`design-architect` → `implementer` → `code-reviewer`, `docs/prps/` 산출물, `/prp-plan`·`/prp-implement`)는
**이 프로젝트에서 적용하지 않는다.** 같은 문서가 "프로젝트 CLAUDE.md와 충돌하면 프로젝트 쪽을 따른다"고 정한
범위 안에서 이 문서가 대신한다. 허브 진행 기록(`hub/dashboard-recording.md`)도 그 워크플로우의 단계를 전제하므로
이 프로젝트에서는 생략한다.

### 흐름

1. **brainstorming** — 새 기능·변경은 코드 작성 전에 요구사항과 설계를 대화로 확정한다
2. **using-git-worktrees** — 설계가 확정되면 격리된 작업 브랜치/워크트리에서 진행한다
3. **writing-plans** — 확정된 설계를 작은 단위 작업 계획으로 쪼갠다
4. **subagent-driven-development** 또는 **executing-plans** — 계획을 실행한다
5. **test-driven-development** — 구현은 RED → GREEN → REFACTOR를 지킨다
6. **requesting-code-review** — 작업 단위마다 검수를 받고 지적을 반영한다
7. **verification-before-completion** — 완료 선언 전에 실제 명령 출력으로 확인한다
8. **finishing-a-development-branch** — 병합·PR·정리를 결정한다

버그는 **systematic-debugging**으로 원인을 먼저 찾고 고친다.

### 그대로 유지하는 사용자 규칙

- 응답은 한국어로 쓴다
- 커밋 메시지 형식은 `rules/common/git-workflow.md`를 따른다 (`<type>: <설명>`, 짧고 쉬운 말)
- 커밋·푸시는 사용자가 요청할 때만 한다

## 빌드/검증 명령

처음 한 번: Node 22와 pnpm 12가 필요하다. `pnpm install` 후 `pnpm exec playwright install chromium`을 실행한다(`pnpm test:e2e`에 필요).

| 목적 | 명령 |
|---|---|
| 개발(크롬 자동 실행·변경 즉시 반영) | `pnpm dev` |
| 빌드 (`.output/chrome-mv3/`) | `pnpm build` |
| 단위 테스트 | `pnpm test` |
| E2E 테스트 (빌드 포함) | `pnpm test:e2e` |
| 타입 검사 | `pnpm compile` |
| 린트 | `pnpm lint` |
| 포맷 검사 / 적용 | `pnpm format:check` / `pnpm format` |
| 웹스토어 업로드용 zip | `pnpm zip` |
| 확장 아이콘 PNG 다시 만들기 (`assets/icon.svg` 수정 후) | `pnpm icons` |
| 스토어 이미지 다시 만들기 | `pnpm store:images` |

커밋 전 전체 검증: `pnpm format:check && pnpm lint && pnpm compile && pnpm test && pnpm test:e2e`

크롬에 직접 올려 보기: `pnpm build` → `chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3` 선택
