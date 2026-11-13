# 관리자 통합 화면 설정

## 화면만 먼저 확인

저장소 루트에서 `pnpm admin:preview`를 실행하고 표시된 로컬 주소를 연다. 이 화면에는 **예시 데이터**가 표시되며 Google·Cloudflare 계정이나 Access 설정은 필요하지 않다. `Ctrl+C`로 종료한다. 실제 통계를 보려면 아래 설정과 배포를 완료해야 한다.

관리자 앱은 별도 Cloudflare Worker로 배포한다. 배포 후에는 배포 주소에서 계속 확인할 수 있다. 화면에는 D1의 실시간 조회 사용량, Chrome Web Store의 일별 성과, GA4의 지연 통계, 조회 Worker의 현재 응답 상태가 표시된다. 화면이 보이면 D1 통계만 15초마다 갱신한다. 계정 정보가 빠진 영역은 `연결 필요`로 표시된다. 관리자 화면의 상태 확인 요청이 섞이는 Cloudflare Worker 전체 호출 수는 표시하지 않는다. 1.0.6 이상 확장을 설치한 브라우저에서는 ‘이 브라우저의 내 조회 포함’을 끄면 그 설치의 이후 조회 통계 전송을 중단할 수 있다. 기존 기록은 유지되고 다른 브라우저의 설치에는 적용되지 않는다.

## 1. Google 통계 준비

1. Google Cloud 프로젝트에서 Chrome Web Store API와 Google Analytics Data API를 사용 설정하고 서비스 계정을 만든다. 서비스 계정 JSON 키는 저장소에 넣지 않는다.
2. Chrome Web Store 개발자 대시보드에서 해당 서비스 계정 이메일을 게시자 계정의 서비스 계정으로 등록한다. 게시자 ID와 확장 항목 ID를 확인한다.
3. GA4 속성을 만들고 웹 데이터 스트림의 측정 ID(`G-...`)와 Measurement Protocol API Secret을 발급한다. GA4 속성의 숫자 ID도 확인한다. GA4 속성에 같은 서비스 계정 이메일을 읽기 권한으로 추가한다.
4. 조회 Worker에 `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`을 Secret으로 등록한다. 확장 업데이트 후 발생한 조회부터 사용량이 집계된다. 통계에는 검색어를 보내지 않는다.

## 2. 실시간 사용량 D1 연결

`pnpm exec wrangler d1 create drag-and-find-usage`로 D1을 만든다. 반환된 `database_id`를 `worker/wrangler.jsonc`와 `admin/wrangler.jsonc`의 `USAGE_DB` 바인딩에 똑같이 적는다. 조회 Worker 배포 전에 `pnpm exec wrangler d1 migrations apply drag-and-find-usage --remote --config worker/wrangler.jsonc`로 `worker/migrations/` 스키마를 적용한다. 조회 Worker가 이벤트를 기록하고 관리자 Worker가 같은 DB를 읽는다.

일별 조회 완료·실패 건수와 SHA-256으로 해시한 설치 식별자를 한국 시간 기준으로 저장한다. 검색어·URL·PDF 내용·원본 설치 식별자는 D1에 넣지 않는다. 일일 예약 작업이 30일이 지난 기록을 삭제한다. D1 연결 이후 받은 이벤트부터 표시되므로 이전 GA4 기록은 소급되지 않는다. `/api/live-usage`도 기존 Access 인증을 통과해야 한다.

## 3. 관리자 Worker 연결

계정별 설정은 저장소에 기록하지 않는다. 관리자 Worker를 만든 뒤 Cloudflare 대시보드의 **Settings → Variables and Secrets**에서 아래 이름으로 직접 등록한다.
ID와 이메일은 인증 키가 아니지만 공개 저장소에 넣지 않도록 Secret 유형을 사용한다. `ACCESS_TEAM_DOMAIN`은 `https://<팀이름>.cloudflareaccess.com`, `ACCESS_AUD`는 관리자 Access 애플리케이션의 Audience 태그, `ADMIN_EMAIL`은 허용할 소유자 이메일이다. 조회 Worker 이름과 URL이 다르면 `admin/wrangler.jsonc`의 서비스 바인딩과 `LOOKUP_WORKER_URL`을 수정한다.

| Worker | Secret |
| --- | --- |
| 조회 Worker | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` |
| 관리자 Worker | `CWS_PUBLISHER_ID`, `CWS_ITEM_ID`, `GA4_PROPERTY_ID`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_JSON` |

서비스 계정 JSON 전체는 `GOOGLE_SERVICE_ACCOUNT_JSON` Secret에 넣는다. 값은 소유자가 Cloudflare 화면에서 직접 입력하고, 채팅이나 에이전트 도구 출력으로 전달하지 않는다. Wrangler 재배포는 등록된 Secret을 삭제하지 않는다. 로컬 개발에는 버전 관리에서 제외된 `admin/.dev.vars`와 `worker/.dev.vars`를 사용할 수 있지만, 다른 사람이 그 파일을 읽을 수 있는 환경에서는 만들지 않는다. 계정별 값과 비밀키를 코드, 문서, 커밋, 클라이언트 빌드에 넣지 않는다.

```bash
pnpm admin:build
pnpm admin:dev
```

로컬 서버는 `http://localhost:8787`에서 실행되지만, Access 서명 검증이 없으면 화면과 API 모두 403을 반환한다. 운영 배포 명령은 `pnpm exec wrangler deploy --config admin/wrangler.jsonc`다.

## 4. 접근 제한과 배포 확인

관리자 Worker 자체에 Cloudflare Access 애플리케이션을 만들고 소유자의 Google 계정만 허용한다. Worker 수준에서 운영 주소와 미리보기 주소를 모두 보호한다. 서버 코드도 Access JWT의 서명·대상·이메일을 확인하며, 설정이 빠지면 모든 경로를 거부한다. 화면과 `/api/dashboard`, 배포 미리보기 주소에 같은 제한이 적용되는지 확인한 뒤 주소를 사용한다.

배포 후 소유자 계정으로 로그인해 실제 단어 조회를 한 번 수행하고 D1 조회 완료 수와 조회 사용 설치 수가 15초 안팎으로 증가하는지 확인한다. 다른 계정에서는 화면과 `/api/dashboard`, `/api/live-usage`가 모두 차단되는지 확인한다. Chrome Web Store 설치 수와 GA4 보고서는 반영이 지연될 수 있으며, `조회 사용 설치 수`는 고유한 사람 수가 아니라 설치별 식별자를 기준으로 한 근사치다. `조회 실패`는 확장의 조회 경로가 모두 실패한 경우로, Worker 내부 오류 수와 다르다. Google은 Measurement Protocol만으로 수집하면 보고서가 일부만 제공될 수 있다고 안내한다. 또한 공개 통계 경로의 이벤트는 위조할 수 있으므로 이 수치를 정확한 인원이나 과금 기준으로 사용하지 않는다. GA4의 HTTP 성공 응답만으로 집계 성공을 판단하지 말고, 실제 확장 조회 후 GA4 보고서에 반영되는지 확인한다.
