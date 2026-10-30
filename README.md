# Drag and Find

모르는 단어가 나오면 검색창을 열지 말고, 그냥 드래그하세요.

Drag and Find는 웹페이지에서 드래그한 단어의 네이버 백과 검색 결과를 그 자리에 카드로 보여 주는 크롬 확장 프로그램입니다. 네이버 백과에 결과가 없거나 호출 한도를 넘으면 한국어 위키백과를 조회합니다.

![드래그한 단어의 네이버 백과 검색 결과 카드](docs/store/images/screenshot-1.png)

## 설치

- **크롬 웹스토어**: [Drag and Find 설치하기](https://chromewebstore.google.com/detail/odakmhndhedojcgadjfaeeljddldicla)
- **직접 설치**: 아래 [개발](#개발) 부분을 참고해 빌드한 뒤 `chrome://extensions`에서 불러올 수 있습니다.

## 사용 방법

1. 웹페이지에서 궁금한 단어를 드래그합니다.
2. 단어 옆에 나타난 돋보기 아이콘을 누르거나, 단축키 `Alt+Shift+F`(맥은 `⌥⇧F`)를 누릅니다.
3. 출처가 표시된 설명 카드가 단어 아래에 나타납니다. `Esc` 키나 카드 바깥을 누르면 닫힙니다.

## 주요 기능

- **네이버 백과 우선 조회**: 네이버 백과 검색 결과 한 건을 보여 줍니다. 결과가 없거나 한도가 차면 위키백과 요약을 보여 줍니다.
- **뜻이 여러 개인 단어**: 앞뒤 글을 보고 "이 글에서는 아마 이 뜻"을 먼저 골라 보여 주고, 기본 뜻과 다른 뜻도 함께 보여 줍니다. 다른 뜻을 누르면 그 뜻의 요약으로 바뀝니다.
- **구글·네이버 검색**: 위키백과에 없거나 더 찾아보고 싶을 때, 같은 단어로 검색한 새 탭을 엽니다. 카드의 검색어 칸에서 검색어를 고쳐 검색할 수 있고, `Enter`를 누르면 설정에서 고른 사이트(기본 네이버)로 검색합니다.
- **설정**: 드래그할 때 아이콘을 띄울지, 카드 테마(크롬 설정 따라가기 / 밝게 / 어둡게), `Enter`로 검색할 곳(네이버 / 구글)을 고를 수 있습니다.

| 뜻이 여러 개인 단어 | 어두운 테마 |
|---|---|
| ![뜻이 여러 개인 단어](docs/store/images/screenshot-2.png) | ![어두운 테마](docs/store/images/screenshot-3.png) |

## 개인정보

- 찾기를 요청했을 때 선택한 단어를 Cloudflare Worker로 보냅니다. Worker는 네이버 백과를 우선 조회하고 필요할 때 위키백과를 조회합니다.
- 구글·네이버 버튼은 누를 때(또는 검색어 칸에서 `Enter`를 칠 때)만 동작합니다. 누르면 그 단어(또는 내가 고친 검색어)로 검색한 페이지가 새 탭으로 열리므로 그 말이 해당 사이트에 전달됩니다.
- 단어 앞뒤의 글은 뜻을 고르는 데에만 브라우저 안에서 쓰고, 서버로 보내지 않습니다.
- 분석 도구와 광고는 없습니다. 설정은 내 기기에만 저장됩니다. 검색 결과는 캐시하지 않습니다.

자세한 내용은 [개인정보 처리방침](PRIVACY.md)을 확인하세요.

카드에는 실제 출처와 원문 링크를 표시합니다. 위키백과 내용을 보여 줄 때는 CC BY-SA 4.0 표시도 붙입니다.

## 개발

[WXT](https://wxt.dev/)와 TypeScript로 만들었습니다. Node 22와 pnpm 12가 필요합니다.

```bash
pnpm install
pnpm exec playwright install chromium   # E2E 테스트용, 처음 한 번
```

| 목적 | 명령 |
|---|---|
| 개발 (크롬 자동 실행, 변경 즉시 반영) | `pnpm dev` |
| 빌드 (`.output/chrome-mv3/`) | `pnpm build` |
| 단위 테스트 / E2E 테스트 | `pnpm test` / `pnpm test:e2e` |
| 타입 검사 / 린트 / 포맷 검사 | `pnpm compile` / `pnpm lint` / `pnpm format:check` |
| 웹스토어 업로드용 zip | `pnpm zip` |

크롬에 직접 올려 보기: `pnpm build` → `chrome://extensions` → 개발자 모드 켜기 → "압축해제된 확장 프로그램을 로드합니다" → `.output/chrome-mv3` 폴더 선택

### 중계 Worker 설정

1. NAVER Cloud Platform의 NAVER API HUB에서 백과사전 검색용 Application과 Client ID·Secret을 발급하고 일별 이용 한도를 설정합니다.
2. Cloudflare 대시보드에서 `drag-and-find-lookup` Worker를 만들고 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`을 **Secrets**로 등록한 뒤 `worker/wrangler.jsonc`를 배포합니다. 로컬 개발에는 버전 관리에서 제외된 `worker/.dev.vars`를 사용합니다.
3. 배포된 Worker 주소를 `WXT_LOOKUP_API_URL`로 지정해 확장을 빌드합니다. 예: `WXT_LOOKUP_API_URL=https://drag-and-find-lookup.example.workers.dev pnpm build` (예시 주소를 실제 주소로 교체).

Worker 배포: `pnpm exec wrangler deploy --config worker/wrangler.jsonc`. 로컬 실행: `pnpm exec wrangler dev --config worker/wrangler.jsonc`. Worker 주소 없이 배포 빌드를 실행하면 설정 오류로 빌드가 중단됩니다.

## 문의

maestro001220@gmail.com
