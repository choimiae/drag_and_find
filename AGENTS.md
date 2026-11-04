# Drag and Find 작업 지침

## 프로젝트

- 웹페이지에서 선택한 단어의 설명을 카드로 보여 주는 크롬 확장 프로그램이다.
- `entrypoints/`는 콘텐츠 스크립트, 백그라운드, 설정 화면의 진입점이다. `lib/`는 선택 처리, 조회, 카드 UI의 로직이다.
- `worker/`는 네이버 백과와 위키백과 등을 조회하는 Cloudflare Worker다. 확장은 Worker 요청이 실패하면 위키백과를 직접 조회한다.
- 기능과 사용자 데이터 흐름을 바꿀 때는 `README.md`, `PRIVACY.md`, `docs/store/listing.md`의 해당 설명도 확인한다.

## 대화와 변경

- 사용자에게 보이는 답변과 진행 상황은 한국어로 쓴다. 커밋 메시지의 설명도 한국어로 쓴다. 커밋 종류 표기(`feat:`, `fix:`, `chore:` 등), 코드, 명령어, 고유명사는 원어를 유지한다.
- 커밋 메시지는 `<type>: <설명>` 형식으로 짧고 쉽게 쓴다. `type`은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci` 중에서 고른다.
- 커밋과 푸시는 사용자가 요청할 때만 한다. 배포와 웹스토어 심사 제출도 사용자 요청 범위에서 진행한다.
- 관련 없는 사용자 파일과 변경 사항은 건드리지 않는다.
- 변경 전에는 관련 코드와 `docs/superpowers/specs/`의 해당 설계를 확인하고, 변경 후에는 실제 명령 결과로 검증한다.

## 개발과 검증

- Node 22와 pnpm 12를 사용한다. 명령은 저장소 루트에서 실행한다. 처음에는 Worker 주소를 지정해 `pnpm install --frozen-lockfile`을 실행하고, E2E 테스트용 Chromium을 `pnpm exec playwright install chromium`으로 설치한다.
- 개발 서버는 `pnpm dev`로 실행한다. 확장 빌드는 `pnpm build`, 웹스토어용 ZIP 생성은 `pnpm zip`을 사용한다.
- 단위 테스트: `pnpm test`. 타입 검사: `pnpm compile`. 린트: `pnpm lint`. 포맷 검사: `pnpm format:check`.
- 브라우저 동작을 바꾸면 `pnpm test:e2e`를 실행한다. 이 테스트는 Chromium에서 확장을 구동하지만 외부 서비스 응답은 가짜 값으로 대체한다.
- 커밋 전에는 `pnpm format:check`, `pnpm lint`, `pnpm compile`, `pnpm test`, `pnpm test:e2e`를 모두 실행한다.
- `assets/icon.svg`를 바꾸면 `pnpm icons`로 아이콘 PNG를 다시 만든다. 스토어에 보이는 화면을 바꾸면 `pnpm store:images`로 스크린샷을 다시 만들고 README 이미지와 스토어 등록 이미지를 확인한다.
- 배포 전에는 `.github/workflows/ci.yml`의 전체 검사를 통과시킨다. `pnpm zip`은 실제 배포 Worker를 `pnpm worker:check`로 확인한 뒤 ZIP을 만든다. 단위·E2E 테스트 통과를 실제 Worker 정상 동작의 증거로 삼지 않는다.
- 배포용 확장 빌드와 ZIP 생성에는 실제 Worker 주소를 `WXT_LOOKUP_API_URL`로 지정한다. 절차는 `docs/store/SUBMIT.md`를 따른다. 비밀키는 저장소에 기록하지 않는다.
