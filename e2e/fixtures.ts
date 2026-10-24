import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
export const ARTICLE_URL = 'https://example.test/article';

const ARTICLE_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>기사</title></head>
<body style="padding:40px;font-size:18px">
  <p>요즘 스타트업에서는 <span id="known">온보딩</span> 과정을 자동화하는 사례가 늘고 있다.</p>
  <p>젊은 세대 사이에서는 <span id="unknown">갓생</span> 이라는 말이 유행한다.</p>
  <p>주문 테이블에 행이 추가될 때마다 재고를 줄이도록 <span id="ambiguous">트리거</span> 기능을 걸어 두었다.</p>
</body></html>`;

export const FRAME_HOST_URL = 'https://example.test/frame-host';

const FRAME_HOST_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>프레임 호스트</title></head>
<body><iframe src="https://example.test/frame-article" style="width:600px;height:300px"></iframe></body></html>`;

const FRAME_ARTICLE_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>프레임 기사</title></head>
<body style="padding:40px;font-size:18px"><span id="known">온보딩</span></body></html>`;

const SUMMARIES: Record<string, object> = {
  온보딩: {
    type: 'standard',
    title: '온보딩',
    extract: '온보딩은 신입 직원이 조직에 적응하도록 돕는 과정이다.',
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

const PAGE_TEXT: Record<string, object> = {
  트리거: {
    query: {
      pages: {
        '1': {
          title: '트리거',
          extract:
            '트리거(Trigger)는 다음 뜻으로 쓰인다.\n\n== 기본 의미 ==\n트리거는 총의 방아쇠를 뜻하는 사격용어이다.\n\n== 컴퓨터 과학 ==\n데이터베이스 트리거\n\n== 기업 ==\n트리거 (애니메이션 제작사): 일본의 애니메이션 제작사\n\n== 같이 보기 ==\n방아쇠 (동음이의)',
        },
      },
    },
  },
};

const LINKED: Record<string, object> = {
  트리거: {
    query: {
      pages: {
        '2': {
          title: '데이터베이스 트리거',
          extract:
            '데이터베이스 트리거는 테이블에 행이 추가되거나 바뀔 때 자동으로 실행되는 절차이다.',
        },
        '3': { title: '트리거 (애니메이션 제작사)', extract: '일본의 애니메이션 제작사이다.' },
        '4': { title: '방아쇠', extract: '방아쇠는 총의 격발 장치이다.' },
      },
    },
  },
};

async function routeFakeNetwork(context: BrowserContext): Promise<void> {
  await context.route('https://example.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML }),
  );
  // Playwright는 나중에 등록한 라우트를 먼저 적용하므로, 프레임 라우트는 위 와일드카드 뒤에 등록한다.
  await context.route(FRAME_HOST_URL, (route) =>
    route.fulfill({ contentType: 'text/html', body: FRAME_HOST_HTML }),
  );
  await context.route('https://example.test/frame-article', (route) =>
    route.fulfill({ contentType: 'text/html', body: FRAME_ARTICLE_HTML }),
  );
  await context.route('https://ko.wikipedia.org/api/rest_v1/page/summary/**', (route) => {
    const title = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop() ?? '',
    );
    const body = SUMMARIES[title];
    return body
      ? route.fulfill({ json: body })
      : route.fulfill({ status: 404, json: { type: 'not_found' } });
  });
  await context.route(/ko\.wikipedia\.org\/w\/api\.php/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const title = params.get('titles') ?? '';
    if (params.get('generator') === 'links')
      return route.fulfill({ json: LINKED[title] ?? { query: {} } });
    if (params.get('prop') === 'extracts')
      return route.fulfill({ json: PAGE_TEXT[title] ?? { query: {} } });
    return route.fulfill({ json: { query: { search: [] } } });
  });
  await context.route(/^https:\/\/(www\.google\.com|search\.naver\.com)\//, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<p>search</p>' }),
  );
}

export const test = base.extend<{
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern -- Playwright 픽스처는 첫 인자를 구조 분해 형태로 요구한다
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    await routeFakeNetwork(context);
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    await use(context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker')));
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;
