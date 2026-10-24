import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'node:path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');
export const ARTICLE_URL = 'https://example.test/article';

const ARTICLE_HTML = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>기사</title></head>
<body style="padding:40px;font-size:18px">
  <p>요즘 스타트업에서는 <span id="known">온보딩</span> 과정을 자동화하는 사례가 늘고 있다.</p>
  <p>젊은 세대 사이에서는 <span id="unknown">갓생</span> 이라는 말이 유행한다.</p>
</body></html>`;

const SUMMARIES: Record<string, object> = {
  온보딩: {
    type: 'standard',
    title: '온보딩',
    extract: '온보딩은 신입 직원이 조직에 적응하도록 돕는 과정이다.',
    content_urls: {
      desktop: { page: 'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9' },
    },
  },
};

async function routeFakeNetwork(context: BrowserContext): Promise<void> {
  await context.route('https://example.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: ARTICLE_HTML }),
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
  await context.route(/ko\.wikipedia\.org\/w\/api\.php/, (route) =>
    route.fulfill({ json: { query: { search: [] } } }),
  );
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
