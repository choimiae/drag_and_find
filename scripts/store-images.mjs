// 웹스토어 등록용 이미지를 docs/store/images/에 만든다. 빌드된 확장(.output/chrome-mv3)이 필요하다.
// 실행: pnpm store:images  (빌드 포함). 외부 서버에는 접속하지 않고 가짜 응답만 쓴다.
import { mkdir } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const extensionPath = fileURLToPath(new URL('.output/chrome-mv3', root));
const outputDir = new URL('docs/store/images/', root);
const outputPath = (name) => fileURLToPath(new URL(name, outputDir));

const SCREENSHOT_SIZE = { width: 1280, height: 800 };
const PROMO_SIZE = { width: 440, height: 280 };
const SETTLE_MS = 400;
const BLOG_ORIGIN = 'https://blog.example.test';

function articleHtml({ dark }) {
  const palette = dark
    ? {
        page: '#14171b',
        header: '#1b1f24',
        text: '#d5dae0',
        title: '#f1f3f5',
        muted: '#8d97a3',
        line: '#2a3038',
      }
    : {
        page: '#f7f7f5',
        header: '#ffffff',
        text: '#2b2f36',
        title: '#14181d',
        muted: '#6b7480',
        line: '#e6e6e2',
      };
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>작은 서점 일기</title>
<style>
  body { margin: 0; overflow: hidden; background: ${palette.page}; color: ${palette.text};
    font: 19px/1.95 -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
  header { padding: 18px 0; background: ${palette.header}; border-bottom: 1px solid ${palette.line}; }
  header div { max-width: 720px; margin: 0 auto; font-weight: 700; color: ${palette.title}; }
  article { max-width: 720px; margin: 0 auto; padding: 36px 0; }
  h1 { margin: 0 0 6px; font-size: 32px; line-height: 1.4; color: ${palette.title}; }
  .meta { margin: 0 0 28px; font-size: 14px; color: ${palette.muted}; }
  p { margin: 0 0 20px; }
</style></head>
<body>
  <header><div>작은 서점 일기</div></header>
  <article>
    <h1>퇴근 후 한 시간, 새로 배운 것들</h1>
    <p class="meta">2026. 10. 12 · 일상 기록</p>
    <p>이번 달에 새 팀으로 옮기면서 <span id="known">온보딩</span> 자료를 하나씩 읽고 있다. 처음 보는 용어가 많아서 메모장이 금세 찼다.</p>
    <p>동료가 알려 준 대로 주문 테이블에 행이 추가될 때마다 재고를 줄이도록 <span id="ambiguous">트리거</span> 기능을 걸어 두었더니, 손으로 고치던 일이 사라졌다.</p>
    <p>모르는 말이 나올 때마다 검색창을 여는 일도 줄었다. 그냥 드래그해서 읽으면 되니까.</p>
  </article>
</body></html>`;
}

const SUMMARIES = {
  온보딩: {
    type: 'standard',
    title: '온보딩',
    extract:
      '온보딩은 신입 직원이나 새로운 구성원이 조직의 문화와 업무 방식에 빠르게 적응하도록 돕는 과정이다.',
    content_urls: {
      desktop: { page: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9' },
    },
  },
  트리거: {
    type: 'disambiguation',
    title: '트리거',
    extract: '트리거(Trigger)는 다음 뜻으로 쓰인다.',
    content_urls: {
      desktop: { page: 'https://ko.wikipedia.org/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0' },
    },
  },
  '데이터베이스 트리거': {
    type: 'standard',
    title: '데이터베이스 트리거',
    extract: '데이터베이스 트리거는 테이블에 행이 추가되거나 바뀔 때 자동으로 실행되는 절차이다.',
    content_urls: { desktop: { page: 'https://ko.wikipedia.org/wiki/x' } },
  },
};

// 확장이 뜻 모음 문서를 action=parse(HTML + 연결 목록)로 받으므로 같은 모양으로 꾸민다.
const TRIGGER_PARSE_HTML = `<div class="mw-parser-output"><p>트리거(Trigger)는 다음 뜻으로 쓰인다.</p>
<div class="mw-heading mw-heading2"><h2 id="기본_의미">기본 의미</h2></div>
<ul><li>트리거는 총의 <a href="/wiki/%EB%B0%A9%EC%95%84%EC%87%A0" title="방아쇠">방아쇠</a>를 뜻하는 사격용어이다.</li></ul>
<div class="mw-heading mw-heading2"><h2 id="컴퓨터_과학">컴퓨터 과학</h2></div>
<ul><li><a href="/wiki/%EB%8D%B0%EC%9D%B4%ED%84%B0%EB%B2%A0%EC%9D%B4%EC%8A%A4_%ED%8A%B8%EB%A6%AC%EA%B1%B0" title="데이터베이스 트리거">데이터베이스 트리거</a></li></ul>
<div class="mw-heading mw-heading2"><h2 id="기업">기업</h2></div>
<ul><li><a href="/wiki/%ED%8A%B8%EB%A6%AC%EA%B1%B0_(%EC%95%A0%EB%8B%88%EB%A9%94%EC%9D%B4%EC%85%98_%EC%A0%9C%EC%9E%91%EC%82%AC)" title="트리거 (애니메이션 제작사)">트리거 (애니메이션 제작사)</a>: 일본의 애니메이션 제작사</li></ul>
<div class="mw-heading mw-heading2"><h2 id="같이_보기">같이 보기</h2></div>
<ul><li><a href="/wiki/%EB%B0%A9%EC%95%84%EC%87%A0_(%EB%8F%99%EC%9D%8C%EC%9D%B4%EC%9D%98)" title="방아쇠 (동음이의)">방아쇠 (동음이의)</a></li></ul></div>`;

const TRIGGER_PARSE = {
  parse: {
    title: '트리거',
    pageid: 1,
    text: TRIGGER_PARSE_HTML,
    links: ['방아쇠', '데이터베이스 트리거', '트리거 (애니메이션 제작사)', '방아쇠 (동음이의)'].map(
      (title) => ({ ns: 0, title, exists: true }),
    ),
  },
};

const TRIGGER_LINKED = {
  query: {
    pages: {
      2: {
        title: '데이터베이스 트리거',
        extract:
          '데이터베이스 트리거는 테이블에 행이 추가되거나 바뀔 때 자동으로 실행되는 절차이다.',
      },
      3: { title: '트리거 (애니메이션 제작사)', extract: '일본의 애니메이션 제작사이다.' },
      4: { title: '방아쇠', extract: '방아쇠는 총의 격발 장치이다.' },
    },
  },
};

async function routeFakeNetwork(context) {
  // 나중에 등록한 라우트가 먼저 적용되므로, 전부 막는 규칙을 맨 처음에 둔다.
  await context.route(/^https?:\/\//, (route) => route.abort());
  await context.route(`${BLOG_ORIGIN}/**`, (route) => {
    const dark = new URL(route.request().url()).searchParams.has('dark');
    return route.fulfill({ contentType: 'text/html', body: articleHtml({ dark }) });
  });
  await context.route('https://ko.wikipedia.org/api/rest_v1/page/summary/**', (route) => {
    const title = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop());
    const body = SUMMARIES[title];
    return body
      ? route.fulfill({ json: body })
      : route.fulfill({ status: 404, json: { type: 'not_found' } });
  });
  await context.route(/ko\.wikipedia\.org\/w\/api\.php/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get('action') === 'parse') return route.fulfill({ json: TRIGGER_PARSE });
    if (params.get('generator') === 'links') return route.fulfill({ json: TRIGGER_LINKED });
    return route.fulfill({ json: { query: { search: [] } } });
  });
}

async function showCard(page, { dark, wordId, expectedTitle }) {
  await page.goto(`${BLOG_ORIGIN}/post${dark ? '?dark' : ''}`);
  await page.locator(`#${wordId}`).dblclick();
  await page.locator('[data-role="icon"]').click();
  await page.locator('[data-role="title"]', { hasText: expectedTitle }).waitFor();
  await page.locator('[data-role="attribution"]').waitFor();
  // 선택 하이라이트와 마우스 커서가 사진에 어색하게 남지 않도록 포인터를 빈 곳으로 옮긴다.
  await page.mouse.move(SCREENSHOT_SIZE.width - 20, SCREENSHOT_SIZE.height - 20);
}

async function setTheme(serviceWorker, theme) {
  await serviceWorker.evaluate(
    `chrome.storage.local.set({ settings: { showIcon: true, theme: '${theme}' } })`,
  );
}

const PROMO_HTML = `<html><body style="margin:0;overflow:hidden">
  <div style="width:${PROMO_SIZE.width}px;height:${PROMO_SIZE.height}px;display:flex;
    align-items:center;justify-content:center;
    background:linear-gradient(135deg,#03c75a,#1a73e8)">
    <svg width="132" height="132" viewBox="0 0 24 24" fill="none" stroke="#ffffff"
      stroke-width="2.2" stroke-linecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" />
    </svg></div></body></html>`;

await mkdir(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  ignoreDefaultArgs: ['--hide-scrollbars'],
  viewport: SCREENSHOT_SIZE,
  deviceScaleFactor: 1,
});
try {
  await routeFakeNetwork(context);
  const serviceWorker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(serviceWorker.url()).host;
  const page = await context.newPage();

  await setTheme(serviceWorker, 'light');
  await showCard(page, { dark: false, wordId: 'known', expectedTitle: '온보딩' });
  await page.screenshot({ path: outputPath('screenshot-1.png') });

  await showCard(page, { dark: false, wordId: 'ambiguous', expectedTitle: '트리거' });
  await page.locator('[data-role="suggestion"]').waitFor();
  await page.screenshot({ path: outputPath('screenshot-2.png') });

  await setTheme(serviceWorker, 'dark');
  await showCard(page, { dark: true, wordId: 'known', expectedTitle: '온보딩' });
  await page.screenshot({ path: outputPath('screenshot-3.png') });

  await setTheme(serviceWorker, 'light');
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.addStyleTag({
    content:
      'body{min-height:100vh;box-sizing:border-box;display:flex;align-items:center;justify-content:center}main{zoom:1.7;width:440px}',
  });
  await page.locator('#shortcut').waitFor();
  // 스위치 이동 애니메이션이 끝난 뒤에 찍는다.
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: outputPath('screenshot-4.png') });

  await page.setViewportSize(PROMO_SIZE);
  await page.setContent(PROMO_HTML);
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: outputPath('promo-small.png') });
} finally {
  await context.close();
}
