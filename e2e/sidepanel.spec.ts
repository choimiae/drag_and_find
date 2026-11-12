import { expect, test } from './fixtures';

declare const chrome: typeof import('wxt/browser').browser;

test('선택한 단어를 임시 저장하면 옆 패널에서 뜻을 조회한다', async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const tabId = await serviceWorker.evaluate(
    async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id,
  );
  expect(tabId).toBeDefined();

  await serviceWorker.evaluate(
    async ({ tabId }) => {
      await chrome.storage.session.set({ [`context-selection:${tabId}`]: '온보딩' });
    },
    { tabId },
  );

  await expect(page.locator('main [data-role="extract"]')).toContainText('신입 직원');
  await expect(page.locator('main [data-role="wiki-link"]')).toHaveAttribute(
    'href',
    'https://ko.wikipedia.org/wiki/%EC%98%A8%EB%B3%B4%EB%94%A9',
  );
});

test('다른 창의 탭 전환은 현재 창의 조회 결과를 바꾸지 않는다', async ({
  page,
  extensionId,
  serviceWorker,
}) => {
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  const tabId = await serviceWorker.evaluate(
    async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id,
  );
  expect(tabId).toBeDefined();
  await serviceWorker.evaluate(
    async ({ tabId }) => chrome.storage.session.set({ [`context-selection:${tabId}`]: '온보딩' }),
    { tabId },
  );
  await expect(page.locator('main [data-role="extract"]')).toContainText('신입 직원');

  const otherWindowId = await serviceWorker.evaluate(
    async () => (await chrome.windows.create({ url: 'https://example.test/article' }))?.id,
  );
  try {
    await expect(page.locator('main [data-role="extract"]')).toContainText('신입 직원');
  } finally {
    if (otherWindowId !== undefined) {
      await serviceWorker.evaluate((windowId) => chrome.windows.remove(windowId), otherWindowId);
    }
  }
});
