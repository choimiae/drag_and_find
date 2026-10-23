# drag_and_find

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

아직 코드가 없다. 기술 스택이 정해지면 실행·테스트·lint/format·type check 명령을 여기에 적는다.
